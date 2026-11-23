<template>
  <div class="presence-bar" :title="`${members.length} here now`">
    <span class="label">Here now</span>
    <UserAvatar
      v-for="member in members"
      :key="member.userId"
      :user-id="member.userId"
      :name="member.username"
      :src="member.profilePictureUrl || ''"
      :size="34"
      class="presence-avatar"
    />
  </div>
</template>

<script>
import UserAvatar from "./UserAvatar.vue";

export default {
  name: "PresenceBar",
  components: { UserAvatar },
  props: {
    members: { type: Array, default: () => [] },
  },
};
</script>

<style scoped>
.presence-bar {
  display: flex;
  align-items: center;
}
.label {
  font-size: 0.8em;
  color: var(--text-muted);
  margin-right: 8px;
}
.presence-avatar {
  margin-left: -6px;
}
.presence-avatar:first-of-type {
  margin-left: 0;
}
</style>
