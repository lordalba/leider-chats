<template>
  <header class="header">
    <router-link to="/" class="logo">Leider chats</router-link>
    <button
      type="button"
      class="menu-toggle"
      :aria-expanded="menuOpen ? 'true' : 'false'"
      aria-controls="main-nav"
      aria-label="Menu"
      @click="menuOpen = !menuOpen"
    >
      <i :class="['fa-solid', menuOpen ? 'fa-xmark' : 'fa-bars']" aria-hidden="true"></i>
    </button>
    <nav id="main-nav" class="nav" :class="{ open: menuOpen }" aria-label="Main">
      <ul>
        <li v-if="loggedIn">
          <router-link to="/chatrooms" class="menu-item">Chats</router-link>
        </li>
        <li v-if="loggedIn">
          <router-link to="/workspaces" class="menu-item">Workspaces</router-link>
        </li>
        <li v-if="loggedIn">
          <router-link to="/friends" class="menu-item">Friends</router-link>
        </li>
        <li v-if="loggedIn">
          <router-link to="/profile" class="menu-item">Profile</router-link>
        </li>
        <li><router-link to="/about" class="menu-item">About us</router-link></li>
      </ul>
    </nav>
    <div class="header-actions">
      <button v-if="loggedIn" type="button" class="header-action" @click="disconnect">
        <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Log out
      </button>
      <router-link v-else to="/login" class="header-action">
        <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Log in
      </router-link>
    </div>
  </header>
</template>

<script>
import { mapActions } from "vuex";
import { clearSession } from "@/auth/session";

export default {
  name: "HeaderComponent",
  data() {
    return { menuOpen: false };
  },
  watch: {
    // Following a link closes the phone menu.
    $route() {
      this.menuOpen = false;
    },
  },
  computed: {
    loggedIn() {
      return Boolean(this.$store.state.connectedUser);
    },
  },
  methods: {
    ...mapActions(["setConnectedUser"]),
    disconnect() {
      clearSession();

      this.$router.push("/login").catch(() => {});
      this.$toast.info("You're logged out");
    },
  },
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: var(--sunken);
}
.logo {
  font-weight: bold;
  font-size: 24px;
  color: inherit;
  text-decoration: none;
}
.nav ul {
  list-style-type: none;
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.menu-item {
  color: var(--ink);
  text-transform: uppercase;
  text-decoration: none;
  letter-spacing: 0.15em;

  display: inline-block;
  padding: 15px 20px;
  position: relative;
}
.menu-item:after {
  background: none repeat scroll 0 0 transparent;
  bottom: 0;
  content: "";
  display: block;
  height: 2px;
  left: 50%;
  position: absolute;
  background: var(--brand);
  transition: width 0.3s ease 0s, left 0.3s ease 0s;
  width: 0;
}
.menu-item:hover:after,
.menu-item.router-link-active:after {
  width: 100%;
  left: 0;
}
.menu-item.router-link-active {
  color: var(--ws-accent-strong);
}
.menu-item.router-link-active:after {
  background: var(--ws-accent);
}
@media screen and (max-height: 300px) {
  ul {
    margin-top: 40px;
  }
}

.header-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--ws-border);
  border-radius: var(--ws-radius);
  background: var(--ws-surface);
  color: var(--ws-text);
  font-size: 0.9rem;
  text-decoration: none;
  cursor: pointer;
}
.header-action:hover {
  border-color: var(--ws-accent);
  color: var(--ws-accent-strong);
}
.header-action:focus-visible,
.menu-item:focus-visible {
  outline: none;
  box-shadow: var(--ws-focus);
}

.menu-toggle {
  display: none;
}
@media (max-width: 767.98px) {
  .header {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 16px;
  }
  .logo {
    font-size: 20px;
    margin-right: auto;
  }
  .header-actions {
    order: 2;
  }
  .menu-toggle {
    order: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: 1px solid var(--ws-border);
    border-radius: var(--ws-radius);
    background: var(--ws-surface);
    font-size: 18px;
  }
  .nav {
    order: 4;
    display: none;
    width: 100%;
  }
  .nav.open {
    display: block;
  }
  .nav ul {
    flex-direction: column;
    gap: 0;
  }
  .menu-item {
    display: block;
    padding: 12px 4px;
  }
  .menu-item:after {
    display: none;
  }
}
</style>
