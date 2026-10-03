<template>
  <div id="app">
    <Sidebar
      :workspaces="workspaces"
      :selectedWorkspaceId="selectedWorkspaceId"
      @select-workspace="selectWorkspace"
      @create-workspace="createWorkspace"
    />
    <MainContent :workspace="selectedWorkspace" />
  </div>
</template>

<script>
import WorkspaceMainContent from "@/components/workspaces/WorkspaceMainContent.vue";
import WorkspacesSidebar from "@/components/workspaces/WorkspacesSidebar.vue";

export default {
  name: "WorkSpaces",
  components: {
    MainContent: WorkspaceMainContent,
    Sidebar: WorkspacesSidebar,
  },
  data() {
    return {
      workspaces: [
        { _id: "1", name: "Team Alpha", participants: ["user1", "user2"] },
        { _id: "2", name: "Project Beta", participants: ["user3", "user4"] },
      ],
      selectedWorkspaceId: null,
    };
  },
  computed: {
    selectedWorkspace() {
      return this.workspaces.find((w) => w._id === this.selectedWorkspaceId);
    },
  },
  methods: {
    selectWorkspace(workspace) {
      this.selectedWorkspaceId = workspace._id;
    },
    createWorkspace() {
      alert("Create Workspace functionality coming soon!");
    },
  },
};
</script>

<style>
#app {
  display: flex; /* Flexbox layout for sidebar and content */
  height: 100vh; /* Full viewport height */
  overflow: hidden; /* Prevent scrolling */
}

.sidebar {
  height: 100vh; /* Full height */
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
