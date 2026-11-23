<template>
  <div class="task-board">
    <div
      v-for="status in statuses"
      :key="status"
      class="column"
      :class="{ 'drop-target': dragOverStatus === status }"
      @dragover.prevent="dragOverStatus = status"
      @dragleave.self="dragOverStatus = null"
      @drop.prevent="drop(status, null)"
    >
      <div class="column-header">
        <span>{{ labels[status] }}</span>
        <span class="count">{{ groups[status].length }}</span>
      </div>
      <div class="cards">
        <TaskCard
          v-for="task in groups[status]"
          :key="task._id"
          :task="task"
          :participants="participants"
          :viewers="viewersOf(task)"
          @open="openEdit"
          @drag-start="draggingId = String($event._id)"
          @drop-on="drop(status, $event)"
        />
      </div>
      <button class="add-btn" @click="openCreate(status)"><i class="fa-solid fa-plus"></i> Add task</button>
    </div>

    <TaskEditModal
      :visible.sync="modalOpen"
      :task="editingTask"
      :participants="participants"
      :saving="saving"
      @save="save"
      @delete="remove"
      @hidden="onModalHidden"
    />
  </div>
</template>

<script>
import TaskCard from "./TaskCard.vue";
import TaskEditModal from "./TaskEditModal.vue";
import { STATUSES, STATUS_LABELS, groupTasks, orderBetween } from "@/workspaces/taskBoard";
import { emitWithAck, errorMessage } from "@/workspaces/socketCall";

export default {
  name: "TaskBoard",
  components: { TaskCard, TaskEditModal },
  props: {
    workspaceId: { type: String, required: true },
    tasks: { type: Array, default: () => [] },
    participants: { type: Array, default: () => [] },
    members: { type: Array, default: () => [] },
  },
  data() {
    return {
      statuses: STATUSES,
      labels: STATUS_LABELS,
      draggingId: null,
      dragOverStatus: null,
      modalOpen: false,
      editingId: null,
      createStatus: "todo",
      saving: false,
    };
  },
  computed: {
    groups() {
      return groupTasks(this.tasks);
    },
    editingTask() {
      return this.editingId ? this.tasks.find((t) => String(t._id) === this.editingId) || null : null;
    },
    socket() {
      return this.$store.getters["socket/socket"];
    },
    myId() {
      const user = this.$store.state.connectedUser;
      return user ? String(user._id) : "";
    },
  },
  watch: {
    tasks() {
      // The task being edited was deleted by someone else.
      if (this.modalOpen && this.editingId && !this.editingTask) {
        this.modalOpen = false;
        this.$toast.info("This task was deleted.");
      }
    },
  },
  methods: {
    viewersOf(task) {
      return this.members.filter(
        (m) => m.userId !== this.myId && m.focus && m.focus.kind === "task" && m.focus.id === String(task._id)
      );
    },
    openEdit(task) {
      this.editingId = String(task._id);
      this.modalOpen = true;
      this.$emit("focus", { kind: "task", id: this.editingId });
    },
    openCreate(status) {
      this.editingId = null;
      this.createStatus = status;
      this.modalOpen = true;
    },
    onModalHidden() {
      if (this.editingId) this.$emit("focus", null);
      this.editingId = null;
    },
    async save(payload) {
      this.saving = true;
      try {
        if (this.editingId) {
          await emitWithAck(this.socket, "task:update", this.editingId, payload);
        } else {
          await emitWithAck(this.socket, "task:create", this.workspaceId, { ...payload, status: this.createStatus });
        }
        this.modalOpen = false;
      } catch (err) {
        this.$toast.error(errorMessage(err));
      } finally {
        this.saving = false;
      }
    },
    async remove(task) {
      this.saving = true;
      try {
        await emitWithAck(this.socket, "task:delete", String(task._id));
        this.modalOpen = false;
      } catch (err) {
        this.$toast.error(errorMessage(err));
      } finally {
        this.saving = false;
      }
    },
    async drop(status, beforeTask) {
      this.dragOverStatus = null;
      const id = this.draggingId;
      this.draggingId = null;
      const task = id && this.tasks.find((t) => String(t._id) === id);
      if (!task) return;
      if (beforeTask && String(beforeTask._id) === id) return;

      const column = this.groups[status].filter((t) => String(t._id) !== id);
      const index = beforeTask ? column.findIndex((t) => String(t._id) === String(beforeTask._id)) : column.length;
      const prev = column[index - 1];
      const next = column[index];
      const order = orderBetween(prev && prev.order, next && next.order);
      if (task.status === status && order === task.order) return;

      // Optimistic: move it now, revert if the server says no.
      const original = { ...task };
      this.$emit("local-update", { ...task, status, order });
      try {
        await emitWithAck(this.socket, "task:move", id, status, order);
      } catch (err) {
        this.$emit("local-update", original);
        this.$toast.error(errorMessage(err));
      }
    },
  },
};
</script>

<style scoped>
.task-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(200px, 1fr));
  gap: 14px;
  align-items: start;
  overflow-x: auto;
}
.column {
  background: #f0f0f0;
  border-radius: 10px;
  padding: 10px;
  min-height: 200px;
  border: 2px dashed transparent;
  transition: border-color 0.15s;
}
.column.drop-target {
  border-color: #45815c;
}
.column-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 10px;
}
.count {
  color: gray;
  font-weight: 400;
}
.cards {
  min-height: 20px;
}
.add-btn {
  width: 100%;
  background: none;
  border: none;
  color: #45815c;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.add-btn:hover {
  background: #e2e2e2;
}
</style>
