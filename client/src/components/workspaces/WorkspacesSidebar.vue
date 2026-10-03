<template>
    <div class="sidebar">
      <h3>Workspaces</h3>
      <ul class="workspace-list">
        <li
          v-for="workspace in workspaces"
          :key="workspace._id"
          :class="{ active: selectedWorkspaceId === workspace._id }"
          @click="selectWorkspace(workspace)"
        >
          {{ workspace.name }}
          <span class="participant-count">{{ workspace.participants.length }} members</span>
        </li>
      </ul>
      <button @click="createWorkspace" class="create-btn">+ New Workspace</button>
    </div>
  </template>
  
  <script>
  export default {
    props: {
      workspaces: Array,
      selectedWorkspaceId: String,
    },
    methods: {
      selectWorkspace(workspace) {
        this.$emit("select-workspace", workspace);
      },
      createWorkspace() {
        this.$emit("create-workspace");
      },
    },
  };
  </script>
  
  <style scoped>
  .sidebar {
    width: 350px;
    background: #f5f5f5;
    padding: 20px;
    height: 100vh;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
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
  .participant-count {
    font-size: 0.9em;
    color: gray;
    margin-left: 5px;
  }
  .create-btn {
    margin-top: 20px;
    padding: 10px 15px;
    background-color: #45815c;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }
  </style>
  