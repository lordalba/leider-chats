<template>
  <div class="main-content">
    <div v-if="detail">
      <div class="workspace-header">
        <div>
          <h2>{{ detail.workspace.name }}</h2>
          <p v-if="detail.workspace.description" class="workspace-description">
            {{ detail.workspace.description }}
          </p>
          <small v-if="detail.chat && detail.chat.name" class="workspace-chat">
            in {{ detail.chat.name }}
          </small>
        </div>
        <PresenceBar :members="members" />
      </div>
      <Tabs :tabs="tabs" @change-tab="setActiveTab" />
      <!-- Placeholders: Tasks 7, 11 and 13 replace these, receiving `members`
           as a prop and emitting `focus` upward. -->
      <div v-if="activeTab === 'Tasks'" class="tab-placeholder">
        Tasks are coming soon.
      </div>
      <div v-else-if="activeTab === 'Documents'" class="tab-placeholder">
        Documents are coming soon.
      </div>
      <div v-else-if="activeTab === 'Whiteboard'" class="tab-placeholder">
        The whiteboard is coming soon.
      </div>
    </div>
    <EmptyState v-else />
  </div>
</template>

<script>
import EmptyState from "@/components/workspaces/EmptyState.vue";
import Tabs from "@/components/workspaces/Tabs.vue";
import PresenceBar from "@/components/workspaces/PresenceBar.vue";

const TABS = ["Tasks", "Documents", "Whiteboard"];

export default {
  name: "WorkspaceMainContent",
  props: {
    detail: {
      type: Object,
      default: null,
    },
    members: {
      type: Array,
      default: () => [],
    },
  },
  components: {
    Tabs,
    EmptyState,
    PresenceBar,
  },
  data() {
    return {
      tabs: TABS,
      activeTab: TABS[0],
    };
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab;
      // Switching tabs drops any item-level focus; the tabs-to-be emit
      // `focus` with {kind, id} when the user opens an item.
      this.$emit("focus", null);
    },
  },
};
</script>

<style scoped>
.main-content {
  flex: 1;
  padding: 20px;
  height: 100vh;
  overflow-y: auto;
}
.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.workspace-description {
  color: #555;
  margin: 4px 0;
}
.workspace-chat {
  color: gray;
}
.tab-placeholder {
  color: gray;
  padding: 40px;
  text-align: center;
}
</style>
