<template>
  <div class="item-list">
    <form class="item-create" novalidate @submit.prevent="submitCreate">
      <div class="item-create-row">
        <b-form-input
          ref="createInput"
          v-model="newTitle"
          size="sm"
          :placeholder="`New ${kind} title`"
          maxlength="120"
          :aria-label="`New ${kind} title`"
          :aria-describedby="createHint ? hintId : null"
          :state="createHint ? false : null"
          @input="createHint = false"
        />
        <b-button type="submit" size="sm" variant="primary" class="item-create-btn">
          <i class="fa-solid fa-plus" aria-hidden="true"></i> New
        </b-button>
      </div>
      <p v-if="createHint" :id="hintId" class="item-create-hint" role="alert">
        Give it a title first
      </p>
    </form>

    <p v-if="!items.length" class="item-empty">No {{ kind }}s yet.</p>

    <ul class="item-rows">
      <li
        v-for="item in items"
        :key="item._id"
        class="item-row"
        :class="{ selected: String(item._id) === String(selectedId) }"
      >
        <form
          v-if="renamingId === String(item._id)"
          class="item-rename"
          @submit.prevent="submitRename(item)"
        >
          <b-form-input
            ref="renameInput"
            v-model="renameTitle"
            size="sm"
            maxlength="120"
            :aria-label="`Rename ${item.title}`"
            @keydown.esc.prevent.stop="cancelRename"
            @blur="submitRename(item)"
          />
        </form>
        <router-link
          v-else
          :to="pathFor(item)"
          class="item-link"
          :title="item.title"
          :aria-current="String(item._id) === String(selectedId) ? 'page' : null"
        >
          <span class="item-title">{{ item.title }}</span>
          <span v-if="(viewers[item._id] || []).length" class="item-viewers">
            <UserAvatar
              v-for="member in viewers[item._id]"
              :key="member.userId"
              :username="member.username"
              :userId="String(member.userId)"
              :src="member.profilePictureUrl || ''"
              :size="20"
            />
          </span>
        </router-link>

        <b-dropdown
          right
          no-caret
          variant="link"
          size="sm"
          class="item-menu"
          toggle-class="item-menu-toggle"
          :aria-label="`${kindTitle} actions`"
        >
          <template #button-content>
            <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
            <span class="sr-only">{{ kindTitle }} actions for {{ item.title }}</span>
          </template>
          <b-dropdown-item-button @click="startRename(item)">
            <i class="fa-solid fa-pen fa-fw" aria-hidden="true"></i> Rename
          </b-dropdown-item-button>
          <b-dropdown-item-button variant="danger" @click="confirmDelete(item)">
            <i class="fa-solid fa-trash fa-fw" aria-hidden="true"></i> Delete…
          </b-dropdown-item-button>
        </b-dropdown>
      </li>
    </ul>
  </div>
</template>

<script>
import UserAvatar from "@/components/workspaces/UserAvatar.vue";
import { confirmDanger } from "@/workspaces/confirm";
import { viewersById } from "@/workspaces/items";
import { parseWorkspaceRoute, workspacePath } from "@/workspaces/workspaceRoute";

let uid = 0;

export default {
  name: "ItemList",
  components: { UserAvatar },
  props: {
    items: {
      type: Array,
      default: () => [],
    },
    kind: {
      type: String,
      required: true,
      validator: (v) => v === "document" || v === "whiteboard",
    },
    members: {
      type: Array,
      default: () => [],
    },
    selectedId: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      newTitle: "",
      createHint: false,
      hintId: `item-create-hint-${++uid}`,
      renamingId: null,
      renameTitle: "",
    };
  },
  computed: {
    kindTitle() {
      return this.kind === "document" ? "Document" : "Whiteboard";
    },
    meId() {
      const user = this.$store.state.connectedUser;
      return user ? String(user._id) : null;
    },
    // Others with each item open (me excluded, one avatar per person).
    viewers() {
      const map = viewersById(this.members, this.kind);
      const out = {};
      Object.keys(map).forEach((id) => {
        const seen = new Set();
        out[id] = map[id].filter((m) => {
          const userId = String(m.userId);
          if (userId === this.meId || seen.has(userId)) return false;
          seen.add(userId);
          return true;
        });
      });
      return out;
    },
  },
  methods: {
    // Called by the parent's "New document/whiteboard" empty-state button.
    focusCreate() {
      const input = this.$refs.createInput;
      if (input && input.focus) input.focus();
    },
    pathFor(item) {
      const { workspaceId } = parseWorkspaceRoute(this.$route.params);
      const tab = this.kind === "document" ? "documents" : "whiteboards";
      return workspacePath({ workspaceId, tab, itemId: String(item._id) });
    },
    submitCreate() {
      const title = this.newTitle.trim();
      if (!title) {
        this.createHint = true;
        this.focusCreate();
        return;
      }
      this.createHint = false;
      this.$emit("create", title);
      this.newTitle = "";
    },
    startRename(item) {
      this.renamingId = String(item._id);
      this.renameTitle = item.title;
      this.$nextTick(() => {
        const input = this.$refs.renameInput;
        const el = Array.isArray(input) ? input[0] : input;
        if (el && el.focus) el.focus();
      });
    },
    cancelRename() {
      this.renamingId = null;
      this.renameTitle = "";
    },
    // Enter or leaving the field saves; Esc cancels.
    submitRename(item) {
      if (this.renamingId !== String(item._id)) return;
      const title = this.renameTitle.trim();
      const id = String(item._id);
      this.cancelRename();
      if (title && title !== item.title) this.$emit("rename", id, title);
    },
    async confirmDelete(item) {
      const ok = await confirmDanger(this.$bvModal, {
        title: `Delete ${this.kind}?`,
        message: `“${item.title}” will be deleted for everyone in this workspace.`,
        okTitle: "Delete",
      });
      if (ok) this.$emit("delete", String(item._id));
    },
  },
};
</script>

<style scoped>
.item-list {
  width: 260px;
  flex-shrink: 0;
  align-self: stretch;
  overflow-y: auto;
}
.item-create {
  margin-bottom: var(--ws-space-3);
}
.item-create-row {
  display: flex;
  gap: 6px;
}
.item-create-btn {
  white-space: nowrap;
}
.item-create-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ws-danger);
}
.item-empty {
  color: var(--ws-text-muted);
  font-size: 14px;
}
.item-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: var(--ws-radius-sm);
  border-left: 3px solid transparent;
}
.item-row:hover {
  background: rgba(0, 0, 0, 0.04);
}
.item-row.selected {
  background: var(--ws-accent-soft);
  border-left-color: var(--ws-accent);
}
.item-link,
.item-rename {
  flex: 1;
  min-width: 0;
}
.item-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 4px 7px 8px;
  color: var(--ws-text);
  text-decoration: none;
}
.item-row.selected .item-link {
  color: var(--ws-accent-strong);
  font-weight: 600;
}
.item-rename {
  padding: 3px 4px 3px 6px;
}
.item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-viewers {
  display: flex;
  flex-shrink: 0;
}
.item-viewers > * + * {
  margin-left: -6px;
}
.item-menu ::v-deep .item-menu-toggle {
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--ws-text-muted);
}
.item-menu ::v-deep .item-menu-toggle:hover {
  color: var(--ws-text);
  background: rgba(0, 0, 0, 0.06);
}
</style>
