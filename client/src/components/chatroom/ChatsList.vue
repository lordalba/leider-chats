<template>
  <aside class="chats-list">
    <div class="list-header">
      <SearchBar :value="searchInput" @onSearch="(query) => (searchInput = query)" />
      <button class="new-group" title="Start a private chat or a group" @click="showModal = true">
        <i class="fa-solid fa-pen-to-square"></i> New chat
      </button>
    </div>

    <div class="contacts">
      <p v-if="loading" class="status">Loading…</p>
      <p v-else-if="error" class="status error">{{ error }}</p>
      <template v-else>
        <ChatCard
          v-for="chatroom in searchFilteredChatrooms"
          :key="chatroom._id"
          :chatroom="chatroom"
          :chatroom-id="chatroom._id"
          :class="{ selected: chatroom._id === selectedChatroomId }"
          @chatroom-selected="handleChatroomSelected"
        />
        <p v-if="!searchFilteredChatrooms.length" class="status">
          {{ searchInput ? "No chats match your search." : "No chats yet. Add friends to start talking!" }}
        </p>
      </template>
    </div>

    <CreateChatModal
      :is-open="showModal"
      :friends="friends"
      @close="showModal = false"
      @created="(chat) => $emit('chat-created', chat)"
    />
  </aside>
</template>

<script>
import SearchBar from "@/components/common/SearchBar.vue";
import ChatCard from "./ChatCard.vue";
import CreateChatModal from "./createChat/CreateChatModal.vue";
import { fetchFriends } from "@/api/UserService";
import { chatDisplayName } from "@/chat/chatNames";

export default {
  name: "ChatsList",
  components: { ChatCard, CreateChatModal, SearchBar },
  props: {
    chatrooms: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String, default: null },
    selectedChatroomId: { type: String, default: null },
  },
  data() {
    return { showModal: false, friends: [], searchInput: "" };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    myId() {
      return this.$store.state.connectedUser && this.$store.state.connectedUser._id;
    },
    searchFilteredChatrooms() {
      const query = (this.searchInput || "").trim().toLowerCase();
      if (!query) return this.chatrooms;
      return this.chatrooms.filter((chatroom) =>
        chatDisplayName(chatroom, this.myId).toLowerCase().includes(query)
      );
    },
  },
  created() {
    if (this.socket) {
      this.socket.on("newChatMessage", this.onNewChatMessage);
      this.socket.on("roomDeleted", this.onRoomDeleted);
    }
    this.loadFriends();
  },
  beforeDestroy() {
    if (this.socket) {
      this.socket.off("newChatMessage", this.onNewChatMessage);
      this.socket.off("roomDeleted", this.onRoomDeleted);
    }
  },
  methods: {
    onNewChatMessage(data) {
      this.$emit("new-message", data);
    },
    onRoomDeleted(data) {
      this.$emit("chatroom-deleted", data);
    },
    async loadFriends() {
      try {
        const { data } = await fetchFriends();
        this.friends = data || [];
      } catch (error) {
        // The list still works without friends; only the "New group" dialog needs them.
        this.friends = [];
      }
    },
    handleChatroomSelected(chatroomId) {
      this.$emit("chatroom-selected", chatroomId);
    },
  },
};
</script>

<style scoped>
.chats-list {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--surface-2);
  border-right: 1px solid var(--border);
  min-height: 0;
}
.list-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--border);
}
.new-group {
  align-self: stretch;
  padding: 7px 12px;
  border: 1px solid #2fa7f7;
  border-radius: 8px;
  background: transparent;
  color: #2fa7f7;
  font-weight: 600;
  cursor: pointer;
}
.new-group:hover {
  background: #2fa7f7;
  color: #fff;
}
.contacts {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.status {
  opacity: 0.7;
  text-align: center;
  margin-top: 20px;
  padding: 0 12px;
}
.status.error {
  color: #dc3545;
  opacity: 1;
}
</style>
