<template>
  <div class="search-friends">
    <input
      type="text"
      v-model="searchTerm"
      placeholder="Search for users..."
      @input="debouncedSearch"
      class="search-input"
    />

    <ul v-if="searchedUser.length > 0">
      <li v-for="friend in searchedUser" :key="friend.id">
        <user-card :user="friend" :friends="friends"></user-card>
      </li>
    </ul>
    <p v-else class="no-results">No results found</p>
  </div>
</template>

<script>
import { searchUsers } from "@/api/UserService";
import UserCard from "@/components/friendsPage/UserCard.vue";
import _ from "lodash"; // lodash for debouncing

export default {
  name: "friendsPage",
  data() {
    return {
      searchTerm: "",
      searchedUser: [],
    };
  },
  components: {
    UserCard,
  },
  props: {
    friends: {
      type: Array,
      required: true,
    },
  },
  methods: {
    async search() {
      if (this.searchTerm) {
        try {
          const response = await searchUsers(this.searchTerm);
          // Assuming the API response includes an "isFriend" property
          this.searchedUser = response.data.map((friend) => ({
            ...friend,
            isFriend: false, // Mark all results as not friends initially
          }));
        } catch (error) {
          console.error("Error fetching friends:", error);
        }
      } else {
        this.searchedUser = [];
      }
    },
    debouncedSearch: _.debounce(function () {
      this.search();
    }, 300),
  },
};
</script>

<style scoped>
.search-friends {
  max-width: 100%;
  margin: 3% auto;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 2px 4px var(--shadow);
  background-color: var(--sunken);
}

.search-input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  box-sizing: border-box;
  transition: border-color 0.3s ease-in-out;
}

.search-input:focus {
  border-color: var(--brand); /* Green focus color */
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
  border-bottom: 1px solid var(--line);
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
  border: 1px solid var(--brand-hover);
  border-radius: 4px;
  background-color: var(--brand);
  color: var(--on-brand);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;
}

.add-friend-btn:hover {
  background-color: var(--brand-hover);
}

.friend-added {
  color: var(--muted);
  font-style: italic;
}

.no-results {
  text-align: center;
  padding: 10px;
  color: var(--muted);
}
</style>
