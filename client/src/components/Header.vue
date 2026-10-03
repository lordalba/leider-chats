<template>
  <header class="header">
    <div class="logo" style="text">Leider chats</div>
    <nav class="nav">
      <ul>
        <router-link to="/" class="menu-item">
          <li>Home</li>
        </router-link>

        <router-link
          v-if="$store.state.connectedUser"
          to="/friends"
          class="menu-item"
        >
          <li>Projects</li>
        </router-link>

        <router-link
          v-if="$store.state.connectedUser"
          to="/friends"
          class="menu-item"
        >
          <li>Friends</li>
        </router-link>

        <router-link to="/about" class="menu-item">
          <li>About us</li>
        </router-link>

        <router-link to="/workspaces" class="menu-item">
          <li>Workspaces</li>
        </router-link>

        <router-link
          v-if="$store.state.connectedUser"
          to="/profile"
          class="menu-item"
        >
          <li>Profile</li>
        </router-link>
      </ul>
    </nav>
    <div class="icons">
      <i
        v-if="$store.state.connectedUser"
        class="fa-solid fa-user-slash"
        @mousedown="disconnect()"
      ></i>
      <router-link v-else to="/login" class="icon-menu-item">
        <i class="fa-solid fa-right-to-bracket"></i>
      </router-link>

      <i class="fas fa-search"></i>
      <i class="fas fa-shopping-cart"></i>
    </div>
  </header>
</template>

<script>
import { mapActions } from "vuex";
import Swal from "sweetalert2";
import store from "@/store/store";

export default {
  name: "HeaderComponent",
  data() {
    return {};
  },
  methods: {
    ...mapActions(["setConnectedUser"]),
    disconnect() {
      localStorage.setItem("token", null);
      store.dispatch("setConnectedUser", undefined);
      this.socket.disconnect();
      
      this.$router.push("/");
      Swal.fire({
        icon: "success",
        title: "good job!",
        text: "Signed Off successfuly!",
        footer: '<a href="shorturl.at/gwRUY">why is your mother in a pita?</a>',
      });
    },
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
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
  background-color: #f1f1f1;
}
.logo {
  font-weight: bold;
  font-size: 24px;
}
.nav ul {
  list-style-type: none;
  display: flex;
  gap: 35px;
}

.nav ul li:hover {
  transform: scale(1.06);
}

.menu-item {
  color: #000000;
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
  background: #000000;
  transition: width 0.3s ease 0s, left 0.3s ease 0s;
  width: 0;
}
.menu-item:hover:after {
  width: 100%;
  left: 0;
}
@media screen and (max-height: 300px) {
  ul {
    margin-top: 40px;
  }
}

.icon-menu-item {
  color: #000000;
}

.icons i {
  margin-left: 25px;
  cursor: pointer;
}
</style>
