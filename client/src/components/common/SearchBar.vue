<template>
  <label class="search-box">
    <i class="fa-solid fa-magnifying-glass"></i>
    <input v-model="searchText" type="search" :placeholder="placeholder" @input="emitSoon" />
  </label>
</template>

<script>
const DEBOUNCE_MS = 250;

/** A search field that emits `onSearch(text)` shortly after the user stops typing. */
export default {
  name: "SearchBar",
  props: {
    value: { type: String, default: "" },
    placeholder: { type: String, default: "Search chats…" },
  },
  data() {
    return { searchText: this.value };
  },
  watch: {
    value(newValue) {
      this.searchText = newValue;
    },
  },
  beforeDestroy() {
    clearTimeout(this.timer);
  },
  methods: {
    emitSoon() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.$emit("onSearch", this.searchText), DEBOUNCE_MS);
    },
  },
};
</script>

<style scoped>
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-muted);
}
.search-box input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
}
</style>
