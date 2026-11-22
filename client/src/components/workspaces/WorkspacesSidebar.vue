<template>
  <div class="workspaces-sidebar">
    <h3>Workspaces</h3>
    <p v-if="loading" class="sidebar-hint">Loading…</p>
    <p v-else-if="groups.length === 0" class="sidebar-hint">
      No workspaces yet. Create one from a chat's details panel.
    </p>
    <div v-for="group in groups" :key="group.chatRoomId" class="chat-group">
      <h6 class="chat-group-name">{{ group.chatName || "Chat" }}</h6>
      <ul class="workspace-list">
        <li
          v-for="workspace in group.workspaces"
          :key="workspace._id"
          :class="{ active: selectedWorkspaceId === workspace._id }"
          @click="selectWorkspace(workspace)"
        >
          {{ workspace.name }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    workspaces: {
      type: Array,
      default: () => [],
    },
    selectedWorkspaceId: String,
    loading: Boolean,
  },
  computed: {
    groups() {
      const byChat = new Map();
      for (const workspace of this.workspaces) {
        const key = String(workspace.chatRoomId);
        if (!byChat.has(key)) {
          byChat.set(key, {
            chatRoomId: key,
            chatName: workspace.chatName,
            workspaces: [],
          });
        }
        byChat.get(key).workspaces.push(workspace);
      }
      return [...byChat.values()];
    },
  },
  methods: {
    selectWorkspace(workspace) {
      this.$emit("select-workspace", workspace);
    },
  },
};
</script>

<style scoped>
.workspaces-sidebar {
  width: 350px;
  min-width: 260px;
  background: #f5f5f5;
  padding: 20px;
  height: 100vh;
  overflow-y: auto;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}
.sidebar-hint {
  color: gray;
}
.chat-group {
  margin-bottom: 16px;
}
.chat-group-name {
  color: gray;
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.workspace-list {
  list-style: none;
  padding: 0;
}
.workspace-list li {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #ddd;
}
.workspace-list li.active {
  background-color: #43792d;
  color: white;
  border-radius: 10px;
  padding: 10px;
}
</style>
