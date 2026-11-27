<template>
  <div class="workspaces-page ws-scope">
    <Sidebar
      :workspaces="workspaces"
      :selectedWorkspaceId="workspaceId"
      :loading="loadingList"
      @select-workspace="selectWorkspace"
    />
    <MainContent
      :detail="detail"
      :members="members"
      @focus="setFocus"
      @item-event="applyItemEvent"
    />
  </div>
</template>

<script>
import WorkspaceMainContent from "@/components/workspaces/WorkspaceMainContent.vue";
import WorkspacesSidebar from "@/components/workspaces/WorkspacesSidebar.vue";
import { fetchWorkspace, fetchWorkspaces } from "@/api/WorkspaceService";
import { emitWithAck, ensureSocket } from "@/workspaces/socketCall";
import { applyItemEvent as applyListEvent } from "@/workspaces/taskBoard";
import { handleSessionExpired } from "@/auth/session";

const REVOKED_MESSAGE = "You no longer have access to this workspace";
// workspace:item kind -> list on the workspace detail.
const ITEM_LISTS = { task: "tasks", document: "documents", whiteboard: "whiteboards" };

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
      // Non-null while a snapshot is loading: item events received after the
      // join, replayed once the snapshot arrives.
      pendingEvents: null,
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
      this.socket.on("workspace:item", this.onItem);
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
      this.socket.off("workspace:item", this.onItem);
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
      this.pendingEvents = null;
      if (!id) return;
      await this.loadWorkspace(id, seq);
    },
    // Join the rooms first, then take the REST snapshot, then replay the
    // workspace:item events that arrived during the fetch (last-write-wins by
    // updatedAt makes the replay safe). Used on open and after a reconnect.
    async loadWorkspace(id, seq) {
      this.pendingEvents = [];
      const joined = await this.join(id, seq);
      if (joined === "stale" || joined === "denied") return;

      let response;
      try {
        response = await fetchWorkspace(id);
      } catch (error) {
        if (seq !== this.openSeq) return;
        this.pendingEvents = null;
        const status = error.response && error.response.status;
        if (status === 401) {
          handleSessionExpired();
        } else if (status === 403 || status === 404) {
          this.denyAccess();
        } else {
          console.error("Failed to load workspace:", error);
          this.$toast.error("Could not load workspace");
        }
        return;
      }
      if (seq !== this.openSeq) return;
      const buffered = this.pendingEvents || [];
      this.pendingEvents = null;
      this.detail = response.data;
      buffered.forEach((event) => this.applyItemEvent(event));
    },
    // Resolves "ok" | "failed" (snapshot still worth loading) | "stale" |
    // "denied" (access refused or session expired: stop).
    async join(id, seq) {
      if (!this.socket) return "failed";
      try {
        const { members } = await emitWithAck(this.socket, "workspace:join", id);
        if (seq !== this.openSeq) {
          // Switched away while joining: undo the join we just made, unless
          // the user is viewing this workspace again (A->B->A): a newer open
          // joins it too, and a late leave would drop that membership.
          if (this.workspaceId !== id && this.joinedId !== id) {
            emitWithAck(this.socket, "workspace:leave", id).catch(() => {});
          }
          return "stale";
        }
        this.joinedId = id;
        this.members = members;
        return "ok";
      } catch (error) {
        if (seq !== this.openSeq) return "stale";
        if (error.message === "unauthenticated") {
          this.pendingEvents = null;
          handleSessionExpired();
          return "denied";
        }
        if (error.message === "forbidden" || error.message === "not_found") {
          this.denyAccess();
          return "denied";
        }
        console.error("workspace:join failed:", error);
        return "failed";
      }
    },
    denyAccess() {
      this.joinedId = null;
      this.pendingEvents = null;
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
      // Rooms and presence are per socket connection, and broadcasts sent
      // while disconnected are lost: after a reconnect, re-join and resync
      // (one join per reconnect). The stale snapshot stays visible meanwhile.
      // With no detail yet the initial open is still in flight and its
      // buffered join is sent on this connection.
      if (!this.workspaceId || !this.detail) return;
      const seq = ++this.openSeq;
      this.joinedId = null;
      this.loadWorkspace(this.workspaceId, seq);
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
    onItem(payload) {
      if (!payload || String(payload.workspaceId) !== this.workspaceId) return;
      this.applyItemEvent(payload);
    },
    applyItemEvent(event) {
      // Used for broadcasts, acks and optimistic updates alike: upsert by _id
      // (older updatedAt ignored), so the sender's copies never duplicate.
      // Task board events carry no kind.
      if (!event || !event.item) return;
      const list = ITEM_LISTS[event.kind || "task"];
      if (!list) return;
      if (this.pendingEvents) {
        // A snapshot is being fetched; replayed on top of it once it lands.
        this.pendingEvents.push(event);
        return;
      }
      if (!this.detail) return;
      const owner = event.item.workspace;
      if (owner && String(owner) !== String(this.detail.workspace._id)) return;
      this.detail = {
        ...this.detail,
        [list]: applyListEvent(this.detail[list] || [], event),
      };
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
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0; /* fills .main-content (App.vue fullHeight); panes scroll */
  overflow: hidden;
}
</style>
