<template>
  <div class="workspaces-page">
    <div v-if="!connectedUser" class="login-needed">
      <h3>Workspaces</h3>
      <p>Log in to see the workspaces of your chats.</p>
      <router-link to="/login" class="login-btn">Log in</router-link>
    </div>
    <template v-else>
      <Sidebar
        :workspaces="workspaces"
        :selected-workspace-id="workspaceId"
        :loading="listLoading"
        @select-workspace="selectWorkspace"
      />
      <div v-if="detailLoading && !detail" class="loading">
        <i class="fa-solid fa-spinner fa-spin"></i> Opening workspace…
      </div>
      <MainContent
        v-else
        :detail="detail"
        :members="members"
        @focus="setFocus"
        @item-event="applyEvent"
      />
    </template>
  </div>
</template>

<script>
import WorkspaceMainContent from "@/components/workspaces/WorkspaceMainContent.vue";
import WorkspacesSidebar from "@/components/workspaces/WorkspacesSidebar.vue";
import { fetchWorkspace, fetchWorkspaces } from "@/api/WorkspaceService";
import { emitWithAck, errorMessage } from "@/socket/socketCall";
import { applyItemEvent } from "@/workspaces/taskBoard";

const LIST_BY_KIND = { task: "tasks", document: "documents", whiteboard: "whiteboards" };

export default {
  name: "WorkSpaces",
  components: {
    MainContent: WorkspaceMainContent,
    Sidebar: WorkspacesSidebar,
  },
  data() {
    return {
      workspaces: [],
      listLoading: true,
      detail: null,
      detailLoading: false,
      members: [],
      joinedId: null,
    };
  },
  computed: {
    connectedUser() {
      return this.$store.state.connectedUser;
    },
    socket() {
      return this.$store.getters["socket/socket"];
    },
    workspaceId() {
      return this.$route.params.workspaceId || null;
    },
  },
  watch: {
    workspaceId(id) {
      this.open(id);
    },
  },
  mounted() {
    if (!this.connectedUser) return;
    this.socketHandlers = {
      "workspace:presence": (p) => {
        if (p.workspaceId === this.joinedId) this.members = p.members;
      },
      "workspace:updated": (workspace) => {
        if (this.detail && String(workspace._id) === this.joinedId) {
          this.detail = { ...this.detail, workspace };
        }
      },
      "workspace:revoked": ({ workspaceId }) => {
        this.loadList();
        if (workspaceId === this.workspaceId) {
          this.joinedId = null;
          this.$toast.warning("You no longer have access to this workspace");
          this.$router.push("/workspaces");
        }
      },
      "workspace:item": (event) => {
        if (event.workspaceId === this.joinedId) this.applyEvent(event);
      },
      "chat:workspaces-changed": () => this.loadList(),
      // After a reconnect the server has forgotten our rooms: join again and catch up.
      connect: () => {
        if (this.workspaceId) this.open(this.workspaceId);
      },
    };
    if (this.socket) {
      Object.entries(this.socketHandlers).forEach(([event, fn]) => this.socket.on(event, fn));
    }
    this.loadList();
    if (this.workspaceId) this.open(this.workspaceId);
  },
  beforeDestroy() {
    this.leave();
    if (this.socket && this.socketHandlers) {
      Object.entries(this.socketHandlers).forEach(([event, fn]) => this.socket.off(event, fn));
    }
  },
  methods: {
    async loadList() {
      try {
        const response = await fetchWorkspaces();
        this.workspaces = response.data;
      } catch (err) {
        console.error("Failed to load workspaces", err);
      } finally {
        this.listLoading = false;
      }
    },
    leave() {
      if (this.joinedId && this.socket) {
        emitWithAck(this.socket, "workspace:leave", this.joinedId).catch(() => {});
      }
      this.joinedId = null;
      this.members = [];
    },
    async open(id) {
      if (id !== this.joinedId) this.leave();
      if (!id) {
        this.detail = null;
        return;
      }
      if (!this.detail || String(this.detail.workspace._id) !== id) this.detail = null;
      this.detailLoading = true;
      try {
        const response = await fetchWorkspace(id);
        if (id !== this.workspaceId) return; // the user navigated away meanwhile
        this.detail = response.data;
        const { members } = await emitWithAck(this.socket, "workspace:join", id);
        if (id !== this.workspaceId) return;
        this.joinedId = id;
        this.members = members;
      } catch (err) {
        if (id !== this.workspaceId) return;
        const status = err.response && err.response.status;
        const code = status === 403 ? "forbidden" : status === 404 ? "not_found" : err.message;
        this.$toast.error(errorMessage(new Error(code)));
        this.detail = null;
        this.$router.push("/workspaces").catch(() => {});
      } finally {
        this.detailLoading = false;
      }
    },
    selectWorkspace(workspace) {
      if (workspace._id !== this.workspaceId) this.$router.push(`/workspaces/${workspace._id}`);
    },
    applyEvent(event) {
      const key = LIST_BY_KIND[event.kind];
      if (!this.detail || !key) return;
      this.detail = { ...this.detail, [key]: applyItemEvent(this.detail[key], event) };
    },
    setFocus(focus) {
      if (!this.joinedId) return;
      emitWithAck(this.socket, "workspace:focus", this.joinedId, focus).catch(() => {});
    },
  },
};
</script>

<style scoped>
.workspaces-page {
  display: flex;
  height: calc(100vh - 71px);
  min-height: 500px;
  overflow: hidden;
}
.login-needed {
  margin: 60px auto;
  text-align: center;
}
.login-btn {
  display: inline-block;
  margin-top: 10px;
  padding: 8px 18px;
  background-color: #45815c;
  color: white;
  border-radius: 5px;
  text-decoration: none;
}
.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}
</style>
