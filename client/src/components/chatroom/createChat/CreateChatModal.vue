<template>
  <div v-if="isOpen" class="overlay" @click="close">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="create-chat-title" @click.stop>
      <header class="dialog-header">
        <h3 id="create-chat-title">{{ step === 1 ? "New chat" : "Group details" }}</h3>
        <button class="close" aria-label="Close" @click="close"><i class="fa-solid fa-xmark"></i></button>
      </header>

      <!-- Step 1: members -->
      <section v-if="step === 1" class="step">
        <input v-model="filter" type="search" class="search" placeholder="Search friends…" />
        <p class="count">
          {{ selected.length }} selected
          <span class="hint">· {{ selectionHint }}</span>
        </p>
        <ul class="members">
          <li v-for="friend in visibleFriends" :key="friend._id">
            <label :class="{ checked: selected.includes(friend._id) }">
              <input v-model="selected" type="checkbox" :value="friend._id" />
              <img v-avatar :src="friend.profilePictureUrl" :alt="friend.username" class="picture" />
              <span class="name">{{ friend.username }}</span>
            </label>
          </li>
        </ul>
        <p v-if="!friends.length" class="empty">Add some friends first to start a chat.</p>
        <p v-else-if="!visibleFriends.length" class="empty">No friends match “{{ filter }}”.</p>
      </section>

      <!-- Step 2: name and picture -->
      <section v-else class="step">
        <label class="field">
          <span>Group name</span>
          <input v-model="chatName" type="text" maxlength="80" placeholder="e.g. Weekend plans" />
        </label>
        <div class="field">
          <span>Group picture (optional)</span>
          <div class="picture-row">
            <img v-avatar="'group'" :src="previewImage" alt="Group picture" class="group-preview" />
            <label class="file-button">
              <input type="file" accept="image/*" @change="onImagePicked" />
              <i class="fa-solid fa-image"></i> Choose picture
            </label>
          </div>
        </div>
      </section>

      <footer class="dialog-footer">
        <button v-if="step === 2" class="secondary" @click="step = 1">Back</button>
        <template v-if="step === 1">
          <button v-if="isDirectChat" class="primary" :disabled="creating" @click="create">
            {{ creating ? "Opening…" : "Start chat" }}
          </button>
          <button v-else class="primary" :disabled="selected.length < 2" @click="step = 2">Next</button>
        </template>
        <button v-else class="primary" :disabled="!chatName.trim() || creating" @click="create">
          {{ creating ? "Creating…" : "Create group" }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script>
import { createChatroom } from "@/api/ChatRoomService";
import { serverMessage } from "@/api/httpClient";

const initialState = () => ({
  step: 1,
  filter: "",
  selected: [],
  chatName: "",
  chatImage: null,
  previewImage: "",
  creating: false,
});

export default {
  name: "CreateChatModal",
  props: {
    isOpen: { type: Boolean, default: false },
    friends: { type: Array, default: () => [] },
  },
  data: initialState,
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    /** One friend = a private one-on-one chat; two or more = a group. */
    isDirectChat() {
      return this.selected.length === 1;
    },
    selectionHint() {
      if (this.selected.length === 0) return "pick 1 friend for a private chat, or more for a group";
      if (this.isDirectChat) return "private chat";
      return "group chat";
    },
    visibleFriends() {
      const term = this.filter.trim().toLowerCase();
      if (!term) return this.friends;
      return this.friends.filter((friend) => friend.username.toLowerCase().includes(term));
    },
  },
  watch: {
    isOpen(open) {
      if (open) this.reset();
    },
  },
  beforeDestroy() {
    this.revokePreview();
  },
  methods: {
    close() {
      this.$emit("close");
    },
    reset() {
      this.revokePreview();
      Object.assign(this.$data, initialState());
    },
    revokePreview() {
      if (this.previewImage) URL.revokeObjectURL(this.previewImage);
    },
    onImagePicked(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.revokePreview();
      this.chatImage = file;
      this.previewImage = URL.createObjectURL(file);
    },
    async create() {
      this.creating = true;
      const formData = new FormData();
      formData.append("participants", JSON.stringify(this.selected));
      if (!this.isDirectChat) {
        formData.append("name", this.chatName.trim());
        if (this.chatImage) formData.append("chatImage", this.chatImage);
      }
      try {
        const { data: chat } = await createChatroom(formData);
        if (this.socket) this.socket.emit("createdChatroom", chat._id);
        if (!this.isDirectChat) this.$toast.success("A new group chat has been created! 🎉");
        this.$emit("created", chat);
        this.close();
      } catch (error) {
        this.$toast.error(serverMessage(error, "Couldn't create the chat."));
      } finally {
        this.creating = false;
      }
    },
  },
};
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dialog {
  width: 100%;
  max-width: 460px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  color: var(--text);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.dialog-header h3 {
  margin: 0;
  font-size: 1.25em;
}
.close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
}
.step {
  padding: 14px 20px;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}
.search,
.field input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
.count {
  margin: 10px 0 6px;
  font-size: 0.9em;
  color: var(--text-muted);
}
.hint {
  color: var(--accent);
}
.members {
  list-style: none;
  padding: 0;
  margin: 0;
}
.members label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  margin: 0;
  border-radius: 8px;
  cursor: pointer;
}
.members label:hover {
  background: var(--surface-2);
}
.members label.checked {
  background: var(--accent-soft);
}
.picture {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.name {
  font-size: 0.95em;
}
.empty {
  color: var(--text-muted);
  text-align: center;
  padding: 10px 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.field > span {
  font-weight: 500;
}
.picture-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.group-preview {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
  border: 1px solid var(--border);
}
.file-button {
  margin: 0;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
}
.file-button input {
  display: none;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
.primary,
.secondary {
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
}
.primary {
  background: #1874fc;
  color: #fff;
  border: none;
}
.primary:disabled {
  opacity: 0.5;
  cursor: default;
}
.secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}
</style>
