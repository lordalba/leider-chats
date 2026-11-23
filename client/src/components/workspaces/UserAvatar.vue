<template>
  <span
    class="user-avatar"
    :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.4 + 'px', borderColor: color }"
    :title="name"
  >
    <img v-if="src && !failed" :src="src" :alt="name" @error="failed = true" />
    <span v-else class="initials" :style="{ backgroundColor: color }">{{ initials }}</span>
  </span>
</template>

<script>
import { colorForUser, initialsOf } from "@/workspaces/colors";

export default {
  name: "UserAvatar",
  props: {
    userId: { type: String, default: "" },
    name: { type: String, default: "" },
    src: { type: String, default: "" },
    size: { type: Number, default: 32 },
  },
  data() {
    return { failed: false };
  },
  computed: {
    color() {
      return colorForUser(this.userId);
    },
    initials() {
      return initialsOf(this.name);
    },
  },
  watch: {
    src() {
      this.failed = false;
    },
  },
};
</script>

<style scoped>
.user-avatar {
  display: inline-flex;
  border-radius: 50%;
  border: 2px solid;
  overflow: hidden;
  flex-shrink: 0;
  background: #fff;
}
.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
}
</style>
