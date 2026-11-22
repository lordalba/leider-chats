<template>
  <div class="workspaces-page">
    <Sidebar
      :workspaces="workspaces"
      :selectedWorkspaceId="workspaceId"
      :loading="loadingList"
      @select-workspace="selectWorkspace"
    />
    <MainContent :detail="detail" :members="members" @focus="setFocus" />
  </div>
</template>

<script>
import WorkspaceMainContent from "@/components/workspaces/WorkspaceMainContent.vue";
import WorkspacesSidebar from "@/components/workspaces/WorkspacesSidebar.vue";
import { fetchWorkspace, fetchWorkspaces } from "@/api/WorkspaceService";
import { emitWithAck, ensureSocket } from "@/workspaces/socketCall";

const REVOKED_MESSAGE = "You no longer have access to this workspace";

export default {
  name: "WorkSpaces",
  components: {
    MainContent: WorkspaceMainContent,
    Sidebar: WorkspacesSidebar,
  },
  data() {
    return {
      workspaces: [],
      loadingList: false,
      detail: null,
      members: [],
      // Workspace this socket has joined (and must leave on switch/destroy).
      joinedId: null,
      socket: null,
      // Bumped on every open so stale async results are dropped.
      openSeq: 0,
    };
  },
  computed: {
    workspaceId() {
      return this.$route.params.workspaceId || null;
    },
  },
  watch: {
    workspaceId(id) {
      this.openWorkspace(id);
    },
  },
  mounted() {
    this.socket = ensureSocket(this.$store);
    if (this.socket) {
      this.socket.on("connect", this.onConnect);
      this.socket.on("workspace:presence", this.onPresence);
      this.socket.on("workspace:updated", this.onUpdated);
      this.socket.on("workspace:revoked", this.onRevoked);
      this.socket.on("chat:workspaces-changed", this.loadList);
    }
    this.loadList();
    this.openWorkspace(this.workspaceId);
  },
  beforeDestroy() {
    if (this.socket) {
      this.socket.off("connect", this.onConnect);
      this.socket.off("workspace:presence", this.onPresence);
      this.socket.off("workspace:updated", this.onUpdated);
      this.socket.off("workspace:revoked", this.onRevoked);
      this.socket.off("chat:workspaces-changed", this.loadList);
    }
    this.leaveJoined();
    this.openSeq++;
  },
  methods: {
    async loadList() {
      this.loadingList = true;
      try {
        const response = await fetchWorkspaces();
        this.workspaces = response.data;
      } catch (error) {
        console.error("Failed to load workspaces:", error);
      } finally {
        this.loadingList = false;
      }
    },
    leaveJoined() {
      const id = this.joinedId;
      this.joinedId = null;
      if (id && this.socket) {
        emitWithAck(this.socket, "workspace:leave", id).catch((error) =>
          console.error("workspace:leave failed:", error)
        );
      }
    },
    async openWorkspace(id) {
      const seq = ++this.openSeq;
      if (this.joinedId && this.joinedId !== id) this.leaveJoined();
      this.detail = null;
      this.members = [];
      if (!id) return;

      try {
        const response = await fetchWorkspace(id);
        if (seq !== this.openSeq) return;
        this.detail = response.data;
      } catch (error) {
        if (seq !== this.openSeq) return;
        const status = error.response && error.response.status;
        if (status === 403 || status === 404) {
          this.denyAccess();
        } else {
          console.error("Failed to load workspace:", error);
          this.$toast.error("Could not load workspace");
        }
        return;
      }
      await this.join(id, seq);
    },
    async join(id, seq) {
      if (!this.socket) return;
      try {
        const { members } = await emitWithAck(this.socket, "workspace:join", id);
        if (seq !== this.openSeq) {
          // Switched away while joining: undo the join we just made, unless
          // the user is viewing this workspace again (A->B->A): a newer open
          // joins it too, and a late leave would drop that membership.
          if (this.workspaceId !== id && this.joinedId !== id) {
            emitWithAck(this.socket, "workspace:leave", id).catch(() => {});
          }
          return;
        }
        this.joinedId = id;
        this.members = members;
      } catch (error) {
        if (seq !== this.openSeq) return;
        if (error.message === "forbidden" || error.message === "not_found") {
          this.denyAccess();
        } else {
          console.error("workspace:join failed:", error);
        }
      }
    },
    denyAccess() {
      this.joinedId = null;
      this.detail = null;
      this.members = [];
      this.$toast.error(REVOKED_MESSAGE);
      if (this.workspaceId) {
        this.$router.push("/workspaces").catch(() => {});
      }
      this.loadList();
    },
    selectWorkspace(workspace) {
      if (workspace._id !== this.workspaceId) {
        this.$router.push(`/workspaces/${workspace._id}`).catch(() => {});
      }
    },
    setFocus(focus) {
      if (!this.socket || !this.joinedId) return;
      emitWithAck(this.socket, "workspace:focus", this.joinedId, focus).catch(
        (error) => console.error("workspace:focus failed:", error)
      );
    },
    onConnect() {
      // Presence is per socket connection; re-join after a reconnect.
      if (this.workspaceId && this.detail) {
        this.join(this.workspaceId, this.openSeq);
      }
    },
    onPresence(payload) {
      if (!payload || String(payload.workspaceId) !== this.workspaceId) return;
      this.members = payload.members || [];
    },
    onUpdated(workspace) {
      if (!workspace || String(workspace._id) !== this.workspaceId) return;
      if (this.detail) {
        this.detail = { ...this.detail, workspace };
      }
      this.workspaces = this.workspaces.map((w) =>
        w._id === workspace._id ? { ...w, ...workspace } : w
      );
    },
    onRevoked(payload) {
      if (!payload || String(payload.workspaceId) !== this.workspaceId) return;
      // The server already removed us from the rooms; no leave needed.
      this.openSeq++;
      this.denyAccess();
    },
  },
};
</script>

<style scoped>
.workspaces-page {
  display: flex; /* Flexbox layout for sidebar and content */
  height: 100vh; /* Full viewport height */
  overflow: hidden; /* Prevent scrolling */
}
</style>
