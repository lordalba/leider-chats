<template>
  <div id="app" class="app-container">
    <Header />
    <div class="main-content">
      <RouterView />
    </div>
    <Footer />
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
};
</script>

<style>
/* Flexbox layout to push footer to the bottom */
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Full height of the viewport */
  background-color: #e8e8e8;
  font-family: "Lexend", sans-serif;
}

.main-content {
  flex: 1; /* Take up the available space */
}

.footer {
  text-align: center;
  padding: 13px;
  background-color: #f1f1f1;
  color: #555;
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
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
