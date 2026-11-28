<template>
  <div
    class="user-avatar"
    :title="username"
    :style="{
      width: size + 'px',
      height: size + 'px',
      fontSize: size * 0.4 + 'px',
      background: color,
    }"
  >
    <img v-if="src && !imgFailed" :src="src" :alt="username" @error="imgFailed = true" />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </div>
</template>

<script>
import { userColor } from "@/workspaces/items";

export default {
  name: "UserAvatar",
  props: {
    username: {
      type: String,
      default: "",
    },
    src: {
      type: String,
      default: "",
    },
    // Gives the initials fallback a stable per-user color.
    userId: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 34,
    },
  },
  data() {
    return {
      // A missing/broken image shows initials, never alt text.
      imgFailed: false,
    };
  },
  computed: {
    initials() {
      const parts = String(this.username || "?").trim().split(/\s+/);
      return parts
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("");
    },
    color() {
      return this.userId ? userColor(this.userId) : "var(--ws-accent)";
    },
  },
  watch: {
    src() {
      this.imgFailed = false;
    },
  },
};
</script>

<style scoped>
.user-avatar {
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--line);
  overflow: hidden;
  color: var(--on-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(43, 29, 20, 0.2);
}
.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
