<template>
  <div class="presence-bar">
    <UserAvatar
      v-for="member in members"
      :key="member.userId"
      class="presence-avatar"
      :username="member.username"
      :src="member.profilePictureUrl || ''"
    />
  </div>
</template>

<script>
import UserAvatar from "@/components/workspaces/UserAvatar.vue";

export default {
  name: "PresenceBar",
  components: { UserAvatar },
  props: {
    members: {
      type: Array,
      default: () => [],
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
  margin-left: -8px;
}
.presence-avatar:first-child {
  margin-left: 0;
}
</style>
