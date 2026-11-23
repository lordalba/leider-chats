<template>
  <div class="main-content">
    <EmptyState v-if="!detail" />
    <template v-else>
      <div class="workspace-header">
        <router-link
          :to="{ path: '/chatrooms', query: { chat: String(detail.chat._id) } }"
          class="back-to-chat"
          :title="`Back to ${detail.chat.name}`"
        >
          <i class="fa-solid fa-arrow-left"></i> Back to chat
        </router-link>
        <div class="heading">
          <h2>{{ detail.workspace.name }}</h2>
          <p class="subtitle">
            <i class="fa-regular fa-comments"></i> {{ detail.chat.name }}
            <span v-if="detail.workspace.description"> · {{ detail.workspace.description }}</span>
          </p>
        </div>
        <PresenceBar :members="members" />
        <b-dropdown v-if="canManage" right variant="link" toggle-class="text-decoration-none" no-caret>
          <template #button-content><i class="fa-solid fa-ellipsis-vertical"></i></template>
          <b-dropdown-item @click="renameWorkspace">Rename</b-dropdown-item>
          <b-dropdown-item variant="danger" @click="confirmDelete = true">Delete workspace</b-dropdown-item>
        </b-dropdown>
      </div>

      <Tabs :key="workspaceId" :tabs="tabs" @change-tab="setActiveTab" />

      <TaskBoard
        v-if="activeTab === 'Tasks'"
        :workspace-id="workspaceId"
        :tasks="detail.tasks"
        :participants="detail.chat.participants"
        :members="members"
        @focus="(f) => $emit('focus', f)"
        @local-update="(task) => $emit('item-event', { kind: 'task', action: 'updated', item: task })"
      />

      <div v-else-if="activeTab === 'Documents'" class="split">
        <ItemList
          kind="document"
          :items="detail.documents"
          :members="members"
          :selected-id="selectedDocId"
          @select="selectDoc"
          @create="(title) => createItem('doc', title)"
          @rename="(id, title) => renameItem('doc', id, title)"
          @delete="(id) => deleteItem('doc', id)"
        />
        <DocumentEditor
          v-if="selectedDocId"
          :key="selectedDocId"
          :doc-id="selectedDocId"
          :connected-user="connectedUser"
        />
        <div v-else class="placeholder">Pick a document or create a new one.</div>
      </div>

      <div v-else-if="activeTab === 'Whiteboard'" class="split">
        <ItemList
          kind="whiteboard"
          :items="detail.whiteboards"
          :members="members"
          :selected-id="selectedWbId"
          @select="selectWb"
          @create="(title) => createItem('wb', title)"
          @rename="(id, title) => renameItem('wb', id, title)"
          @delete="(id) => deleteItem('wb', id)"
        />
        <WhiteboardCanvas
          v-if="selectedWb"
          :key="selectedWbId"
          :whiteboard-id="selectedWbId"
          :connected-user="connectedUser"
          :created-by="String(selectedWb.createdBy)"
          :chat-admins="detail.chat.admins || []"
        />
        <div v-else class="placeholder">Pick a whiteboard or create a new one.</div>
      </div>

      <ConfirmationModal
        v-if="confirmDelete"
        title="Delete workspace"
        description="This deletes the workspace and all of its tasks, documents and whiteboards for everyone."
        confirm-text="Delete"
        cancel-text="Cancel"
        :on-confirm="deleteWorkspace"
        :on-cancel="() => (confirmDelete = false)"
      />
    </template>
  </div>
</template>

<script>
import Swal from "sweetalert2";
import EmptyState from "@/components/workspaces/EmptyState.vue";
import Tabs from "@/components/workspaces/Tabs.vue";
import PresenceBar from "@/components/workspaces/PresenceBar.vue";
import ItemList from "@/components/workspaces/ItemList.vue";
import TaskBoard from "@/components/workspaces/tasks/TaskBoard.vue";
import DocumentEditor from "@/components/workspaces/documents/DocumentEditor.vue";
import WhiteboardCanvas from "@/components/workspaces/whiteboard/WhiteboardCanvas.vue";
import ConfirmationModal from "@/components/common/ConfirmationModal.vue";
import { emitWithAck, errorMessage } from "@/socket/socketCall";

export default {
  name: "WorkspaceMainContent",
  components: {
    Tabs,
    EmptyState,
    PresenceBar,
    ItemList,
    TaskBoard,
    DocumentEditor,
    WhiteboardCanvas,
    ConfirmationModal,
  },
  props: {
    detail: { type: Object, default: null },
    members: { type: Array, default: () => [] },
  },
  data() {
    return {
      tabs: ["Tasks", "Documents", "Whiteboard"],
      activeTab: "Tasks",
      selectedDocId: null,
      selectedWbId: null,
      confirmDelete: false,
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    connectedUser() {
      return this.$store.state.connectedUser;
    },
    workspaceId() {
      return this.detail ? String(this.detail.workspace._id) : "";
    },
    canManage() {
      if (!this.detail || !this.connectedUser) return false;
      const me = String(this.connectedUser._id);
      return String(this.detail.workspace.createdBy) === me || (this.detail.chat.admins || []).includes(me);
    },
    selectedWb() {
      if (!this.detail || !this.selectedWbId) return null;
      return this.detail.whiteboards.find((w) => String(w._id) === this.selectedWbId) || null;
    },
  },
  watch: {
    workspaceId() {
      this.activeTab = "Tasks";
      this.selectedDocId = null;
      this.selectedWbId = null;
    },
    "detail.documents"(docs) {
      if (this.selectedDocId && !(docs || []).some((d) => String(d._id) === this.selectedDocId)) {
        this.selectedDocId = null;
        this.$toast.info("The document you had open was deleted.");
        this.emitFocus();
      }
    },
    "detail.whiteboards"(wbs) {
      if (this.selectedWbId && !(wbs || []).some((w) => String(w._id) === this.selectedWbId)) {
        this.selectedWbId = null;
        this.$toast.info("The whiteboard you had open was deleted.");
        this.emitFocus();
      }
    },
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab;
      this.emitFocus();
    },
    /** Tells the others which item we are looking at on the current tab. */
    emitFocus() {
      let focus = null;
      if (this.activeTab === "Documents" && this.selectedDocId) focus = { kind: "document", id: this.selectedDocId };
      if (this.activeTab === "Whiteboard" && this.selectedWbId) focus = { kind: "whiteboard", id: this.selectedWbId };
      this.$emit("focus", focus);
    },
    selectDoc(id) {
      this.selectedDocId = id;
      this.emitFocus();
    },
    selectWb(id) {
      this.selectedWbId = id;
      this.emitFocus();
    },
    async createItem(prefix, title) {
      try {
        const meta = await emitWithAck(this.socket, `${prefix}:create`, this.workspaceId, title);
        if (prefix === "doc") this.selectDoc(String(meta._id));
        else this.selectWb(String(meta._id));
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
    async renameItem(prefix, id, title) {
      try {
        await emitWithAck(this.socket, `${prefix}:rename`, id, title);
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
    async deleteItem(prefix, id) {
      try {
        await emitWithAck(this.socket, `${prefix}:delete`, id);
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
    async renameWorkspace() {
      const { value, isConfirmed } = await Swal.fire({
        title: "Rename workspace",
        input: "text",
        inputValue: this.detail.workspace.name,
        inputAttributes: { maxlength: 80 },
        showCancelButton: true,
        confirmButtonText: "Rename",
      });
      if (!isConfirmed || !value || !value.trim()) return;
      try {
        await emitWithAck(this.socket, "workspace:rename", this.workspaceId, { name: value.trim() });
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
    async deleteWorkspace() {
      this.confirmDelete = false;
      try {
        await emitWithAck(this.socket, "workspace:delete", this.workspaceId);
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
  },
};
</script>

<style scoped>
.main-content {
  flex: 1;
  min-width: 0;
  padding: 20px;
  overflow-y: auto;
}
.workspace-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.heading {
  flex: 1;
  min-width: 0;
}
.back-to-chat {
  flex-shrink: 0;
  padding: 6px 12px;
  border: 1px solid #45815c;
  border-radius: 6px;
  color: #45815c;
  text-decoration: none;
  white-space: nowrap;
}
.back-to-chat:hover {
  background: #45815c;
  color: #fff;
}
.heading h2 {
  margin: 0;
}
.subtitle {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.9em;
}
.split {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.placeholder {
  flex: 1;
  color: var(--text-muted);
  text-align: center;
  padding: 60px 0;
}
</style>
