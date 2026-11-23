<template>
  <span
    class="user-avatar"
    :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.4 + 'px', borderColor: color }"
    :title="name"
  >
    <img :src="src && !failed ? src : defaultAvatar" :alt="name" @error="failed = true" />
  </span>
</template>

<script>
import { colorForUser } from "@/workspaces/colors";
import { DEFAULT_AVATAR } from "@/utils/avatar";

export default {
  name: "UserAvatar",
  props: {
    userId: { type: String, default: "" },
    name: { type: String, default: "" },
    src: { type: String, default: "" },
    size: { type: Number, default: 32 },
  },
  data() {
    return { failed: false, defaultAvatar: DEFAULT_AVATAR };
  },
  computed: {
    color() {
      return colorForUser(this.userId);
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
