<template>
  <div class="item-list">
    <form class="create" @submit.prevent="create">
      <input v-model="newTitle" :placeholder="`New ${noun} title`" maxlength="120" />
      <button type="submit" :disabled="!newTitle.trim()"><i class="fa-solid fa-plus"></i></button>
    </form>

    <p v-if="items.length === 0" class="empty">No {{ noun }}s yet.</p>
    <ul>
      <li
        v-for="item in items"
        :key="item._id"
        :class="{ active: String(item._id) === selectedId }"
        @click="$emit('select', String(item._id))"
      >
        <i :class="icon"></i>
        <input
          v-if="renamingId === String(item._id)"
          ref="renameInput"
          v-model="renameTitle"
          class="rename"
          maxlength="120"
          @click.stop
          @keyup.enter="commitRename(item)"
          @keyup.esc="renamingId = null"
          @blur="commitRename(item)"
        />
        <span v-else class="title">{{ item.title }}</span>
        <span class="viewers">
          <UserAvatar
            v-for="viewer in viewersOf(item)"
            :key="viewer.userId"
            :user-id="viewer.userId"
            :name="viewer.username"
            :src="viewer.profilePictureUrl || ''"
            :size="20"
          />
        </span>
        <span class="actions">
          <button title="Rename" @click.stop="startRename(item)"><i class="fa-solid fa-pen"></i></button>
          <button title="Delete" @click.stop="pendingDelete = item"><i class="fa-solid fa-trash"></i></button>
        </span>
      </li>
    </ul>

    <ConfirmationModal
      v-if="pendingDelete"
      :title="`Delete ${noun}`"
      :description="`Delete &quot;${pendingDelete.title}&quot; for everyone in this workspace?`"
      confirm-text="Delete"
      cancel-text="Cancel"
      :on-confirm="confirmDelete"
      :on-cancel="() => (pendingDelete = null)"
    />
  </div>
</template>

<script>
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import UserAvatar from "./UserAvatar.vue";

export default {
  name: "ItemList",
  components: { ConfirmationModal, UserAvatar },
  props: {
    items: { type: Array, default: () => [] },
    kind: { type: String, required: true, validator: (v) => ["document", "whiteboard"].includes(v) },
    members: { type: Array, default: () => [] },
    selectedId: { type: String, default: null },
  },
  data() {
    return { newTitle: "", renamingId: null, renameTitle: "", pendingDelete: null };
  },
  computed: {
    noun() {
      return this.kind === "document" ? "document" : "whiteboard";
    },
    icon() {
      return this.kind === "document" ? "fa-regular fa-file-lines" : "fa-solid fa-pen-ruler";
    },
  },
  methods: {
    viewersOf(item) {
      return this.members.filter(
        (m) => m.focus && m.focus.kind === this.kind && m.focus.id === String(item._id)
      );
    },
    create() {
      const title = this.newTitle.trim();
      if (!title) return;
      this.$emit("create", title);
      this.newTitle = "";
    },
    startRename(item) {
      this.renamingId = String(item._id);
      this.renameTitle = item.title;
      this.$nextTick(() => {
        const input = Array.isArray(this.$refs.renameInput) ? this.$refs.renameInput[0] : this.$refs.renameInput;
        if (input) input.focus();
      });
    },
    commitRename(item) {
      if (this.renamingId !== String(item._id)) return;
      const title = this.renameTitle.trim();
      this.renamingId = null;
      if (title && title !== item.title) this.$emit("rename", String(item._id), title);
    },
    confirmDelete() {
      this.$emit("delete", String(this.pendingDelete._id));
      this.pendingDelete = null;
    },
  },
};
</script>

<style scoped>
.item-list {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #ddd;
  padding-right: 12px;
}
.create {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.create input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.create button {
  background: #45815c;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0 10px;
}
.create button:disabled {
  opacity: 0.5;
}
.empty {
  color: gray;
  font-size: 0.9em;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
}
li:hover {
  background: #ececec;
}
li.active {
  background: #43792d;
  color: #fff;
}
.title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rename {
  flex: 1;
  min-width: 0;
}
.viewers {
  display: inline-flex;
  gap: 2px;
}
.actions {
  display: none;
}
li:hover .actions {
  display: inline-flex;
}
.actions button {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.7;
  padding: 0 3px;
}
.actions button:hover {
  opacity: 1;
}
</style>
