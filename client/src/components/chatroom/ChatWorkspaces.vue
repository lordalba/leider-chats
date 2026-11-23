<template>
  <div class="chat-workspaces">
    <div class="header">
      <h5>Workspaces</h5>
      <button class="new-btn" @click="showCreate = true">
        <i class="fa-solid fa-plus"></i> New
      </button>
    </div>
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="workspaces.length === 0" class="muted">
      No workspaces yet. Create one to plan tasks, write docs and sketch together.
    </p>
    <ul v-else>
      <li v-for="workspace in workspaces" :key="workspace._id" @click="open(workspace._id)">
        <i class="fa-solid fa-layer-group"></i>
        <span class="name">{{ workspace.name }}</span>
        <i class="fa-solid fa-chevron-right go"></i>
      </li>
    </ul>
    <CreateWorkspaceModal :visible.sync="showCreate" :chatroom-id="chatroomId" @created="onCreated" />
  </div>
</template>

<script>
import { fetchWorkspaces } from "@/api/WorkspaceService";
import CreateWorkspaceModal from "@/components/workspaces/CreateWorkspaceModal.vue";

export default {
  name: "ChatWorkspaces",
  components: { CreateWorkspaceModal },
  props: {
    chatroomId: { type: String, required: true },
  },
  data() {
    return { workspaces: [], loading: true, showCreate: false };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
  watch: {
    chatroomId() {
      this.load();
    },
  },
  mounted() {
    this.load();
    if (this.socket) this.socket.on("chat:workspaces-changed", this.onChanged);
  },
  beforeDestroy() {
    if (this.socket) this.socket.off("chat:workspaces-changed", this.onChanged);
  },
  methods: {
    async load() {
      if (!this.chatroomId) return;
      try {
        const response = await fetchWorkspaces(this.chatroomId);
        this.workspaces = response.data;
      } catch (err) {
        console.error("Failed to load workspaces", err);
        this.workspaces = [];
      } finally {
        this.loading = false;
      }
    },
    onChanged(data) {
      if (data && data.chatRoomId === this.chatroomId) this.load();
    },
    onCreated(workspace) {
      this.open(workspace._id);
    },
    open(workspaceId) {
      this.$router.push(`/workspaces/${workspaceId}`);
    },
  },
};
</script>

<style scoped>
.chat-workspaces {
  margin-bottom: 8%;
  padding-bottom: 4%;
  border-bottom: 1px solid rgb(155, 154, 154);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.header h5 {
  margin: 0;
}
.new-btn {
  background-color: #45815c;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 4px 10px;
  cursor: pointer;
}
.muted {
  color: gray;
  font-size: 0.9em;
  text-align: left !important;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  cursor: pointer;
  border-radius: 6px;
}
li:hover {
  background-color: #e6e5e5;
}
.name {
  flex: 1;
}
.go {
  color: gray;
  font-size: 0.8em;
}
</style>
