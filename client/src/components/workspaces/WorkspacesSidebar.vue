<template>
  <nav class="workspaces-sidebar" aria-label="Workspaces">
    <div class="sidebar-head">
      <h2 class="sidebar-title">Workspaces</h2>
      <b-button
        size="sm"
        variant="primary"
        class="sidebar-new"
        aria-label="New workspace"
        title="New workspace"
        @click="$emit('create')"
      >
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
      </b-button>
    </div>

    <div v-if="workspaces.length > SEARCH_FROM" class="sidebar-search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input
        v-model="query"
        type="search"
        class="form-control form-control-sm"
        placeholder="Search workspaces"
        aria-label="Search workspaces"
      />
    </div>

    <p v-if="loading && !workspaces.length" class="sidebar-hint">Loading…</p>
    <p v-else-if="!workspaces.length" class="sidebar-hint">
      No workspaces yet. Start one with the + button.
    </p>
    <p v-else-if="!groups.length" class="sidebar-hint">No workspaces match “{{ query.trim() }}”.</p>

    <section v-for="group in groups" :key="group.chatRoomId" class="chat-group">
      <h3 class="chat-group-name" :title="group.chatName">{{ group.chatName || "Chat" }}</h3>
      <ul class="workspace-list">
        <li v-for="workspace in group.workspaces" :key="workspace._id">
          <router-link
            :to="pathFor(workspace)"
            class="workspace-row"
            :class="{ active: selectedWorkspaceId === String(workspace._id) }"
            :aria-current="selectedWorkspaceId === String(workspace._id) ? 'page' : null"
            :title="workspace.name"
          >
            <span class="workspace-name">{{ workspace.name }}</span>
            <span
              v-if="workspace.description"
              class="workspace-description"
              :title="workspace.description"
            >
              {{ workspace.description }}
            </span>
          </router-link>
        </li>
      </ul>
    </section>
  </nav>
</template>

<script>
import { groupWorkspaces } from "@/workspaces/workspaceList";
import { workspacePath } from "@/workspaces/workspaceRoute";

// Show the search box once the list is long enough to need it.
const SEARCH_FROM = 5;

export default {
  name: "WorkspacesSidebar",
  props: {
    workspaces: {
      type: Array,
      default: () => [],
    },
    selectedWorkspaceId: String,
    loading: Boolean,
  },
  data() {
    return { query: "", SEARCH_FROM };
  },
  computed: {
    groups() {
      return groupWorkspaces(this.workspaces, this.query);
    },
  },
  methods: {
    pathFor(workspace) {
      return workspacePath({ workspaceId: String(workspace._id) });
    },
  },
};
</script>

<style scoped>
.workspaces-sidebar {
  width: 280px;
  flex-shrink: 0;
  padding: var(--ws-space-4) var(--ws-space-3);
  overflow-y: auto;
  background: var(--ws-surface-muted);
  border-right: 1px solid var(--ws-border);
}
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ws-space-2);
  padding: 0 var(--ws-space-1);
  margin-bottom: var(--ws-space-3);
}
.sidebar-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.sidebar-new {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: var(--ws-radius-sm);
}
.sidebar-search {
  position: relative;
  margin-bottom: var(--ws-space-3);
}
.sidebar-search i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ws-text-muted);
  font-size: 12px;
  pointer-events: none;
}
.sidebar-search input {
  padding-left: 28px;
}
.sidebar-hint {
  padding: 0 var(--ws-space-1);
  color: var(--ws-text-muted);
  font-size: 14px;
}
.chat-group {
  margin-bottom: var(--ws-space-4);
}
.chat-group-name {
  margin: 0 0 var(--ws-space-1);
  padding: 0 var(--ws-space-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ws-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.workspace-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.workspace-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 7px var(--ws-space-2) 7px 10px;
  border-left: 3px solid transparent;
  border-radius: var(--ws-radius-sm);
  color: var(--ws-text);
  text-decoration: none;
}
.workspace-row:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--ws-text);
}
.workspace-row.active {
  background: var(--ws-accent-soft);
  border-left-color: var(--ws-accent);
  color: var(--ws-accent-strong);
}
.workspace-name,
.workspace-description {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.workspace-name {
  font-weight: 500;
}
.workspace-row.active .workspace-name {
  font-weight: 600;
}
.workspace-description {
  font-size: 12px;
  color: var(--ws-text-muted);
}
</style>
