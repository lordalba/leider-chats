<template>
  <div class="item-list">
    <form class="item-create" @submit.prevent="submitCreate">
      <b-form-input
        v-model="newTitle"
        size="sm"
        :placeholder="`New ${kindLabel} title`"
        maxlength="120"
      />
      <b-button type="submit" size="sm" variant="primary" :disabled="!newTitle.trim()">
        Add
      </b-button>
    </form>

    <p v-if="!items.length" class="item-empty">No {{ kindLabel }}s yet.</p>

    <ul class="item-rows">
      <li
        v-for="item in items"
        :key="item._id"
        class="item-row"
        :class="{ selected: String(item._id) === String(selectedId) }"
        @click="$emit('select', String(item._id))"
      >
        <form
          v-if="renamingId === String(item._id)"
          class="item-rename"
          @submit.prevent="submitRename(item)"
          @click.stop
        >
          <b-form-input
            ref="renameInput"
            v-model="renameTitle"
            size="sm"
            maxlength="120"
            @keydown.esc="cancelRename"
            @blur="cancelRename"
          />
        </form>
        <span v-else class="item-title" :title="item.title">{{ item.title }}</span>

        <div v-if="(viewers[item._id] || []).length" class="item-viewers" title="Open now">
          <UserAvatar
            v-for="member in viewers[item._id]"
            :key="member.userId"
            :username="member.username"
            :userId="String(member.userId)"
            :src="member.profilePictureUrl || ''"
            :size="20"
          />
        </div>

        <div class="item-actions" @click.stop>
          <b-button size="sm" variant="link" title="Rename" @click="startRename(item)">
            <i class="fas fa-pen"></i>
          </b-button>
          <b-button size="sm" variant="link" title="Delete" @click="confirmDelete(item)">
            <i class="fas fa-trash"></i>
          </b-button>
        </div>
      </li>
    </ul>

  </div>
</template>

<script>
import UserAvatar from "@/components/workspaces/UserAvatar.vue";
import { confirmDanger } from "@/workspaces/confirm";
import { viewersById } from "@/workspaces/items";

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
      renamingId: null,
      renameTitle: "",
    };
  },
  computed: {
    kindLabel() {
      return this.kind;
    },
    viewers() {
      return viewersById(this.members, this.kind);
    },
  },
  methods: {
    submitCreate() {
      const title = this.newTitle.trim();
      if (!title) return;
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
    submitRename(item) {
      const title = this.renameTitle.trim();
      const id = String(item._id);
      this.cancelRename();
      if (title && title !== item.title) this.$emit("rename", id, title);
    },
    async confirmDelete(item) {
      const ok = await confirmDanger(this.$bvModal, {
        title: `Delete ${this.kindLabel}?`,
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
  border-right: 1px solid #e5e5e5;
  padding-right: 12px;
}
.item-create {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}
.item-empty {
  color: gray;
  font-size: 0.9em;
}
.item-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.item-row:hover {
  background: #f3f3f3;
}
.item-row.selected {
  background: #e7f0ff;
}
.item-title,
.item-rename {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-viewers {
  display: flex;
}
.item-viewers > * {
  margin-left: -6px;
}
.item-actions {
  display: flex;
  opacity: 0.4;
}
.item-row:hover .item-actions {
  opacity: 1;
}
.item-actions .btn {
  padding: 0 4px;
}
</style>
