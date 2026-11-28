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
      </div>
      <b-button variant="link" size="sm" class="add-task" @click="openCreate(status)">
        + Add task
      </b-button>
    </div>

    <TaskEditModal
      :visible.sync="modalVisible"
      :editing="Boolean(editingId)"
      :task="editingTask"
      :status="createStatus"
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
    openCreate(status) {
      this.editingId = null;
      this.createStatus = status;
      this.modalVisible = true;
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
.task-board {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  overflow-x: auto;
  padding-bottom: 8px;
}
.task-column {
  flex: 1 0 220px;
  background: #f4f5f7;
  border-radius: 8px;
  padding: 8px;
  border: 2px dashed transparent;
}
.task-column.drop-target {
  border-color: #45815c;
}
.task-column-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  padding: 4px 2px 8px;
}
.task-count {
  color: #888;
  font-weight: normal;
}
.task-column-body {
  min-height: 40px;
}
.add-task {
  color: #45815c;
  padding-left: 2px;
}
</style>
