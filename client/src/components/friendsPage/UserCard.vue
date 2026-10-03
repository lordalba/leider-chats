<template>
  <div class="friend-item">
    <h7 class="friend-username">
      {{ user.username }}
      <div class="friend-email">{{ user.email }}</div>
    </h7>
    <button v-if="!isRequestSent && !isUserFriend" @click="addFriend()" class="add-friend-btn">
      Add Friend
    </button>
    <span v-else-if="isUserFriend" class="friend-added">Already friends</span>
    <span v-else class="friend-added">Sent Request</span>
  </div>
</template>

<script>
import { addFriendReqest } from "@/api/UserService";

export default {
  name: "userCard",
  props: {
    user: {
      type: Object,
      required: true,
    },
    friends: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      isRequestSent: false,
    };
  },
  async created() {},
  computed: {
    isUserFriend() {
      return this.friends.some(friend => friend._id === this.user._id);
    },
  },
  watch: {
    user: {
      handler(newVal) {
        console.log("user status changed:", newVal);
      },
      deep: true,
    },
  },
  methods: {
    async addFriend() {
      this.isRequestSent = true;
      await addFriendReqest(this.user._id);
    },
  },
};
</script>

<style scoped>
.search-friends {
  max-width: 100%;
  margin: 3% auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background-color: #f5f5f5;
}

.search-input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  transition: border-color 0.3s ease-in-out;
}

.search-input:focus {
  border-color: #815ffc; /* Green focus color */
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.friend-username {
  flex: 1;
  font-weight: bold;
}

.friend-email {
  flex: 1;
  font-weight: lighter;
  font-size: smaller;
  opacity: 35%;
}

.add-friend-btn {
  padding: 8px 12px;
  border: 1px solid #5a15b4;
  border-radius: 4px;
  background-color: #815ffc;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;
}

.add-friend-btn:hover {
  background-color: #6444d8;
}

.friend-added {
  color: #999;
  font-style: italic;
}

.no-results {
  text-align: center;
  padding: 10px;
  color: #666;
}
</style>
