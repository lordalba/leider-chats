<template>
  <div id="app" class="app-container" :class="{ 'app--full': fullHeight }">
    <Header />
    <div class="main-content">
      <RouterView />
    </div>
    <Footer v-if="!fullHeight" />
  </div>
</template>

<script>
/* eslint-disable */
import { RouterView } from "vue-router";
import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";

export default {
  name: "App",
  components: {
    Header,
    Footer
  },
  computed: {
    fullHeight() {
      return Boolean(this.$route.meta && this.$route.meta.fullHeight);
    },
  },
};
</script>

<style>
/* Flexbox layout to push footer to the bottom */
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Full height of the viewport */
  background-color: var(--bg);
  font-family: "Lexend", sans-serif;
}

.main-content {
  flex: 1; /* Take up the available space */
}

.footer {
  text-align: center;
  padding: 13px;
  background-color: var(--sunken);
  color: var(--muted);
}
</style>

<style>
/*
 * These global rules used to leak from an unscoped <style> block in
 * views/Workspaces.vue (the router imports it eagerly, so they applied to
 * every page, after the rules above). Other pages depend on them (e.g. the
 * chats page's `.sidebar`), so they are kept here, globally, with their
 * original values. Workspace components use their own class names.
 */
#app {
  display: flex; /* Flexbox layout for sidebar and content */
  height: 100vh; /* Full viewport height */
  overflow: hidden; /* Prevent scrolling */
}

.sidebar {
  height: 100vh; /* Full height */
  box-shadow: 2px 0 5px var(--shadow);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Routes with meta.fullHeight: the page fills the space under the header and
   never scrolls itself; its own panes do. */
#app.app--full {
  flex-direction: column;
}
#app.app--full .main-content {
  display: flex;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}
</style>
