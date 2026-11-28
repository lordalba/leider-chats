<template>
  <div class="task-board">
    <div
      v-for="status in statuses"
      :key="status"
      class="task-column"
      :class="{ 'drop-target': dropStatus === status }"
      @dragover.prevent="onDragOver(status, $event)"
      @dragleave="onDragLeave(status, $event)"
      @drop.prevent="onDrop(status, $event)"
    >
      <div class="task-column-header">
        <span>{{ labels[status] }}</span>
        <span class="task-count">{{ columns[status].length }}</span>
      </div>
      <div :ref="'column-' + status" class="task-column-body">
        <TaskCard
          v-for="task in columns[status]"
          :key="task._id"
          :task="task"
          :participants="participants"
          :viewers="viewersByTask[task._id] || []"
          :dragging="draggingId === task._id"
          @open="openEdit"
          @drag-start="draggingId = task._id"
          @drag-end="onDragEnd"
        />
        <p v-if="!columns[status].length" class="task-column-empty">Drop tasks here</p>
        <form
          v-if="quickStatus === status"
          class="quick-add"
          @submit.prevent="quickAdd"
          @keydown.esc.stop="closeQuickAdd"
        >
          <input
            ref="quickInput"
            v-model="quickTitle"
            class="form-control form-control-sm"
            maxlength="200"
            placeholder="Task title, then Enter"
            :aria-label="`New task in ${labels[status]}`"
            :disabled="quickBusy"
          />
          <div class="quick-add-actions">
            <button type="button" class="btn btn-link btn-sm" @click="moreOptions(status)">
              More options
            </button>
            <button type="button" class="btn btn-link btn-sm quick-close" @click="closeQuickAdd">
              Done
            </button>
          </div>
        </form>
        <button v-else type="button" class="add-task" @click="openQuickAdd(status)">
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Add a task
        </button>
      </div>
    </div>

    <TaskEditModal
      :visible.sync="modalVisible"
      :editing="Boolean(editingId)"
      :task="editingTask"
      :status="createStatus"
      :presetTitle="presetTitle"
      :workspaceId="workspaceId"
      :participants="participants"
      :socket="socket"
      :columns="columns"
      @item-event="(event) => $emit('item-event', event)"
      @hidden="onModalHidden"
    />
  </div>
</template>

<script>
import TaskCard from "@/components/workspaces/tasks/TaskCard.vue";
import TaskEditModal from "@/components/workspaces/tasks/TaskEditModal.vue";
import { emitWithAck } from "@/workspaces/socketCall";
import {
  STATUSES,
  STATUS_LABELS,
  dropOrder,
  groupTasks,
  taskErrorMessage,
} from "@/workspaces/taskBoard";

export default {
  name: "TaskBoard",
  components: { TaskCard, TaskEditModal },
  props: {
    tasks: {
      type: Array,
      default: () => [],
    },
    participants: {
      type: Array,
      default: () => [],
    },
    members: {
      type: Array,
      default: () => [],
    },
    workspaceId: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      statuses: STATUSES,
      labels: STATUS_LABELS,
      draggingId: null,
      dropStatus: null,
      modalVisible: false,
      editingId: null,
      createStatus: STATUSES[0],
      presetTitle: "",
      // Inline quick add: the column it's open in, its text, in flight.
      quickStatus: null,
      quickTitle: "",
      quickBusy: false,
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    currentUserId() {
      const user = this.$store.state.connectedUser;
      return user ? String(user._id) : null;
    },
    columns() {
      return groupTasks(this.tasks);
    },
    editingTask() {
      if (!this.editingId) return null;
      return this.tasks.find((t) => String(t._id) === this.editingId) || null;
    },
    viewersByTask() {
      const map = {};
      this.members.forEach((member) => {
        const focus = member.focus;
        if (!focus || focus.kind !== "task" || !focus.id) return;
        if (String(member.userId) === this.currentUserId) return;
        (map[focus.id] = map[focus.id] || []).push(member);
      });
      return map;
    },
  },
  beforeDestroy() {
    if (this.modalVisible && this.editingId) this.$emit("focus", null);
  },
  methods: {
    openCreate(status, title = "") {
      this.editingId = null;
      this.createStatus = status;
      this.presetTitle = title;
      this.modalVisible = true;
    },
    openQuickAdd(status) {
      this.quickStatus = status;
      this.quickTitle = "";
      this.$nextTick(() => this.focusQuickInput());
    },
    focusQuickInput() {
      const input = this.$refs.quickInput;
      const el = Array.isArray(input) ? input[0] : input;
      if (el) el.focus();
    },
    closeQuickAdd() {
      this.quickStatus = null;
      this.quickTitle = "";
    },
    moreOptions(status) {
      const title = this.quickTitle.trim();
      this.closeQuickAdd();
      this.openCreate(status, title);
    },
    // Enter creates the task and keeps the input open for the next one.
    async quickAdd() {
      const title = this.quickTitle.trim();
      const status = this.quickStatus;
      if (!title || this.quickBusy) return;
      if (!this.socket) {
        this.$toast.error(taskErrorMessage("server_error"));
        return;
      }
      this.quickBusy = true;
      try {
        const item = await emitWithAck(this.socket, "task:create", this.workspaceId, {
          title,
          status,
        });
        this.$emit("item-event", { action: "created", item });
        if (this.quickStatus === status) this.quickTitle = "";
      } catch (error) {
        console.error("task:create failed:", error);
        this.$toast.error(taskErrorMessage(error.message));
      } finally {
        this.quickBusy = false;
        this.$nextTick(() => this.focusQuickInput());
      }
    },
    openEdit(task) {
      this.editingId = String(task._id);
      this.modalVisible = true;
      this.$emit("focus", { kind: "task", id: this.editingId });
    },
    onModalHidden() {
      if (this.editingId) this.$emit("focus", null);
      this.editingId = null;
    },
    onDragOver(status, event) {
      if (!this.draggingId) return;
      event.dataTransfer.dropEffect = "move";
      this.dropStatus = status;
    },
    onDragLeave(status, event) {
      // Ignore leaves into a child element of the same column.
      if (event.currentTarget.contains(event.relatedTarget)) return;
      if (this.dropStatus === status) this.dropStatus = null;
    },
    onDragEnd() {
      this.draggingId = null;
      this.dropStatus = null;
    },
    dropIndex(status, clientY) {
      // Position among the column's cards, excluding the dragged one.
      const body = this.$refs["column-" + status];
      const el = Array.isArray(body) ? body[0] : body;
      if (!el) return 0;
      const cards = Array.from(el.querySelectorAll("[data-task-id]")).filter(
        (card) => card.getAttribute("data-task-id") !== this.draggingId
      );
      const index = cards.findIndex((card) => {
        const rect = card.getBoundingClientRect();
        return clientY < rect.top + rect.height / 2;
      });
      return index === -1 ? cards.length : index;
    },
    onDrop(status, event) {
      const id = this.draggingId;
      this.onDragEnd();
      if (!id) return;
      const task = this.tasks.find((t) => String(t._id) === id);
      if (!task) return;

      const column = this.columns[status];
      const index = this.dropIndex(status, event.clientY);
      // Dropped where it already is: its index among the other cards is
      // unchanged.
      if (task.status === status && index === column.findIndex((t) => t._id === id)) {
        return;
      }
      this.moveTask(task, status, dropOrder(column, id, index));
    },
    async moveTask(task, status, order) {
      const previous = task;
      // Optimistic: same updatedAt, so any newer server state still wins.
      this.$emit("item-event", { action: "updated", item: { ...task, status, order } });
      if (!this.socket) {
        this.$emit("item-event", { action: "updated", item: previous });
        this.$toast.error(taskErrorMessage("server_error"));
        return;
      }
      try {
        const item = await emitWithAck(this.socket, "task:move", task._id, status, order);
        this.$emit("item-event", { action: "updated", item });
      } catch (error) {
        console.error("task:move failed:", error);
        // Revert, unless newer server state (newer updatedAt) already arrived.
        this.$emit("item-event", {
          action: error.message === "not_found" ? "deleted" : "updated",
          item: error.message === "not_found" ? { _id: task._id } : previous,
        });
        this.$toast.error(taskErrorMessage(error.message));
      }
    },
  },
};
</script>

<style scoped>
/* The detail pane has a fixed height: the board scrolls inside it. */
.task-board {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  gap: var(--ws-space-3);
  align-items: stretch;
  overflow-x: auto;
  padding-bottom: var(--ws-space-2);
}
.task-column {
  flex: 1 0 220px;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--ws-surface-muted);
  border-radius: var(--ws-radius);
  padding: var(--ws-space-2);
  border: 2px dashed transparent;
}
.task-column.drop-target {
  border-color: var(--ws-accent);
  background: var(--ws-accent-soft);
}
.task-column-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  padding: 4px 2px 8px;
}
.task-count {
  color: var(--ws-text-muted);
  font-weight: normal;
}
/* The body grows to the column's full height and is the drop zone. */
.task-column-body {
  flex: 1;
  min-height: 60px;
}
.task-column-empty {
  margin: 0 0 var(--ws-space-2);
  padding: var(--ws-space-4) var(--ws-space-2);
  border: 1px dashed var(--ws-border);
  border-radius: var(--ws-radius-sm);
  color: var(--ws-text-muted);
  font-size: 13px;
  text-align: center;
}
.add-task {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--ws-radius-sm);
  background: none;
  color: var(--ws-text-muted);
  font-size: 14px;
  text-align: left;
}
.add-task:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--ws-text);
}
.quick-add-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
}
.quick-add-actions .btn {
  padding-left: 2px;
  padding-right: 2px;
}
.quick-close {
  color: var(--ws-text-muted) !important;
}
</style>
