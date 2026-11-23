<template>
  <li class="result">
    <img v-avatar :src="user.profilePictureUrl" :alt="user.username" class="picture" />
    <div class="who">
      <span class="name">{{ user.username }}</span>
      <span class="email">{{ user.email }}</span>
    </div>
    <span v-if="isFriend" class="note">Already friends</span>
    <span v-else-if="requestSent" class="note">Request sent</span>
    <button v-else class="add" :disabled="sending" @click="sendRequest">
      <i class="fa-solid fa-user-plus"></i> Add
    </button>
  </li>
</template>

<script>
import { sendFriendRequest } from "@/api/UserService";

export default {
  name: "UserSearchResult",
  props: {
    user: { type: Object, required: true },
    friends: { type: Array, required: true },
  },
  data() {
    return { requestSent: false, sending: false };
  },
  computed: {
    isFriend() {
      return this.friends.some((friend) => friend._id === this.user._id);
    },
  },
  methods: {
    async sendRequest() {
      this.sending = true;
      try {
        await sendFriendRequest(this.user._id);
        this.requestSent = true;
      } catch (error) {
        this.$toast.error("Couldn't send the friend request.");
      } finally {
        this.sending = false;
      }
    },
  },
};
</script>

<style scoped>
.result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border);
}
.picture {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.name {
  font-weight: 600;
}
.email {
  font-size: 0.8em;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}
.add {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background-color: #815ffc;
  color: white;
  cursor: pointer;
}
.add:hover {
  background-color: #6444d8;
}
.note {
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.9em;
}
</style>
