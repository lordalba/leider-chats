<template>
  <div class="chat-room">
    <ChatsList
      :chatrooms="chatrooms"
      :loading="loading"
      :error="error"
      @chatroom-selected="selectChatroom"
      @chatroom-deleted="handleChatroomDeleted"
      @new-message="handleNewMessage"
    ></ChatsList>
    <div class="chat-main">
      <!-- Chatroom Top Bar -->
      <div
        v-if="selectedChatroomId"
        class="chatroom-top-bar"
        @click="toggleSidebar"
      >
        <img
          :src="selectedChatroomImage"
          alt="Chatroom"
          class="chatroom-image"
        />
        <div class="chatroom-info">
          <h3 class="chatroom-name">{{ selectedChatroomName }}</h3>
          <p class="chatroom-participants">
            {{
              `click to watch ${
                isSelectedChatroomGroupChat ? "GroupChat" : "User"
              } details`
            }}
          </p>
        </div>
      </div>

      <MessageList
        :chatroom-id="selectedChatroomId"
        :participants-amount="participantsAmount"
        :is-group-chat="isSelectedChatroomGroupChat"
      />
      <ChatInput
        :chatroom-id="selectedChatroomId"
        :admin-permission-state="selectedChatroom?.adminPermissions || false"
        :is-connected-user-admin="isConnectedUserAdminInSelectedChatroom"
      />
    </div>

    <ChatroomSidebar
      v-if="isSidebarOpen"
      :chatroom="selectedChatroomDetails"
      :is-group-chat="isSelectedChatroomGroupChat"
      @close="toggleSidebar"
      @chatroom-selected="selectChatroom"
      @chatroom-exited="removeChatFromList"
    />
  </div>
</template>

<script>
import ChatsList from "@/components/chatroom/ChatsList.vue";
import MessageList from "@/components/chatroom/MessageList.vue";
import ChatInput from "@/components/chatroom/ChatInput.vue";
import { fetchChatRooms } from "@/api/ChatRoomService";
import store from "@/store/store";
import ChatroomSidebar from "@/components/chatroom/ChatroomSidebar.vue";

export default {
  name: "chatRoom",
  components: {
    ChatsList,
    MessageList,
    ChatInput,
    ChatroomSidebar,
  },
  data() {
    return {
      chatrooms: [],
      loading: true,
      error: null,
      prevChatroomId: null,
      selectedChatroomId: null,
      participantsAmount: null,
      isSidebarOpen: false,
    };
  },
  async mounted() {
    await this.initializeChatrooms();

    if (this.socket) {
      this.socket.on("chatroom-created", () => {
        this.initializeChatrooms();
      });
      this.socket.on("update-admin-permissions", (data) => {
        this.handleUpdatingPermissions(data);
      });
      this.socket.on("update-user-chat-admin", (data) => {
        this.handleUpdatingAdminForUserInChat(data);
      });
      this.socket.on("remove-user-from-chat", (data) => {
        this.handleUserChatRemoval(data);
      });
      this.socket.on("userExitedChatroom", (data) => {
        this.removeUserFromChat(data);
      });
    }
  },
  methods: {
    handleUpdatingPermissions(data) {
      const chatIndex = this.chatrooms.findIndex(
        (chatroom) => chatroom._id === data.chatRoomId
      );
      this.chatrooms[chatIndex].adminPermissions = data.newAdminPermissions;
    },
    handleUpdatingAdminForUserInChat(data) {
      const chatIndex = this.chatrooms.findIndex(
        (chatroom) => chatroom._id === data.chatRoomId
      );

      if (data.updateToAdmin) {
        this.chatrooms[chatIndex].admins.push(data.userId);
      } else {
        const userIndexInAdmins = this.chatrooms[chatIndex].admins.findIndex(
          (admin) => admin === data.userId
        );
        this.chatrooms[chatIndex].admins.splice(userIndexInAdmins, 1);
      }
    },
    removeUserFromChat(data) {
      const chatIndex = this.chatrooms.findIndex(
        (chatroom) => chatroom._id === data.chatRoomId
      );

      const participantIndex = this.chatrooms[chatIndex].participants.findIndex(
        (participant) => participant._id === data.userId
      );

      this.chatrooms[chatIndex].participants.splice(participantIndex, 1);
    },
    handleUserChatRemoval(data) {
      this.removeUserFromChat(data);

      if (data.userId === this.$store.state.connectedUser._id) {
        this.selectedChatroomId = null;
        this.removeChatFromList(data.chatRoomId);
        this.isSidebarOpen = false;
      }
    },
    leaveChatRoom() {
      if (this.selectedChatroomId && this.socket) {
        this.socket.emit(
          "leaveRoom",
          this.selectedChatroomId,
          store.state.connectedUser._id
        );
      }
    },
    async initializeChatrooms() {
      try {
        const response = await fetchChatRooms();
        this.chatrooms = response.data;
      } catch (err) {
        this.error = "Failed to load chatrooms";
        console.error(err);
      } finally {
        this.loading = false;
      }
    },
    handleNewMessage(data) {
      this.chatrooms.sort((x, y) => {
        if (x._id === data.chatRoomId) return -1;
        if (y._id === data.chatRoomId) return 1;
        return 0;
      });

      if (
        data.senderId !== this.$store.state.connectedUser._id &&
        this.selectedChatroomId != data.chatRoomId
      ) {
        this.chatrooms[0].unreadMessages += 1;
      }
    },
    selectChatroom(chatroomId) {
      this.isSidebarOpen = false;
      this.prevChatroomId = this.selectedChatroomId;
      this.selectedChatroomId = chatroomId;
      this.participantsAmount = this.calculateParticipantsAmount();

      if (this.socket) {
        this.socket.emit(
          "joinRoom",
          this.prevChatroomId,
          this.selectedChatroomId,
          store.state.connectedUser._id
        );
      }
    },
    handleChatroomDeleted(data) {
      const chatroomIndexToRemove = this.removeChatFromList(data.chatRoomId);
      const deletedRoomName = this.chatrooms[chatroomIndexToRemove].name;

      data.deleter == this.$store.state.connectedUser._id
        ? this.$toast.warning(`You deleted Chatroom ${deletedRoomName}`)
        : this.$toast.warning(
            `Chatroom ${deletedRoomName} was deleted by Admin`
          );
    },
    removeChatFromList(chatRoomId) {
      const chatroomIndexToRemove = this.chatrooms.findIndex(
        (chatroom) => chatroom._id === chatRoomId
      );

      this.chatrooms.splice(chatroomIndexToRemove, 1);

      if (this.selectedChatroomId == chatRoomId) {
        this.selectedChatroomId = null;
        this.isSidebarOpen = false;
      }

      return chatroomIndexToRemove;
    },
    calculateParticipantsAmount() {
      const selected = this.chatrooms.find(
        (chatroom) => chatroom._id === this.selectedChatroomId
      );
      return selected ? selected.participants.length : 0;
    },
    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
    },
    extractFriendFromChatroom() {
      const selectedChatroom = this.selectedChatroom;
      const chatParticipants = selectedChatroom.participants || [];

      return chatParticipants.find(
        (participant) => participant._id !== this.$store.state.connectedUser._id
      );
    },
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    selectedChatroom() {
      return this.chatrooms.find((c) => c._id === this.selectedChatroomId);
    },
    isConnectedUserAdminInSelectedChatroom() {
      return this.selectedChatroom?.admins.includes(
        this.$store.state.connectedUser._id
      );
    },
    isSelectedChatroomGroupChat() {
      const chatroom = this.selectedChatroom;
      return chatroom ? this.selectedChatroom.isGroupChat : false;
    },
    selectedChatroomName() {
      const chatroom = this.selectedChatroom;
      return chatroom.isGroupChat
        ? chatroom.name
        : this.extractFriendFromChatroom().username;
    },
    selectedChatroomImage() {
      const chatroom = this.selectedChatroom;
      return chatroom.isGroupChat
        ? chatroom.imageUrl
        : this.extractFriendFromChatroom().profilePictureUrl;
    },
    selectedChatroomDetails() {
      return (
        this.chatrooms.find((c) => c._id === this.selectedChatroomId) || {}
      );
    },
  },
};
</script>

<style scoped>
.chat-room {
  display: flex;
  height: 80vh;
}
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.error {
  color: red;
}

.chatroom-top-bar {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #f7f7f7;
  box-shadow: 0 24px 10px rgba(0.5, 0.1, 0.1, 0.1);
  border-bottom: 1px solid rgb(223, 223, 223);
  cursor: pointer;
}

.chatroom-image {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-right: 20px;
}

.chatroom-info {
  flex-grow: 1;
}

.chatroom-name {
  margin: 0;
  font-size: 18px;
}

.chatroom-participants {
  margin: 0;
  font-size: 12px;
  color: #666;
}
</style>
