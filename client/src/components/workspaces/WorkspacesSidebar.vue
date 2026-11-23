<template>
  <div class="sidebar">
    <h3>Workspaces</h3>
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="workspaces.length === 0" class="muted">
      You're not in any workspace yet. Open a chat's details to create one.
    </p>
    <div v-for="group in groups" :key="group.chatName" class="group">
      <div class="chat-name"><i class="fa-regular fa-comments"></i> {{ group.chatName }}</div>
      <ul class="workspace-list">
        <li
          v-for="workspace in group.workspaces"
          :key="workspace._id"
          :class="{ active: selectedWorkspaceId === workspace._id }"
          @click="$emit('select-workspace', workspace)"
        >
          {{ workspace.name }}
        </li>
      </ul>
    </div>
    <router-link to="/chatrooms" class="create-btn">
      <i class="fa-solid fa-plus"></i> New workspace from a chat
    </router-link>
  </div>
</template>

<script>
export default {
  name: "WorkspacesSidebar",
  props: {
    workspaces: { type: Array, default: () => [] },
    selectedWorkspaceId: { type: String, default: null },
    loading: { type: Boolean, default: false },
  },
  computed: {
    groups() {
      const byChat = new Map();
      this.workspaces.forEach((workspace) => {
        const key = workspace.chatName || "Chat";
        if (!byChat.has(key)) byChat.set(key, []);
        byChat.get(key).push(workspace);
      });
      return Array.from(byChat, ([chatName, workspaces]) => ({ chatName, workspaces }));
    },
  },
};
</script>

<style scoped>
.sidebar {
  width: 300px;
  flex-shrink: 0;
  background: #f5f5f5;
  padding: 20px;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}
.muted {
  color: gray;
  font-size: 0.9em;
}
.group {
  margin-bottom: 14px;
}
.chat-name {
  font-size: 0.8em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #777;
  margin-bottom: 4px;
}
.workspace-list {
  list-style: none;
  padding: 0;
  margin: 0;
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
}
.create-btn {
  display: inline-block;
  margin-top: 20px;
  padding: 10px 15px;
  background-color: #45815c;
  color: white;
  border-radius: 5px;
  text-decoration: none;
}
</style>
