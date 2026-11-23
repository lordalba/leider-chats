<template>
  <div class="chat-room">
    <ChatsList
      :chatrooms="chatrooms"
      :loading="loading"
      :error="error"
      :selected-chatroom-id="selectedChatroomId"
      @chatroom-selected="selectChatroom"
      @chatroom-deleted="handleChatroomDeleted"
      @new-message="handleNewMessage"
      @chat-created="openCreatedChat"
    />

    <section class="chat-main">
      <button v-if="selectedChatroom" class="chatroom-top-bar" @click="toggleSidebar">
        <img
          v-avatar="selectedChatroom.isGroupChat ? 'group' : 'user'"
          :src="selectedChatroomPicture"
          :alt="selectedChatroomName"
          class="chatroom-image"
        />
        <span class="chatroom-info">
          <span class="chatroom-name">{{ selectedChatroomName }}</span>
          <span class="chatroom-subtitle">
            {{
              selectedChatroom.isGroupChat
                ? `${selectedChatroom.participants.length} members · click for group details`
                : "Click for contact details"
            }}
          </span>
        </span>
      </button>

      <MessageList
        :chatroom-id="selectedChatroomId"
        :participants-amount="selectedChatroom ? selectedChatroom.participants.length : 0"
        :is-group-chat="!!(selectedChatroom && selectedChatroom.isGroupChat)"
        :is-connected-user-admin="isConnectedUserAdmin"
      />
      <ChatInput
        :chatroom-id="selectedChatroomId"
        :admin-permission-state="!!(selectedChatroom && selectedChatroom.adminPermissions)"
        :is-connected-user-admin="isConnectedUserAdmin"
      />
    </section>

    <ChatroomSidebar
      v-if="isSidebarOpen && selectedChatroom"
      :chatroom="selectedChatroom"
      :is-group-chat="selectedChatroom.isGroupChat"
      @close="toggleSidebar"
      @chatroom-selected="selectChatroom"
      @chatroom-exited="removeChatFromList"
      @open-chat="openCreatedChat"
    />
  </div>
</template>

<script>
import ChatsList from "@/components/chatroom/ChatsList.vue";
import MessageList from "@/components/chatroom/MessageList.vue";
import ChatInput from "@/components/chatroom/ChatInput.vue";
import ChatroomSidebar from "@/components/chatroom/ChatroomSidebar.vue";
import { fetchChatRooms } from "@/api/ChatRoomService";
import { chatDisplayName, chatPicture } from "@/chat/chatNames";

export default {
  name: "ChatRoomsPage",
  components: { ChatsList, MessageList, ChatInput, ChatroomSidebar },
  data() {
    return {
      chatrooms: [],
      loading: true,
      error: null,
      selectedChatroomId: null,
      isSidebarOpen: false,
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    myId() {
      return this.$store.state.connectedUser._id;
    },
    selectedChatroom() {
      return this.chatrooms.find((c) => c._id === this.selectedChatroomId) || null;
    },
    isConnectedUserAdmin() {
      return !!this.selectedChatroom && (this.selectedChatroom.admins || []).includes(this.myId);
    },
    selectedChatroomName() {
      return chatDisplayName(this.selectedChatroom, this.myId);
    },
    selectedChatroomPicture() {
      return chatPicture(this.selectedChatroom, this.myId);
    },
  },
  watch: {
    "$route.query.chat"() {
      this.openChatFromRoute();
    },
  },
  async mounted() {
    this.socketHandlers = {
      "chatroom-created": () => this.loadChatrooms(),
      "update-admin-permissions": (data) => this.updateChat(data.chatRoomId, { adminPermissions: data.newAdminPermissions }),
      "update-user-chat-admin": (data) => this.updateAdmin(data),
      "remove-user-from-chat": (data) => this.handleUserChatRemoval(data),
      userExitedChatroom: (data) => this.removeParticipant(data),
      "chat-description-updated": (data) => this.updateChat(data.chatRoomId, { description: data.description }),
    };
    if (this.socket) {
      Object.entries(this.socketHandlers).forEach(([event, fn]) => this.socket.on(event, fn));
    }

    await this.loadChatrooms();
    this.openChatFromRoute();
  },
  beforeDestroy() {
    if (this.socket && this.socketHandlers) {
      Object.entries(this.socketHandlers).forEach(([event, fn]) => this.socket.off(event, fn));
    }
    this.leaveChatRoom();
  },
  methods: {
    async loadChatrooms() {
      try {
        const { data } = await fetchChatRooms();
        this.chatrooms = data;
        this.error = null;
      } catch (err) {
        this.error = "Failed to load chats";
      } finally {
        this.loading = false;
      }
    },
    /** Opens the chat given as ?chat=<id> (e.g. coming back from a workspace). */
    openChatFromRoute() {
      const chatId = this.$route.query.chat;
      if (!chatId || chatId === this.selectedChatroomId) return;
      if (this.chatrooms.some((c) => c._id === chatId)) this.selectChatroom(chatId);
    },
    findChat(chatRoomId) {
      return this.chatrooms.find((chatroom) => chatroom._id === chatRoomId) || null;
    },
    updateChat(chatRoomId, changes) {
      const chat = this.findChat(chatRoomId);
      if (chat) Object.assign(chat, changes);
    },
    updateAdmin({ chatRoomId, userId, updateToAdmin }) {
      const chat = this.findChat(chatRoomId);
      if (!chat) return;
      const admins = (chat.admins || []).filter((id) => id !== userId);
      chat.admins = updateToAdmin ? [...admins, userId] : admins;
    },
    removeParticipant({ chatRoomId, userId }) {
      const chat = this.findChat(chatRoomId);
      if (chat) chat.participants = chat.participants.filter((p) => p._id !== userId);
    },
    handleUserChatRemoval(data) {
      this.removeParticipant(data);
      if (data.userId === this.myId) this.removeChatFromList(data.chatRoomId);
    },
    leaveChatRoom() {
      if (this.selectedChatroomId && this.socket) {
        this.socket.emit("leaveRoom", this.selectedChatroomId, this.myId);
      }
    },
    handleNewMessage({ chatRoomId, senderId }) {
      const chat = this.findChat(chatRoomId);
      if (!chat) return;
      // Most recent conversation first.
      this.chatrooms = [chat, ...this.chatrooms.filter((c) => c !== chat)];
      if (senderId !== this.myId && this.selectedChatroomId !== chatRoomId) {
        chat.unreadMessages = (chat.unreadMessages || 0) + 1;
      }
    },
    selectChatroom(chatroomId) {
      const previousChatroomId = this.selectedChatroomId;
      this.isSidebarOpen = false;
      this.selectedChatroomId = chatroomId;
      const chat = this.findChat(chatroomId);
      if (chat) chat.unreadMessages = 0;

      if (this.socket) this.socket.emit("joinRoom", previousChatroomId, chatroomId, this.myId);
    },
    handleChatroomDeleted(data) {
      // Read the name before removing it from the list.
      const name = chatDisplayName(this.findChat(data.chatRoomId), this.myId);
      this.removeChatFromList(data.chatRoomId);
      this.$toast.warning(data.deleter === this.myId ? `You deleted ${name}` : `${name} was deleted by an admin`);
    },
    removeChatFromList(chatRoomId) {
      this.chatrooms = this.chatrooms.filter((chatroom) => chatroom._id !== chatRoomId);
      if (this.selectedChatroomId === chatRoomId) {
        this.selectedChatroomId = null;
        this.isSidebarOpen = false;
      }
    },
    /** After "New chat": show it in the list (if new) and open it. */
    async openCreatedChat(chat) {
      if (!this.findChat(chat._id)) await this.loadChatrooms();
      this.selectChatroom(chat._id);
    },
    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
    },
  },
};
</script>

<style scoped>
.chat-room {
  display: flex;
  height: calc(100vh - 71px);
  min-height: 450px;
}
.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.chatroom-top-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 10px 16px;
  background-color: var(--surface-2);
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.chatroom-image {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.chatroom-info {
  display: flex;
  flex-direction: column;
}
.chatroom-name {
  font-size: 18px;
  font-weight: 600;
}
.chatroom-subtitle {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
