<template>
  <div class="empty-state">
    <h3>Welcome to the Workspaces Dashboard</h3>
    <p>Select a workspace or create a new one to get started!</p>
  </div>
</template>

<script>
export default {
  name: "EmptyState",
  data() {
    return {};
  },
  methods: {},
};
</script>

<style scoped>
.empty-state {
  text-align: center;
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  color: gray;
}
</style>
