<template>
  <div class="chat-workspaces">
    <div class="chat-workspaces-header">
      <h5>Workspaces</h5>
      <button class="new-workspace-btn" @click="openCreate">
        <i class="fa-solid fa-plus"></i> New workspace
      </button>
    </div>
    <p v-if="loading" class="chat-workspaces-empty">Loading…</p>
    <p v-else-if="workspaces.length === 0" class="chat-workspaces-empty">
      No workspaces yet
    </p>
    <ul v-else class="chat-workspaces-list">
      <li
        v-for="workspace in workspaces"
        :key="workspace._id"
        class="chat-workspace-item"
        @click="openWorkspace(workspace._id)"
      >
        <i class="fa-solid fa-table-columns"></i>
        {{ workspace.name }}
      </li>
    </ul>
    <CreateWorkspaceModal
      :visible.sync="showCreate"
      :chatroom-id="chatroomId"
      :socket="socket"
      @created="onCreated"
    />
  </div>
</template>

<script>
import { fetchWorkspaces } from "@/api/WorkspaceService";
import { ensureSocket } from "@/workspaces/socketCall";
import CreateWorkspaceModal from "@/components/workspaces/CreateWorkspaceModal.vue";

export default {
  name: "ChatWorkspaces",
  components: {
    CreateWorkspaceModal,
  },
  props: {
    chatroomId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      workspaces: [],
      loading: false,
      showCreate: false,
      socket: null,
    };
  },
  mounted() {
    this.socket = ensureSocket(this.$store);
    if (this.socket) {
      this.socket.on("chat:workspaces-changed", this.onWorkspacesChanged);
    }
  },
  beforeDestroy() {
    if (this.socket) {
      this.socket.off("chat:workspaces-changed", this.onWorkspacesChanged);
    }
  },
  watch: {
    chatroomId: {
      immediate: true,
      handler() {
        this.workspaces = [];
        this.load();
      },
    },
  },
  methods: {
    async load() {
      const chatroomId = this.chatroomId;
      if (!chatroomId) return;
      this.loading = true;
      try {
        const response = await fetchWorkspaces(chatroomId);
        if (chatroomId === this.chatroomId) this.workspaces = response.data;
      } catch (error) {
        console.error("Failed to load workspaces:", error);
      } finally {
        if (chatroomId === this.chatroomId) this.loading = false;
      }
    },
    onWorkspacesChanged(payload) {
      if (payload && String(payload.chatRoomId) === String(this.chatroomId)) {
        this.load();
      }
    },
    openCreate() {
      this.socket = ensureSocket(this.$store);
      this.showCreate = true;
    },
    onCreated(workspace) {
      this.openWorkspace(workspace._id);
    },
    openWorkspace(id) {
      this.$router.push(`/workspaces/${id}`);
    },
  },
};
</script>

<style scoped>
.chat-workspaces {
  margin-bottom: 8%;
  padding-bottom: 4%;
  border-bottom: 1px solid rgb(223, 223, 223);
}
.chat-workspaces-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.chat-workspaces-header h5 {
  margin: 0;
}
.new-workspace-btn {
  background-color: #45815c;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 4px 10px;
  font-size: 0.9em;
  cursor: pointer;
}
.chat-workspaces-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.chat-workspace-item {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.chat-workspace-item:hover {
  background-color: #e6e5e5;
}
.chat-workspaces-empty {
  opacity: 0.6;
  text-align: center;
}
</style>
