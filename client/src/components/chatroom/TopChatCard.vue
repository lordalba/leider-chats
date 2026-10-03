<template>
    <div class="sidebar">
      <div class="contacts">
        <div v-if="loading" style="opacity: 0.7; text-align: center; margin-top: 10%; font-size: larger">Loading...</div>
        <div v-if="error" class="error">{{ error }}</div>
        <p
          v-if="!chatrooms.length && !loading"
          style="opacity: 0.7; text-align: center; margin-top: 10%"
        >
          No one to Talk to..
        </p>
      </div>
    </div>
  </template>
  
  <script>
  import ChatCard from "./ChatCard.vue";
  import { fetchFriends } from "@/api/UserService";
  
  /* eslint-disable */
  export default {
    components: {
      ChatCard,
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
      };
    },
    async created() {
      await this.fetchAllFriends();
    },
    mounted() {},
    computed: {
      socket() {
        return this.$store.getters["socket/socket"];
      },
    },
    methods: {
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
      },
    },
  };
  </script>
  
  <style scoped>
  .sidebar {
    height: 80px;
    width: 85vh;
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
  