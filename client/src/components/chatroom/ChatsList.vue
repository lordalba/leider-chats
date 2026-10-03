<template>
  <div class="sidebar">
    <SearchBar :value="searchInput"
  @onSearch="handleSearch"></SearchBar>
    <div class="contacts">
      <div
        v-if="loading"
        style="
          opacity: 0.7;
          text-align: center;
          margin-top: 10%;
          font-size: larger;
        "
      >
        Loading...
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <ChatCard
        v-for="(chatroom, index) in searchFilteredChatrooms"
        :key="`${chatroom._id}-${index}-${chatroom.unreadMessages}`"
        :chatroom="chatroom"
        :chatroom-id="chatroom._id"
        @chatroom-selected="handleChatroomSelected"
      />
      <p
        v-if="!searchFilteredChatrooms.length && !loading"
        style="opacity: 0.7; text-align: center; margin-top: 10%"
      >
        No one to Talk to..
      </p>
      <div style="text-align: center">
        <button class="create-chat" @click="showModal = true">
          create new chat
        </button>
        <CreateChatModal
          :is-open="showModal"
          :friends="friends"
          @close="showModal = false"
        ></CreateChatModal>
      </div>
    </div>
  </div>
</template>

<script>
import SearchBar from "../SearchBar.vue";
import ChatCard from "./ChatCard.vue";
import CreateChatModal from "./createChat/CreateChatModal.vue";
import { fetchFriends } from "@/api/UserService";

/* eslint-disable */
export default {
  components: {
    ChatCard,
    CreateChatModal,
    SearchBar
  },
  props: {
    chatrooms: {
      type: Array,
      Required: true,
    },
    loading: {
      type: Boolean,
      Required: true,
    },
    error: {
      type: String,
      Required: true,
    },
  },
  data() {
    return {
      showModal: false,
      friends: [],
      selectedChatroomId: null,
      localChatrooms: [],
      searchInput: ""
    };
  },
  async created() {
    await this.fetchAllFriends();

    if (this.socket) {
      this.socket.on("newChatMessage", (data) => {
        this.$emit("new-message", data);
      });
      this.socket.on("roomDeleted", (data) => {
        this.$emit("chatroom-deleted", data);
      });
    }
  },
  mounted() {},
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    searchFilteredChatrooms() {
      return this.chatrooms.filter((chatroom) => chatroom.name.toLowerCase().includes(this.searchInput))
    }
  },
  methods: {
    handleSearch(query) {
      this.searchInput = query;
  },
    async fetchAllFriends() {
      try {
        const response = await fetchFriends();
        this.friends = response.data;
      } catch (error) {
        console.error("Error fetching friends:", error);
      }
    },
    handleChatroomSelected(chatroomId) {
      this.$emit("chatroom-selected", chatroomId);
      const selectedChatroomIndex = this.localChatrooms.findIndex(
        (chatroom) => chatroom._id === chatroomId
      );
      this.selectedChatroomId = this.localChatrooms[selectedChatroomIndex]._id;
      this.localChatrooms[selectedChatroomIndex].unreadMessages = 0;
    },
  },
  watch: {
    chatrooms: {
      immediate: true,
      handler(newVal) {
        this.localChatrooms = JSON.parse(JSON.stringify(newVal)); // Reactive deep copy
      },
    },
  },
};
</script>

<style scoped>
.sidebar {
  width: 300px;
  height: 85vh;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.search-bar {
  padding: 10px;
  width: 200%;
  text-decoration: solid;
}
.contacts {
  overflow-y: auto;
  flex: 1;
}

.create-chat {
  margin-top: 10%;
  margin-bottom: 10%;
  width: 200px;
  height: 60px;
  border: 3px solid #2fa7f7;
  border-radius: 45px;
  transition: all 0.3s;
  cursor: pointer;
  background: white;
  font-size: 1.2em;
  font-weight: 550;
}

.create-chat:hover {
  background: #57bbf5;
  color: white;
  font-size: 1.3em;
}
</style>
