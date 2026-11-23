<template>
  <div class="user-search">
    <h4>Find friends</h4>
    <input
      v-model="searchTerm"
      type="text"
      placeholder="Search by username…"
      class="search-input"
      @input="debouncedSearch"
    />
    <p v-if="searching" class="hint">Searching…</p>
    <ul v-else-if="results.length">
      <UserSearchResult v-for="user in results" :key="user._id" :user="user" :friends="friends" />
    </ul>
    <p v-else-if="searchTerm.trim()" class="hint">No users found.</p>
    <p v-else class="hint">Type a username to find people to add.</p>
  </div>
</template>

<script>
import debounce from "lodash/debounce";
import { searchUsers } from "@/api/UserService";
import UserSearchResult from "./UserSearchResult.vue";

export default {
  name: "UserSearch",
  components: { UserSearchResult },
  props: {
    friends: { type: Array, required: true },
  },
  data() {
    return { searchTerm: "", results: [], searching: false };
  },
  created() {
    this.debouncedSearch = debounce(this.search, 300);
  },
  beforeDestroy() {
    this.debouncedSearch.cancel();
  },
  methods: {
    async search() {
      const term = this.searchTerm.trim();
      if (!term) {
        this.results = [];
        return;
      }
      this.searching = true;
      try {
        const { data } = await searchUsers(term);
        const me = this.$store.state.connectedUser && this.$store.state.connectedUser._id;
        this.results = data.filter((user) => user._id !== me);
      } catch (error) {
        this.results = [];
        this.$toast.error("Search failed. Please try again.");
      } finally {
        this.searching = false;
      }
    },
  },
};
</script>

<style scoped>
.user-search {
  padding: 20px;
}
h4 {
  margin-bottom: 14px;
}
.search-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
ul {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
}
.hint {
  margin-top: 14px;
  color: var(--text-muted);
  text-align: center;
}
</style>
