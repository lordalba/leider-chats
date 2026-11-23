<template>
  <aside class="requests">
    <h3>Friend Requests</h3>
    <p v-if="loading" class="empty">Loading…</p>
    <p v-else-if="!requests.length" class="empty">No friend requests at the moment.</p>
    <ul v-else>
      <li v-for="request in requests" :key="request._id" class="request">
        <img v-avatar :src="request.profilePictureUrl" :alt="request.username" class="picture" />
        <span class="name">{{ request.username }}</span>
        <div class="actions">
          <button class="accept" title="Accept" @click="accept(request._id)">
            <i class="fa-solid fa-check"></i>
          </button>
          <button class="decline" title="Decline" @click="decline(request._id)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </li>
    </ul>
  </aside>
</template>

<script>
import { acceptFriendRequest, declineFriendRequest, fetchFriendRequests } from "@/api/UserService";

export default {
  name: "FriendRequestsPanel",
  data() {
    return { requests: [], loading: true };
  },
  created() {
    this.load();
  },
  methods: {
    async load() {
      try {
        const { data } = await fetchFriendRequests();
        this.requests = data || [];
      } catch (error) {
        this.$toast.error("Couldn't load friend requests.");
      } finally {
        this.loading = false;
      }
    },
    async accept(userId) {
      try {
        await acceptFriendRequest(userId);
        this.forget(userId);
        // Let the page refresh its friends list right away.
        this.$emit("accepted", userId);
      } catch (error) {
        this.$toast.error("Couldn't accept the request. Please try again.");
      }
    },
    async decline(userId) {
      try {
        await declineFriendRequest(userId);
        this.forget(userId);
      } catch (error) {
        this.$toast.error("Couldn't decline the request. Please try again.");
      }
    },
    forget(userId) {
      this.requests = this.requests.filter((request) => request._id !== userId);
    },
  },
};
</script>

<style scoped>
.requests {
  background-color: var(--surface);
  padding: 20px;
  border-radius: 12px;
  box-shadow: var(--shadow);
  align-self: start;
}
h3 {
  margin-bottom: 15px;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.request {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.picture {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.name {
  flex: 1;
  font-weight: 500;
}
.actions {
  display: flex;
  gap: 6px;
}
.accept,
.decline {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
}
.accept {
  background-color: #28a745;
}
.decline {
  background-color: #dc3545;
}
.empty {
  color: var(--text-muted);
}
</style>
