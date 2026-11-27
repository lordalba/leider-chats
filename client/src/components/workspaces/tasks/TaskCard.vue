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
      <span class="task-title">{{ task.title }}</span>
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
    <div class="task-card-bottom">
      <div class="task-assignees">
        <UserAvatar
          v-for="user in assignees"
          :key="user._id"
          class="task-assignee"
          :username="user.username"
          :userId="String(user._id)"
          :src="user.profilePictureUrl || ''"
          :size="24"
        />
      </div>
      <span v-if="dueLabel" class="task-due" :class="{ overdue }">
        <i class="fa-regular fa-calendar"></i> {{ dueLabel }}
      </span>
    </div>
  </div>
</template>

<script>
import UserAvatar from "@/components/workspaces/UserAvatar.vue";
import { dueDateToInput, isOverdue } from "@/workspaces/taskBoard";

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
    dueLabel() {
      const day = dueDateToInput(this.task.dueDate);
      if (!day) return "";
      const [y, m, d] = day.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    },
    overdue() {
      return isOverdue(this.task);
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
  background: #fff;
  border: 1px solid #e3e3e3;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.task-card:hover {
  border-color: #45815c;
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
}
.task-assignee {
  margin-left: -6px;
}
.task-assignee:first-child {
  margin-left: 0;
}
.task-due {
  font-size: 0.8em;
  color: #666;
}
.task-due.overdue {
  color: #d9534f;
  font-weight: 600;
}
</style>
