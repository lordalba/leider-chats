<template>
  <div
    class="task-card"
    :class="{ dragging }"
    :data-task-id="task._id"
    draggable="true"
    role="button"
    tabindex="0"
    @dragstart="onDragStart"
    @dragend="$emit('drag-end')"
    @click="$emit('open', task)"
    @keydown.enter="$emit('open', task)"
  >
    <div class="task-card-top">
      <span class="task-title" :title="task.title">{{ task.title }}</span>
      <div v-if="viewers.length" class="task-viewers" title="Viewing now">
        <UserAvatar
          v-for="member in viewers"
          :key="member.userId"
          class="task-viewer"
          :username="member.username"
          :userId="String(member.userId)"
          :src="member.profilePictureUrl || ''"
          :size="22"
        />
      </div>
    </div>
    <div v-if="assignees.length || task.description || due" class="task-card-bottom">
      <div class="task-assignees">
        <UserAvatar
          v-for="user in assignees"
          :key="user._id"
          class="task-assignee"
          :username="user.username"
          :userId="String(user._id)"
          :src="user.profilePictureUrl || ''"
          :size="24"
          :aria-label="user.username"
        />
        <i
          v-if="task.description"
          class="fa-solid fa-align-left task-has-description"
          role="img"
          aria-label="Has description"
          title="Has description"
        ></i>
      </div>
      <span v-if="due" class="task-due" :class="'tone-' + due.tone">
        <i class="fa-regular fa-calendar" aria-hidden="true"></i> {{ due.text }}
      </span>
    </div>
  </div>
</template>

<script>
import UserAvatar from "@/components/workspaces/UserAvatar.vue";
import { dueLabel } from "@/workspaces/taskBoard";

export default {
  name: "TaskCard",
  components: { UserAvatar },
  props: {
    task: {
      type: Object,
      required: true,
    },
    participants: {
      type: Array,
      default: () => [],
    },
    // Presence members focused on this task (current user already excluded).
    viewers: {
      type: Array,
      default: () => [],
    },
    dragging: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    assignees() {
      const ids = (this.task.assignedTo || []).map(String);
      return this.participants.filter((p) => ids.includes(String(p._id)));
    },
    due() {
      return dueLabel(this.task.dueDate, new Date(), { done: this.task.status === "done" });
    },
  },
  methods: {
    onDragStart(event) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(this.task._id));
      this.$emit("drag-start", this.task);
    },
  },
};
</script>

<style scoped>
.task-card {
  background: var(--ws-surface);
  border: 1px solid var(--ws-border);
  border-radius: var(--ws-radius-sm);
  padding: 8px 10px;
  margin-bottom: 8px;
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.task-card:hover {
  border-color: var(--ws-accent);
}
.task-card.dragging {
  opacity: 0.4;
}
.task-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
}
.task-title {
  font-weight: 500;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.task-viewers {
  display: flex;
}
.task-viewers .task-viewer {
  margin-left: -6px;
  border-color: #f0ad4e;
}
.task-viewers .task-viewer:first-child {
  margin-left: 0;
}
.task-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  min-height: 24px;
}
.task-assignees {
  display: flex;
  align-items: center;
}
.task-has-description {
  margin-left: 8px;
  font-size: 12px;
  color: var(--ws-text-muted);
}
.task-assignee {
  margin-left: -6px;
}
.task-assignee:first-child {
  margin-left: 0;
}
.task-due {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
  color: var(--ws-text-muted);
}
.task-due.tone-soon {
  background: var(--ws-warn-soft);
  color: var(--ws-warn);
  font-weight: 600;
}
.task-due.tone-overdue {
  background: #fbeaea;
  color: var(--ws-danger);
  font-weight: 600;
}
</style>
