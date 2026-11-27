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
        <PresenceBar :members="members" :meId="meId" :detail="detail" />
      </div>
      <Tabs :tabs="tabs" :value="activeTab" @input="setActiveTab" />
      <TaskBoard
        v-if="activeTab === 'tasks'"
        :tasks="detail.tasks || []"
        :participants="(detail.chat && detail.chat.participants) || []"
        :members="members"
        :workspaceId="String(detail.workspace._id)"
        @focus="(focus) => $emit('focus', focus)"
        @item-event="(event) => $emit('item-event', event)"
      />
      <div v-else-if="activeTab === 'documents'" class="items-tab">
        <ItemList
          ref="documentList"
          kind="document"
          :items="detail.documents || []"
          :members="members"
          :selectedId="selectedDocId"
          @select="openItem"
          @create="(title) => createItem('document', title)"
          @rename="(id, title) => renameItem('document', id, title)"
          @delete="(id) => deleteItem('document', id)"
        />
        <DocumentEditor
          v-if="selectedDoc"
          :key="selectedDocId"
          :docId="selectedDocId"
          :connectedUser="connectedUser"
          @closed="closeItem"
        />
        <EmptyState
          v-else
          icon="fa-file-lines"
          title="No document open"
          body="Choose one from the list or create a new one."
          actionLabel="New document"
          @action="$refs.documentList.focusCreate()"
        />
      </div>
      <div v-else-if="activeTab === 'whiteboards'" class="items-tab">
        <ItemList
          ref="whiteboardList"
          kind="whiteboard"
          :items="detail.whiteboards || []"
          :members="members"
          :selectedId="selectedWbId"
          @select="openItem"
          @create="(title) => createItem('whiteboard', title)"
          @rename="(id, title) => renameItem('whiteboard', id, title)"
          @delete="(id) => deleteItem('whiteboard', id)"
        />
        <WhiteboardCanvas
          v-if="selectedWb"
          :key="selectedWbId"
          :whiteboardId="selectedWbId"
          :connectedUser="connectedUser"
          :canClear="canClearSelectedWb"
          @closed="closeItem"
        />
        <EmptyState
          v-else
          icon="fa-chalkboard"
          title="No whiteboard open"
          body="Choose one from the list or create a new one."
          actionLabel="New whiteboard"
          @action="$refs.whiteboardList.focusCreate()"
        />
      </div>
    </div>
    <div
      v-else-if="route.workspaceId && loading"
      class="ws-skeleton"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <div class="ws-skeleton-header"></div>
      <div class="ws-skeleton-tabs"></div>
      <div class="ws-skeleton-columns">
        <div v-for="n in 4" :key="n" class="ws-skeleton-column"></div>
      </div>
    </div>
    <EmptyState
      v-else-if="route.workspaceId"
      icon="fa-triangle-exclamation"
      title="Couldn't load this workspace"
      body="Check your connection and try again."
      actionLabel="Try again"
      @action="$emit('retry')"
    />
    <EmptyState
      v-else
      icon="fa-table-columns"
      title="Pick a workspace"
      body="Workspaces belong to a group chat. Open one on the left or start a new one."
      actionLabel="New workspace"
      @action="$emit('create-workspace')"
    />
  </div>
</template>

<script>
import EmptyState from "@/components/workspaces/EmptyState.vue";
import Tabs from "@/components/workspaces/Tabs.vue";
import PresenceBar from "@/components/workspaces/PresenceBar.vue";
import TaskBoard from "@/components/workspaces/tasks/TaskBoard.vue";
import ItemList from "@/components/workspaces/ItemList.vue";
import DocumentEditor from "@/components/workspaces/documents/DocumentEditor.vue";
import WhiteboardCanvas from "@/components/workspaces/whiteboard/WhiteboardCanvas.vue";
import { emitWithAck } from "@/workspaces/socketCall";
import { itemErrorMessage } from "@/workspaces/items";
import { TABS, parseWorkspaceRoute, workspacePath } from "@/workspaces/workspaceRoute";

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
    // The selected workspace's snapshot is on its way.
    loading: {
      type: Boolean,
      default: false,
    },
  },
  components: {
    Tabs,
    EmptyState,
    PresenceBar,
    TaskBoard,
    ItemList,
    DocumentEditor,
    WhiteboardCanvas,
  },
  data() {
    return {
      // Last item that was actually open: tells "was deleted" (it vanished
      // while open) from "no longer exists" (a stale link).
      seenItemId: null,
    };
  },
  computed: {
    // Tab and open item come from the URL (see workspaceRoute.js).
    route() {
      return parseWorkspaceRoute(this.$route.params);
    },
    activeTab() {
      return this.route.tab;
    },
    selectedDocId() {
      return this.activeTab === "documents" ? this.route.itemId : null;
    },
    selectedWbId() {
      return this.activeTab === "whiteboards" ? this.route.itemId : null;
    },
    tabs() {
      const d = this.detail || {};
      const counts = { tasks: d.tasks, documents: d.documents, whiteboards: d.whiteboards };
      return TABS.map((t) => ({ ...t, count: (counts[t.slug] || []).length }));
    },
    // The detail on screen is the one the URL names (not the previous
    // workspace's, still shown while the next one loads).
    detailReady() {
      return !!this.detail && String(this.detail.workspace._id) === this.route.workspaceId;
    },
    openKind() {
      if (this.activeTab === "documents") return "document";
      if (this.activeTab === "whiteboards") return "whiteboard";
      return null;
    },
    openedItem() {
      return this.selectedDoc || this.selectedWb;
    },
    // The URL names an item this workspace doesn't have.
    missingItem() {
      return this.detailReady && !!this.route.itemId && !this.openedItem;
    },
    // What presence should say I'm on; re-sent once the workspace is joined.
    focus() {
      if (!this.detailReady || !this.openedItem) return null;
      return { kind: this.openKind, id: this.route.itemId };
    },
    socket() {
      return this.$store.getters["socket/socket"];
    },
    connectedUser() {
      return this.$store.state.connectedUser || null;
    },
    meId() {
      return this.connectedUser ? String(this.connectedUser._id) : null;
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
    selectedWb() {
      if (!this.detail || !this.selectedWbId) return null;
      return (
        (this.detail.whiteboards || []).find((w) => String(w._id) === this.selectedWbId) ||
        null
      );
    },
    canClearSelectedWb() {
      const me = this.connectedUser && String(this.connectedUser._id);
      if (!me || !this.selectedWb) return false;
      const admins = ((this.detail.chat && this.detail.chat.admins) || []).map(String);
      return String(this.selectedWb.createdBy) === me || admins.includes(me);
    },
  },
  watch: {
    openedItem(item) {
      if (item) this.seenItemId = this.route.itemId;
    },
    missingItem: {
      immediate: true,
      handler(missing) {
        if (!missing) return;
        const kind = this.openKind;
        // Deleted while open (here or by someone else), or a stale link.
        const text =
          this.seenItemId === this.route.itemId
            ? itemErrorMessage("not_found", kind)
            : `This ${kind} no longer exists`;
        this.$toast.info(text);
        this.closeItem();
      },
    },
    focus: {
      immediate: true,
      handler(focus, previous) {
        if (JSON.stringify(focus) !== JSON.stringify(previous || null)) {
          this.$emit("focus", focus);
        }
      },
    },
  },
  methods: {
    go(location, replace = false) {
      const path = workspacePath({ workspaceId: this.route.workspaceId, ...location });
      if (path === this.$route.path) return Promise.resolve();
      // Duplicate/aborted navigations reject in vue-router 3; nothing to do.
      return this.$router[replace ? "replace" : "push"](path).catch(() => {});
    },
    setActiveTab(tab) {
      this.go({ tab });
    },
    openItem(id) {
      this.go({ tab: this.activeTab, itemId: id || null });
    },
    // Close the open item without leaving a history entry for it.
    closeItem() {
      return this.go({ tab: this.activeTab }, true);
    },
    // Resolves { data } on success, null (after a toast) on failure.
    // `context` "title" picks the title-length copy for an `invalid` error.
    async callItem(kind, action, context, ...args) {
      if (!this.socket) {
        this.$toast.error(itemErrorMessage("timeout", kind));
        return null;
      }
      try {
        const event = `${ITEM_KINDS[kind].prefix}:${action}`;
        return { data: await emitWithAck(this.socket, event, ...args) };
      } catch (error) {
        this.$toast.error(itemErrorMessage(error.message, kind, context));
        return null;
      }
    },
    async createItem(kind, title) {
      const workspaceId = this.workspaceId;
      const result = await this.callItem(kind, "create", "title", workspaceId, title);
      if (!result) return;
      // The user moved to another workspace meanwhile: the item belongs to
      // the old one, whose list refetches when it is opened again.
      if (this.workspaceId !== workspaceId) return;
      const item = result.data;
      this.$emit("item-event", { kind, action: "created", item });
      this.go({ tab: ITEM_KINDS[kind].list, itemId: String(item._id) });
    },
    async renameItem(kind, id, title) {
      const result = await this.callItem(kind, "rename", "title", id, title);
      if (result) this.$emit("item-event", { kind, action: "updated", item: result.data });
    },
    async deleteItem(kind, id) {
      // Close it only once the delete succeeded; on failure it stays open.
      const result = await this.callItem(kind, "delete", null, id);
      if (!result) return;
      // Leave the URL first so the vanished item isn't reported as missing.
      if (id === this.route.itemId) await this.closeItem();
      this.$emit("item-event", { kind, action: "deleted", item: { _id: id } });
    },
  },
};
</script>

<style scoped>
.workspace-main {
  flex: 1;
  padding: 20px;
  min-width: 0;
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
.items-tab > .empty-state {
  align-self: stretch;
  border: 1px dashed var(--ws-border);
  border-radius: var(--ws-radius);
}
.ws-skeleton > div,
.ws-skeleton-column {
  border-radius: var(--ws-radius);
  background: linear-gradient(90deg, #dcdfe3 0%, #eceef1 50%, #dcdfe3 100%);
  background-size: 200% 100%;
  animation: ws-shimmer 1.4s ease-in-out infinite;
}
.ws-skeleton-header {
  width: 40%;
  height: 32px;
  margin-bottom: var(--ws-space-3);
}
.ws-skeleton-tabs {
  width: 320px;
  max-width: 100%;
  height: 28px;
  margin-bottom: var(--ws-space-4);
}
.ws-skeleton .ws-skeleton-columns {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--ws-space-3);
  background: none;
  animation: none;
}
.ws-skeleton-column {
  height: 360px;
}
@keyframes ws-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ws-skeleton > div,
  .ws-skeleton-column {
    animation: none;
  }
}
</style>
