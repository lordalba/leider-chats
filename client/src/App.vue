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
