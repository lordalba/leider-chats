<template>
  <div class="friends-page">
    <!-- Main Friends List Section -->
    <div class="friends-list">
      <input
        type="text"
        placeholder="Search friends..."
        v-model="searchTerm"
        class="search-bar"
      />

      <div
        v-for="friend in filteredFriends"
        :key="friend.id"
        class="friend-card"
      >
        <FriendCard :user="friend"></FriendCard>
      </div>

      <b-button v-b-toggle.sidebar-footer class="add-friend-btn"
        >Find friends to add</b-button
      >
      <SideBar :friends="friends"></SideBar>
    </div>

    <FriendRequests></FriendRequests>
    <!-- Chat Button -->
    <router-link to="/chat">
      <button class="chat-button" @click="openChat">
        Chat with your friends
      </button>
    </router-link>
  </div>
</template>

<script>
import { fetchFriends } from "../api/UserService";
import FriendCard from "@/components/friendsPage/FriendCard.vue";
import SideBar from "@/components/friendsPage/SideBar.vue";
import FriendRequests from "@/components/friendsPage/FriendRequests.vue";

export default {
  data() {
    return {
      friends: [],
      searchTerm: "",
    };
  },
  components: {
    SideBar,
    FriendCard,
    FriendRequests,
  },
  async created() {
    await this.fetchAllFriends();

    if (this.socket) {
      this.socket.on("friendStatusUpdate", (updatedFriend) => {
        console.log("Friend status updated:", updatedFriend);
        const friendIndex = this.friends.findIndex(
          (f) => f._id === updatedFriend.id
        );
        if (friendIndex !== -1) {
          this.friends[friendIndex].isOnline = updatedFriend.online;
        }
      });
    }
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    filteredFriends() {
      return this.friends.filter((friend) =>
        friend.username.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
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
    openChat() {
      // Logic to open the chat interface goes here
    },
  },
};
</script>

<style scoped>
.friends-page {
  display: flex;
  gap: 20px;
}

.friends-list {
  flex: 3;
  margin-left: 10%;
}

.friend-requests-sidebar {
  flex: 1;
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-right: 14%;
  margin-top: 2%;
}

.search-bar {
  width: 900px;
  margin-left: 4%;
  margin-top: 1%;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 5px;
  border: 1px solid #ccc;
}

.friend-card {
  align-items: center;
  margin-left: 4%;
}

.friend-info {
  display: flex;
  gap: 10px;
  align-items: center;
}

.profile-picture {
  width: 50px;
  height: 50px;
  border-radius: 50%;
}

.message-btn {
  background-color: #28a745;
  color: white;
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
}

.add-friend-btn {
  display: block;
  width: 60%;
  padding: 10px;
  margin-top: 4%;
  margin-left: 20%;
  background-color: #65acf8;
  color: white;
  border: none;
  border-radius: 5px;
  text-align: center;
}

.chat-button {
  position: fixed;
  bottom: 50px;
  right: 60px;
  background-color: #4caf50;
  color: white;
  padding: 10px 20px;
  font-size: 130%;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
</style>
