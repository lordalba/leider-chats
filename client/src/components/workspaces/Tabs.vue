<template>
  <div class="ws-tabs" role="tablist" @keydown="onKeydown">
    <button
      v-for="tab in tabs"
      :key="tab.slug"
      ref="tab"
      type="button"
      role="tab"
      class="ws-tab"
      :class="{ active: value === tab.slug }"
      :aria-selected="value === tab.slug ? 'true' : 'false'"
      :tabindex="value === tab.slug ? 0 : -1"
      @click="$emit('input', tab.slug)"
    >
      {{ tab.label }}
      <span v-if="tab.count != null" class="ws-tab-count">{{ tab.count }}</span>
    </button>
  </div>
</template>

<script>
// Controlled tabs: the parent owns the selected slug (it lives in the URL).
export default {
  name: "TabsComponent",
  props: {
    tabs: { type: Array, required: true }, // [{ slug, label, count? }]
    value: { type: String, required: true },
  },
  methods: {
    // Left/Right move focus and select (WAI-ARIA tabs, automatic activation).
    onKeydown(event) {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const index = this.tabs.findIndex((t) => t.slug === this.value);
      const next = (index + step + this.tabs.length) % this.tabs.length;
      // Arrowing through tabs is browsing: don't fill Back with every tab.
      this.$emit("input", this.tabs[next].slug, { replace: true });
      this.$nextTick(() => this.$refs.tab[next] && this.$refs.tab[next].focus());
    },
  },
};
</script>

<style scoped>
.ws-tabs {
  display: flex;
  gap: var(--ws-space-1);
  border-bottom: 1px solid var(--ws-border);
  margin-bottom: var(--ws-space-4);
}
.ws-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: none;
  color: var(--ws-text-muted);
  font-weight: 500;
  cursor: pointer;
}
.ws-tab:hover {
  color: var(--ws-text);
}
.ws-tab.active {
  color: var(--ws-accent-strong);
  border-bottom-color: var(--ws-accent);
}
.ws-tab-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--ws-surface-muted);
  color: var(--ws-text-muted);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.ws-tab.active .ws-tab-count {
  background: var(--ws-accent-soft);
  color: var(--ws-accent-strong);
}

@media (max-width: 767.98px) {
  .ws-tabs {
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
    margin-bottom: var(--ws-space-3);
  }
  .ws-tab {
    flex: 1 1 0;
    min-width: max-content;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    font-size: 14px;
  }
}
</style>
