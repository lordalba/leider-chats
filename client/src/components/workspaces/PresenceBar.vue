<template>
  <div class="presence-bar">
    <div
      v-for="member in members"
      :key="member.userId"
      class="presence-avatar"
      :title="member.username"
    >
      <img
        v-if="member.profilePictureUrl"
        :src="member.profilePictureUrl"
        :alt="member.username"
      />
      <span v-else class="presence-initials">{{ initials(member.username) }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: "PresenceBar",
  props: {
    members: {
      type: Array,
      default: () => [],
    },
  },
  methods: {
    initials(username) {
      const parts = String(username || "?").trim().split(/\s+/);
      return parts
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("");
    },
  },
};
</script>

<style scoped>
.presence-bar {
  display: flex;
  align-items: center;
}
.presence-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid #fff;
  margin-left: -8px;
  overflow: hidden;
  background: #45815c;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.presence-avatar:first-child {
  margin-left: 0;
}
.presence-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
