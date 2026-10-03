<template>
    <div class="chat-room">
      <!-- ChatsList Component -->
      <ChatsList
        :chatrooms="chatrooms"
        :loading="loading"
        :error="error"
        @chatroom-selected="selectChatroom"
      />
      <div class="chat-main">
        <!-- Chatroom Top Bar -->
        <div v-if="selectedChatroomId" class="chatroom-top-bar" @click="toggleSidebar">
          <img :src="selectedChatroomImage" alt="Chatroom" class="chatroom-image" />
          <div class="chatroom-info">
            <h3>{{ selectedChatroomName }}</h3>
            <p>{{ `click to watch ${isSelectedChatroomGroupChat ? "GroupChat" : "User"} details` }}</p>
          </div>
        </div>
  
        <!-- Main Components -->
        <MessageList
          :chatroom-id="selectedChatroomId"
          :participants-amount="participantsAmount"
          :is-group-chat="isSelectedChatroomGroupChat"
        />
        <ChatInput :chatroom-id="selectedChatroomId" />
      </div>
  
      <!-- Sidebar for Chatroom Details -->
      <ChatroomSidebar
        v-if="isSidebarOpen"
        :chatroom="selectedChatroomDetails"
        :is-group-chat="isSelectedChatroomGroupChat"
        @close="toggleSidebar"
      />
    </div>
  </template>
  
  <script>
  import ChatsList from "@/components/chatroom/ChatsList.vue";
  import MessageList from "@/components/chatroom/MessageList.vue";
  import ChatInput from "@/components/chatroom/ChatInput.vue";
  import ChatroomSidebar from "@/components/chatroom/ChatroomSidebar.vue";
  import { fetchChatRooms } from "@/api/ChatRoomService";
  
  export default {
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
        selectedChatroomId: null,
        isSidebarOpen: false,
      };
    },
    async mounted() {
      await this.initializeChatrooms();
    },
    methods: {
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
      selectChatroom(chatroomId) {
        this.selectedChatroomId = chatroomId;
        this.isSidebarOpen = false;
      },
      toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
      },
    },
    computed: {
      selectedChatroomDetails() {
        return this.chatrooms.find((c) => c._id === this.selectedChatroomId) || {};
      },
      selectedChatroomImage() {
        const chatroom = this.selectedChatroomDetails;
        return chatroom?.imageUrl || "";
      },
      selectedChatroomName() {
        const chatroom = this.selectedChatroomDetails;
        return chatroom?.name || "Chatroom";
      },
      isSelectedChatroomGroupChat() {
        return this.selectedChatroomDetails?.isGroupChat || false;
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
  .chatroom-top-bar {
    display: flex;
    align-items: center;
    padding: 10px;
    background: #f7f7f7;
    border-bottom: 1px solid #ddd;
    cursor: pointer;
  }
  .chatroom-image {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    margin-right: 10px;
  }
  </style>
  