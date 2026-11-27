<template>
  <div class="empty-state">
    <i :class="['fa-solid', icon, 'empty-state-icon']" aria-hidden="true"></i>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p v-if="body" class="empty-state-body">{{ body }}</p>
    <b-button v-if="actionLabel" variant="primary" size="sm" @click="$emit('action')">
      {{ actionLabel }}
    </b-button>
  </div>
</template>

<script>
// A blank area that says what goes here and offers the next step.
export default {
  name: "EmptyState",
  props: {
    icon: { type: String, required: true }, // Font Awesome class, e.g. "fa-file-lines"
    title: { type: String, required: true },
    body: { type: String, default: "" },
    actionLabel: { type: String, default: "" },
  },
};
</script>

<style scoped>
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ws-space-2);
  padding: 48px var(--ws-space-4);
  text-align: center;
  color: var(--ws-text-muted);
}
.empty-state-icon {
  font-size: 36px;
  color: var(--ws-accent);
  opacity: 0.7;
  margin-bottom: var(--ws-space-2);
}
.empty-state-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ws-text);
}
.empty-state-body {
  max-width: 360px;
  margin: 0 0 var(--ws-space-2);
}
</style>
