<template>
  <div
    class="task-card"
    :class="{ dragging }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="dragging = false"
    @dragover.prevent
    @drop.prevent.stop="$emit('drop-on', task)"
    @click="$emit('open', task)"
  >
    <div class="title">{{ task.title }}</div>
    <div v-if="task.description" class="description">{{ task.description }}</div>
    <div class="meta">
      <span v-if="task.dueDate" class="due" :class="{ overdue: isOverdue }">
        <i class="fa-regular fa-calendar"></i> {{ dueLabel }}
      </span>
      <span class="assignees">
        <UserAvatar
          v-for="user in assignees"
          :key="user._id"
          :user-id="user._id"
          :name="user.username"
          :src="user.profilePictureUrl || ''"
          :size="22"
        />
      </span>
    </div>
    <div v-if="viewers.length" class="viewers" :title="viewerNames">
      <i class="fa-solid fa-eye"></i>
      <UserAvatar
        v-for="viewer in viewers"
        :key="viewer.userId"
        :user-id="viewer.userId"
        :name="viewer.username"
        :src="viewer.profilePictureUrl || ''"
        :size="18"
      />
    </div>
  </div>
</template>

<script>
import UserAvatar from "../UserAvatar.vue";

export default {
  name: "TaskCard",
  components: { UserAvatar },
  props: {
    task: { type: Object, required: true },
    participants: { type: Array, default: () => [] },
    /** Presence members currently focused on this task. */
    viewers: { type: Array, default: () => [] },
  },
  data() {
    return { dragging: false };
  },
  computed: {
    assignees() {
      const ids = (this.task.assignedTo || []).map(String);
      return this.participants.filter((p) => ids.includes(String(p._id)));
    },
    dueLabel() {
      return new Date(this.task.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    },
    isOverdue() {
      if (this.task.status === "done") return false;
      const due = new Date(this.task.dueDate);
      due.setHours(23, 59, 59, 999);
      return due.getTime() < Date.now();
    },
    viewerNames() {
      return this.viewers.map((v) => v.username).join(", ") + " viewing";
    },
  },
  methods: {
    onDragStart(event) {
      this.dragging = true;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(this.task._id));
      this.$emit("drag-start", this.task);
    },
  },
};
</script>

<style scoped>
.task-card {
  background: var(--surface);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: grab;
}
.task-card.dragging {
  opacity: 0.4;
}
.title {
  font-weight: 500;
  word-break: break-word;
}
.description {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-top: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 0.8em;
}
.due {
  color: var(--text-muted);
}
.due.overdue {
  color: #b81010;
  font-weight: 600;
}
.assignees {
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
}
.viewers {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 6px;
  font-size: 0.75em;
  color: #3997d6;
}
</style>
