<template>
  <header class="header">
    <router-link to="/" class="logo">Leider chats</router-link>
    <button
      v-if="!connectedUser"
      class="icon-button theme-toggle"
      :title="isDark ? 'Light mode' : 'Dark mode'"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggleTheme"
    >
      <i :class="isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
    </button>

    <!-- Page links only when logged in; the login/sign-up pages stay uncluttered. -->
    <template v-if="connectedUser">
      <nav class="nav">
        <ul>
          <li><router-link to="/chatrooms" class="menu-item">Chatrooms</router-link></li>
          <li><router-link to="/workspaces" class="menu-item">Workspaces</router-link></li>
          <li><router-link to="/friends" class="menu-item">Friends</router-link></li>
          <li><router-link to="/profile" class="menu-item">Profile</router-link></li>
        </ul>
      </nav>
      <div class="account">
        <button
          class="icon-button"
          :title="isDark ? 'Light mode' : 'Dark mode'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <i :class="isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
        </button>
        <span class="username">{{ connectedUser.username }}</span>
        <button class="icon-button logout" title="Log out" aria-label="Log out" @click="logout">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </template>
  </header>
</template>

<script>
import { endSession } from "@/auth/session";
import themeManager from "@/theme/ThemeManager";

export default {
  name: "AppHeader",
  data() {
    return { isDark: themeManager.isDark };
  },
  created() {
    this.stopWatchingTheme = themeManager.onChange(() => (this.isDark = themeManager.isDark));
  },
  beforeDestroy() {
    this.stopWatchingTheme();
  },
  computed: {
    connectedUser() {
      return this.$store.state.connectedUser;
    },
  },
  methods: {
    toggleTheme() {
      themeManager.toggle();
    },
    logout() {
      endSession();
      this.$router.push("/login").catch(() => {});
      this.$toast.info("You're logged out.");
    },
  },
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 10px 24px;
  background-color: var(--surface-2);
  border-bottom: 1px solid var(--border);
  min-height: 70px;
}
.logo {
  font-weight: bold;
  font-size: 24px;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
}
.nav ul {
  list-style-type: none;
  display: flex;
  gap: 20px;
  margin: 0;
  padding: 0;
}
.menu-item {
  color: var(--text);
  text-transform: uppercase;
  text-decoration: none;
  letter-spacing: 0.15em;
  display: inline-block;
  padding: 15px 16px;
  position: relative;
}
.menu-item:after {
  bottom: 0;
  content: "";
  display: block;
  height: 2px;
  left: 50%;
  position: absolute;
  background: var(--text);
  transition: width 0.3s ease 0s, left 0.3s ease 0s;
  width: 0;
}
.menu-item:hover:after,
.menu-item.router-link-active:after {
  width: 100%;
  left: 0;
}
.menu-item.router-link-active {
  font-weight: 600;
}
.account {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
.username {
  color: var(--text-muted);
}
.icon-button {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text);
}
.theme-toggle {
  margin-left: auto;
}
.logout:hover {
  color: #b81010;
}
</style>
