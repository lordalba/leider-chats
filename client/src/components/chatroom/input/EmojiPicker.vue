<template>
  <div class="emoji-picker" role="dialog" aria-label="Emoji picker">
    <nav class="tabs">
      <button
        v-for="(category, index) in categories"
        :key="category.name"
        :class="{ active: index === activeIndex }"
        :title="category.name"
        @click="activeIndex = index"
      >
        {{ category.icon }}
      </button>
    </nav>
    <div class="grid">
      <button v-for="emoji in categories[activeIndex].emojis" :key="emoji" class="emoji" @click="$emit('pick', emoji)">
        {{ emoji }}
      </button>
    </div>
  </div>
</template>

<script>
import { EMOJI_CATEGORIES } from "@/chat/emojis";

/** Emits `pick(emoji)` when an emoji is clicked. */
export default {
  name: "EmojiPicker",
  data() {
    return { categories: EMOJI_CATEGORIES, activeIndex: 0 };
  },
};
</script>

<style scoped>
.emoji-picker {
  width: 320px;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-strong);
  overflow: hidden;
}
.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.tabs button {
  flex: 1;
  padding: 6px 0;
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.6;
}
.tabs button.active {
  opacity: 1;
  border-bottom: 2px solid var(--accent);
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
}
.emoji {
  border: none;
  background: none;
  font-size: 22px;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
}
.emoji:hover {
  background: var(--hover);
}
</style>
