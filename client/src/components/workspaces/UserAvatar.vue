<template>
  <div
    class="user-avatar"
    :title="username"
    :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.4 + 'px' }"
  >
    <img v-if="src" :src="src" :alt="username" />
    <span v-else>{{ initials }}</span>
  </div>
</template>

<script>
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
    size: {
      type: Number,
      default: 34,
    },
  },
  computed: {
    initials() {
      const parts = String(this.username || "?").trim().split(/\s+/);
      return parts
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("");
    },
  },
};
</script>

<style scoped>
.user-avatar {
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid #fff;
  overflow: hidden;
  background: #45815c;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
