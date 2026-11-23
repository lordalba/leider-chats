<template>
  <div id="app" class="app-container">
    <AppHeader />
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script>
import AppHeader from "./components/AppHeader.vue";

export default {
  name: "App",
  components: { AppHeader },
};
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg);
  color: var(--text);
  font-family: "Lexend", sans-serif;
}

.main-content {
  flex: 1;
}
</style>
