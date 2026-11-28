<template>
  <header class="ws-header">
    <router-link to="/workspaces" class="ws-back" aria-label="All workspaces">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Workspaces
    </router-link>
    <div class="ws-header-text">
      <h1 class="ws-header-name" :title="workspace.name">{{ workspace.name }}</h1>
      <p
        v-if="workspace.description"
        class="ws-header-description"
        :title="workspace.description"
      >
        {{ workspace.description }}
      </p>
      <router-link v-if="chatName" to="/chatrooms" class="ws-header-chat">
        <i class="fa-solid fa-comments" aria-hidden="true"></i> in {{ chatName }}
      </router-link>
    </div>
    <div class="ws-header-actions">
      <PresenceBar :members="members" :meId="meId" :detail="detail" />
      <b-dropdown
        right
        no-caret
        variant="link"
        size="sm"
        toggle-class="ws-header-menu"
        aria-label="Workspace settings"
      >
        <template #button-content>
          <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
          <span class="sr-only">Workspace settings</span>
        </template>
        <b-dropdown-item-button @click="showEdit = true">
          <i class="fa-solid fa-pen fa-fw" aria-hidden="true"></i> Rename and describe…
        </b-dropdown-item-button>
        <template v-if="canDelete">
          <b-dropdown-divider />
          <b-dropdown-item-button variant="danger" @click="confirmDelete">
            <i class="fa-solid fa-trash fa-fw" aria-hidden="true"></i> Delete workspace…
          </b-dropdown-item-button>
        </template>
      </b-dropdown>
    </div>
    <CreateWorkspaceModal :visible.sync="showEdit" :socket="socket" :workspace="workspace" />
  </header>
</template>

<script>
import PresenceBar from "@/components/workspaces/PresenceBar.vue";
import CreateWorkspaceModal from "@/components/workspaces/CreateWorkspaceModal.vue";
import { canDeleteWorkspace } from "@/workspaces/permissions";
import { confirmDanger } from "@/workspaces/confirm";

// Name, description, chat, who's here, and the workspace's settings menu.
// Renames come back to everyone through workspace:updated; deleting is
// emitted as `delete` for the page to carry out.
export default {
  name: "WorkspaceHeader",
  components: { PresenceBar, CreateWorkspaceModal },
  props: {
    detail: { type: Object, required: true },
    members: { type: Array, default: () => [] },
    meId: { type: String, default: null },
  },
  data() {
    return { showEdit: false };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    workspace() {
      return this.detail.workspace;
    },
    chatName() {
      return this.detail.chat && this.detail.chat.name;
    },
    canDelete() {
      return canDeleteWorkspace(this.detail, this.meId);
    },
  },
  methods: {
    async confirmDelete() {
      const ok = await confirmDanger(this.$bvModal, {
        title: `Delete “${this.workspace.name}”?`,
        message: "Its tasks, documents and whiteboards will be deleted for everyone.",
        okTitle: "Delete workspace",
      });
      if (ok) this.$emit("delete", String(this.workspace._id));
    },
  },
};
</script>

<style scoped>
.ws-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ws-space-4);
  margin-bottom: var(--ws-space-3);
}
.ws-header-text {
  min-width: 0;
}
.ws-header-name {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-header-description {
  margin: var(--ws-space-1) 0 0;
  color: var(--ws-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ws-header-chat {
  display: inline-block;
  text-decoration: none;
  margin-top: var(--ws-space-1);
  font-size: 13px;
  color: var(--ws-text-muted);
}
.ws-header-chat:hover {
  color: var(--ws-accent-strong);
}
.ws-header-actions {
  display: flex;
  align-items: center;
  gap: var(--ws-space-2);
  flex-shrink: 0;
}
.ws-header-actions ::v-deep .ws-header-menu {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  color: var(--ws-text-muted);
}
.ws-header-actions ::v-deep .ws-header-menu:hover {
  background: var(--ws-surface-muted);
  color: var(--ws-text);
}

.ws-back {
  display: none;
}
@media (max-width: 767.98px) {
  .ws-header {
    flex-wrap: wrap;
    gap: var(--ws-space-2);
  }
  .ws-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    font-size: 14px;
    color: var(--ws-accent-strong);
    text-decoration: none;
  }
  .ws-header-text {
    flex: 1;
  }
  .ws-header-name {
    font-size: 20px;
  }
}
</style>
