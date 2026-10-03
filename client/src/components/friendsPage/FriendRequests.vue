<template>
  <div class="friend-requests-sidebar">
    <h2>Friend Requests</h2>
    <div
      v-for="friendRequest in friendRequests"
      :key="friendRequest.id"
      class="friend-request"
    >
      <p>{{ friendRequest.username }} sent you a friend request.</p>
      <div class="request-buttons"></div>
      <button @click="acceptRequest(friendRequest._id)" class="accept-btn">
        Accept
      </button>
      <button @click="declineRequest(friendRequest._id)" class="decline-btn">
        Decline
      </button>
    </div>
    <div v-if="!friendRequests.length" style="opacity: 0.7">
      No Friend Requests at the moment..
    </div>
  </div>
</template>

<script>
import {
  fetchFriendRequests,
  addFriend,
  removeFriendRequest,
} from "../../api/UserService";

export default {
  data() {
    return {
      friendRequests: [],
    };
  },
  components: {

  },
  async created() {
    await this.fetchAllFriendRequests();
  },
  methods: {
    async fetchAllFriendRequests() {
      try {
        const response = await fetchFriendRequests();
        this.friendRequests = response.data;
      } catch (error) {
        console.error("Error fetching friend requests:", error);
      }
    },
    async acceptRequest(requestedFriendId) {
      try {
        await addFriend(requestedFriendId);
        this.removeFromReqeustsList(requestedFriendId);
      } catch (error) {
        console.log(
          `error while adding friend with ID: ${requestedFriendId}` +
            "error: " +
            error
        );
      }
    },
    async declineRequest(requestedFriendId) {
      try {
        await removeFriendRequest(requestedFriendId);
        this.removeFromReqeustsList(requestedFriendId);
      } catch (error) {
        console.log(
          `error while removing friend request with ID: ${requestedFriendId}` +
            "error: " +
            error
        );
      }
    },
    removeFromReqeustsList(id) {
      this.friendRequests = this.friendRequests.filter(
        (request) => request._id !== id
      );
    },
  },
};
</script>

<style scoped>
.friend-requests-sidebar {
  flex: 1;
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-right: 14%;
  margin-top: 2%;
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

.friend-requests-sidebar h2 {
  margin-bottom: 15px;
}

.friend-request {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 5px;
  background-color: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.request-buttons {
  margin-right: 5%;
}

.accept-btn {
  background-color: #28a745;
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 3px;
  margin-right: 5px;
}

.decline-btn {
  background-color: #dc3545;
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 3px;
}
</style>
