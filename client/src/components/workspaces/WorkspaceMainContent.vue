<template>
  <div class="workspace-main">
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
      <TaskBoard
        v-if="activeTab === 'Tasks'"
        :tasks="detail.tasks || []"
        :participants="(detail.chat && detail.chat.participants) || []"
        :members="members"
        :workspaceId="String(detail.workspace._id)"
        @focus="(focus) => $emit('focus', focus)"
        @item-event="(event) => $emit('item-event', event)"
      />
      <div v-else-if="activeTab === 'Documents'" class="items-tab">
        <ItemList
          kind="document"
          :items="detail.documents || []"
          :members="members"
          :selectedId="selectedDocId"
          @select="selectDocument"
          @create="(title) => createItem('document', title)"
          @rename="(id, title) => renameItem('document', id, title)"
          @delete="(id) => deleteItem('document', id)"
        />
        <DocumentEditor
          v-if="selectedDoc"
          :key="selectedDocId"
          :docId="selectedDocId"
          :connectedUser="connectedUser"
          @closed="selectDocument(null)"
        />
        <div v-else class="tab-placeholder items-placeholder">
          Pick a document, or create one.
        </div>
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
import TaskBoard from "@/components/workspaces/tasks/TaskBoard.vue";
import ItemList from "@/components/workspaces/ItemList.vue";
import DocumentEditor from "@/components/workspaces/documents/DocumentEditor.vue";
import { emitWithAck } from "@/workspaces/socketCall";
import { itemErrorMessage } from "@/workspaces/items";

const TABS = ["Tasks", "Documents", "Whiteboard"];
// Socket event prefix and detail list per item kind.
const ITEM_KINDS = {
  document: { prefix: "doc", list: "documents" },
  whiteboard: { prefix: "wb", list: "whiteboards" },
};

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
    TaskBoard,
    ItemList,
    DocumentEditor,
  },
  data() {
    return {
      tabs: TABS,
      activeTab: TABS[0],
      selectedDocId: null,
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    connectedUser() {
      return this.$store.state.connectedUser || null;
    },
    workspaceId() {
      return this.detail ? String(this.detail.workspace._id) : null;
    },
    selectedDoc() {
      if (!this.detail || !this.selectedDocId) return null;
      return (
        (this.detail.documents || []).find((d) => String(d._id) === this.selectedDocId) ||
        null
      );
    },
  },
  watch: {
    workspaceId() {
      // Another workspace: start on its task board with nothing open.
      this.selectedDocId = null;
      this.activeTab = TABS[0];
    },
    selectedDoc(doc, previous) {
      // The open document was deleted (here or by someone else).
      if (!doc && previous && this.selectedDocId) {
        this.$toast.info(itemErrorMessage("not_found", "document"));
        this.selectDocument(null);
      }
    },
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab;
      this.selectedDocId = null;
      // Switching tabs drops any item-level focus; the tabs-to-be emit
      // `focus` with {kind, id} when the user opens an item.
      this.$emit("focus", null);
    },
    selectDocument(id) {
      this.selectedDocId = id || null;
      this.$emit("focus", id ? { kind: "document", id } : null);
    },
    // Resolves { data } on success, null (after a toast) on failure.
    async callItem(kind, action, ...args) {
      if (!this.socket) {
        this.$toast.error(itemErrorMessage("timeout", kind));
        return null;
      }
      try {
        const event = `${ITEM_KINDS[kind].prefix}:${action}`;
        return { data: await emitWithAck(this.socket, event, ...args) };
      } catch (error) {
        this.$toast.error(itemErrorMessage(error.message, kind));
        return null;
      }
    },
    async createItem(kind, title) {
      const result = await this.callItem(kind, "create", this.workspaceId, title);
      if (!result) return;
      const item = result.data;
      this.$emit("item-event", { kind, action: "created", item });
      if (kind === "document") this.selectDocument(String(item._id));
    },
    async renameItem(kind, id, title) {
      const result = await this.callItem(kind, "rename", id, title);
      if (result) this.$emit("item-event", { kind, action: "updated", item: result.data });
    },
    async deleteItem(kind, id) {
      if (kind === "document" && id === this.selectedDocId) this.selectDocument(null);
      const result = await this.callItem(kind, "delete", id);
      if (!result) return;
      this.$emit("item-event", { kind, action: "deleted", item: { _id: id } });
    },
  },
};
</script>

<style scoped>
.workspace-main {
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
.items-tab {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.items-placeholder {
  flex: 1;
}
.tab-placeholder {
  color: gray;
  padding: 40px;
  text-align: center;
}
</style>
