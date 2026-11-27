<template>
  <b-modal
    :visible="visible"
    content-class="ws-scope"
    :title="editing ? 'Edit task' : 'New task'"
    @show="resetForm"
    @hidden="onHidden"
    @change="(v) => $emit('update:visible', v)"
  >
    <b-form @submit.prevent="submit">
      <b-form-group label="Title" label-for="task-title">
        <b-form-input
          id="task-title"
          v-model="title"
          maxlength="200"
          placeholder="What needs doing?"
          autofocus
        />
      </b-form-group>
      <b-form-group label="Description (optional)" label-for="task-description">
        <b-form-textarea
          id="task-description"
          v-model="description"
          maxlength="5000"
          rows="4"
        />
      </b-form-group>
      <b-form-group v-if="participantOptions.length" label="Assignees">
        <b-form-checkbox-group v-model="assignedTo" :options="participantOptions" stacked />
      </b-form-group>
      <b-form-group label="Due date (optional)" label-for="task-due">
        <b-form-input id="task-due" v-model="dueDate" type="date" />
      </b-form-group>
    </b-form>


    <template #modal-footer>
      <b-button
        v-if="editing"
        variant="outline-danger"
        class="mr-auto me-auto"
        :disabled="busy"
        @click="confirmDelete"
      >
        Delete
      </b-button>
      <b-button variant="secondary" :disabled="busy" @click="close">Cancel</b-button>
      <b-button variant="primary" :disabled="!trimmedTitle || busy" @click="submit">
        {{ editing ? "Save" : "Create" }}
      </b-button>
    </template>
  </b-modal>
</template>

<script>
import { confirmDanger } from "@/workspaces/confirm";
import { emitWithAck } from "@/workspaces/socketCall";
import {
  dueDateToInput,
  inputToDueDate,
  taskErrorMessage,
} from "@/workspaces/taskBoard";

export default {
  name: "TaskEditModal",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // Edit mode when true; `task` is then the live task (null once deleted).
    editing: {
      type: Boolean,
      default: false,
    },
    task: {
      type: Object,
      default: null,
    },
    // Status preset for a new task.
    status: {
      type: String,
      default: "todo",
    },
    workspaceId: {
      type: String,
      default: null,
    },
    participants: {
      type: Array,
      default: () => [],
    },
    socket: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      title: "",
      description: "",
      assignedTo: [],
      dueDate: "",
      busy: false,
      deleting: false,
      // Field values as opened (edit mode), so a save sends only what this
      // user changed and never reverts someone else's concurrent edit.
      initialFields: null,
    };
  },
  computed: {
    trimmedTitle() {
      return this.title.trim();
    },
    participantIds() {
      return this.participants.map((p) => String(p._id));
    },
    participantOptions() {
      return this.participants.map((p) => ({
        value: String(p._id),
        text: p.username,
      }));
    },
  },
  watch: {
    task(current) {
      // Deleted by someone else while open (our own delete sets `deleting`).
      if (this.visible && this.editing && !current && !this.deleting) {
        this.$toast.error(taskErrorMessage("not_found"));
        this.close();
      }
    },
  },
  methods: {
    resetForm() {
      const task = this.editing ? this.task : null;
      this.title = task ? task.title || "" : "";
      this.description = task ? task.description || "" : "";
      this.assignedTo = task
        ? (task.assignedTo || [])
            .map(String)
            .filter((id) => this.participantIds.includes(id))
        : [];
      this.dueDate = task ? dueDateToInput(task.dueDate) : "";
      this.busy = false;
      this.deleting = false;
      this.initialFields = task ? this.fields() : null;
    },
    changedFields() {
      const current = this.fields();
      const initial = this.initialFields || {};
      const same = (key) =>
        key === "assignedTo"
          ? [...(current[key] || [])].sort().join() === [...(initial[key] || [])].sort().join()
          : current[key] === initial[key];
      const patch = {};
      Object.keys(current).forEach((key) => {
        if (!same(key)) patch[key] = current[key];
      });
      return patch;
    },
    fields() {
      return {
        title: this.trimmedTitle,
        description: this.description.trim(),
        // Only current chat participants are valid assignees.
        assignedTo: this.assignedTo.filter((id) => this.participantIds.includes(id)),
        dueDate: inputToDueDate(this.dueDate),
      };
    },
    async submit() {
      if (!this.trimmedTitle || this.busy) return;
      if (!this.socket) {
        this.$toast.error(taskErrorMessage("server_error"));
        return;
      }
      this.busy = true;
      try {
        let item;
        if (this.editing) {
          if (!this.task) return;
          const patch = this.changedFields();
          if (Object.keys(patch).length === 0) {
            this.close();
            return;
          }
          item = await emitWithAck(this.socket, "task:update", this.task._id, patch);
          this.$emit("item-event", { action: "updated", item });
        } else {
          const input = { ...this.fields(), status: this.status };
          if (!input.description) delete input.description;
          item = await emitWithAck(this.socket, "task:create", this.workspaceId, input);
          this.$emit("item-event", { action: "created", item });
        }
        this.close();
      } catch (error) {
        console.error("task save failed:", error);
        this.$toast.error(taskErrorMessage(error.message));
      } finally {
        this.busy = false;
      }
    },
    async confirmDelete() {
      if (!this.task || this.busy || !this.socket) return;
      const ok = await confirmDanger(this.$bvModal, {
        title: "Delete task?",
        message: `“${this.task.title}” will be deleted for everyone.`,
        okTitle: "Delete task",
      });
      // The task may have been deleted by someone else while asking.
      if (!ok || !this.task || this.busy) return;
      const id = this.task._id;
      this.busy = true;
      this.deleting = true;
      try {
        await emitWithAck(this.socket, "task:delete", id);
        this.$emit("item-event", { action: "deleted", item: { _id: id } });
        this.close();
      } catch (error) {
        console.error("task:delete failed:", error);
        this.$toast.error(taskErrorMessage(error.message));
        if (error.message === "not_found") {
          // Already gone (deleted concurrently): nothing left to edit.
          this.$emit("item-event", { action: "deleted", item: { _id: id } });
          this.close();
        } else {
          this.deleting = false;
        }
      } finally {
        this.busy = false;
      }
    },
    close() {
      this.$emit("update:visible", false);
    },
    onHidden() {
      this.$emit("update:visible", false);
      this.$emit("hidden");
    },
  },
};
</script>
