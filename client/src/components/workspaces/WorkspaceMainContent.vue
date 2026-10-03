<template>
  <div class="main-content">
    <h2 v-if="workspace">{{ workspace.name }}</h2>
    <div v-if="workspace">
      <Tabs
        :tabs="['Documents', 'Tasks', 'Whiteboard']"
        @change-tab="setActiveTab"
      />
      <div v-if="activeTab === 'Documents'">Documents Section</div>
      <div v-else-if="activeTab === 'Tasks'">Tasks Section</div>
      <div v-else-if="activeTab === 'Whiteboard'">Whiteboard Section</div>
    </div>
    <EmptyState v-else />
  </div>
</template>

<script>
import EmptyState from "@/components/workspaces/EmptyState.vue";
import Tabs from "@/components/workspaces/Tabs.vue";

export default {
  props: {
    workspace: Object,
  },
  components: {
    Tabs,
    EmptyState,
  },
  data() {
    return {
      activeTab: "Documents",
    };
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab;
    },
  },
};
</script>

<style scoped>
.main-content {
  flex: 1;
  padding: 20px;
  height: 100vh;
}
</style>
