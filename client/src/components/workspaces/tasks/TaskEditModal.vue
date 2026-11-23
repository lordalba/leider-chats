<template>
  <b-modal
    :visible="visible"
    :title="task ? 'Edit task' : 'New task'"
    size="lg"
    @change="(v) => $emit('update:visible', v)"
    @hidden="$emit('hidden')"
  >
    <b-form @submit.prevent="save">
      <b-form-group label="Title" label-for="task-title">
        <b-form-input id="task-title" v-model="form.title" maxlength="200" autofocus required />
      </b-form-group>
      <b-form-group label="Description" label-for="task-description">
        <b-form-textarea id="task-description" v-model="form.description" maxlength="5000" rows="4" />
      </b-form-group>
      <b-form-group label="Assignees">
        <b-form-checkbox-group v-model="form.assignedTo">
          <b-form-checkbox v-for="p in participants" :key="p._id" :value="String(p._id)">
            {{ p.username }}
          </b-form-checkbox>
        </b-form-checkbox-group>
      </b-form-group>
      <b-form-group label="Due date" label-for="task-due">
        <div class="due-row">
          <b-form-input id="task-due" v-model="form.dueDate" type="date" />
          <b-button v-if="form.dueDate" variant="link" size="sm" @click="form.dueDate = ''">Clear</b-button>
        </div>
      </b-form-group>
    </b-form>

    <template #modal-footer>
      <b-button v-if="task" variant="outline-danger" class="mr-auto" :disabled="saving" @click="$emit('delete', task)">
        Delete
      </b-button>
      <b-button variant="secondary" :disabled="saving" @click="$emit('update:visible', false)">Cancel</b-button>
      <b-button variant="success" :disabled="!form.title.trim() || saving" @click="save">
        {{ task ? "Save" : "Create" }}
      </b-button>
    </template>
  </b-modal>
</template>

<script>
const toDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default {
  name: "TaskEditModal",
  props: {
    visible: { type: Boolean, default: false },
    /** The task to edit, or null to create one. */
    task: { type: Object, default: null },
    participants: { type: Array, default: () => [] },
    saving: { type: Boolean, default: false },
  },
  data() {
    return { form: { title: "", description: "", assignedTo: [], dueDate: "" } };
  },
  watch: {
    visible: {
      immediate: true,
      handler(open) {
        if (open) this.reset();
      },
    },
  },
  methods: {
    reset() {
      const t = this.task;
      this.form = {
        title: t ? t.title : "",
        description: t ? t.description || "" : "",
        assignedTo: t ? (t.assignedTo || []).map(String) : [],
        dueDate: t ? toDateInput(t.dueDate) : "",
      };
    },
    save() {
      if (!this.form.title.trim()) return;
      this.$emit("save", {
        title: this.form.title.trim(),
        description: this.form.description,
        assignedTo: this.form.assignedTo,
        // Noon local time, so the date doesn't shift across time zones.
        dueDate: this.form.dueDate ? new Date(`${this.form.dueDate}T12:00:00`).toISOString() : null,
      });
    },
  },
};
</script>

<style scoped>
.due-row {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 260px;
}
</style>
