<template>
  <div class="friends-page">
    <section class="friends">
      <div class="toolbar">
        <input v-model="searchTerm" type="search" placeholder="Search your friends…" class="search" />
        <b-button v-b-toggle="sidebarId" class="find-button">
          <i class="fa-solid fa-user-plus"></i> Find friends to add
        </b-button>
      </div>

      <p v-if="loading" class="empty">Loading friends…</p>
      <p v-else-if="!friends.length" class="empty">No friends yet. Use “Find friends to add” to get started.</p>
      <p v-else-if="!filteredFriends.length" class="empty">No friends match your search.</p>
      <div class="list">
        <FriendCard v-for="friend in filteredFriends" :key="friend._id" :user="friend" @removed="onFriendRemoved" />
      </div>
    </section>

    <FriendRequestsPanel @accepted="loadFriends" />
    <FindFriendsSidebar :id="sidebarId" :friends="friends" />
  </div>
</template>

<script>
import { fetchFriends } from "@/api/UserService";
import FriendCard from "@/components/friends/FriendCard.vue";
import FriendRequestsPanel from "@/components/friends/FriendRequestsPanel.vue";
import FindFriendsSidebar from "@/components/friends/FindFriendsSidebar.vue";

export default {
  name: "FriendsPage",
  components: { FriendCard, FriendRequestsPanel, FindFriendsSidebar },
  data() {
    return { friends: [], searchTerm: "", loading: true, sidebarId: "find-friends-sidebar" };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    filteredFriends() {
      const term = this.searchTerm.trim().toLowerCase();
      if (!term) return this.friends;
      return this.friends.filter((friend) => friend.username.toLowerCase().includes(term));
    },
  },
  created() {
    if (this.socket) this.socket.on("friendStatusUpdate", this.onFriendStatusUpdate);
    this.loadFriends();
  },
  beforeDestroy() {
    if (this.socket) this.socket.off("friendStatusUpdate", this.onFriendStatusUpdate);
  },
  methods: {
    async loadFriends() {
      try {
        const { data } = await fetchFriends();
        this.friends = data || [];
      } catch (error) {
        this.$toast.error("Couldn't load your friends.");
      } finally {
        this.loading = false;
      }
    },
    onFriendStatusUpdate(update) {
      const friend = this.friends.find((f) => f._id === update.id);
      if (friend) friend.isOnline = update.online;
    },
    onFriendRemoved(friendId) {
      this.friends = this.friends.filter((f) => f._id !== friendId);
    },
  },
};
</script>

<style scoped>
.friends-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 40px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 32px;
}
@media (max-width: 900px) {
  .friends-page {
    grid-template-columns: 1fr;
  }
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.search {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.find-button {
  white-space: nowrap;
  background-color: #4f8ff0;
  border: none;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.empty {
  color: var(--text-muted);
}
</style>
