<template>
  <b-sidebar :id="id" aria-label="Find friends" shadow right backdrop width="380px">
    <UserSearch :friends="friends" />
  </b-sidebar>
</template>

<script>
import UserSearch from "./UserSearch.vue";

/** Slide-in panel for finding users and sending friend requests. Open it with v-b-toggle="id". */
export default {
  name: "FindFriendsSidebar",
  components: { UserSearch },
  props: {
    id: { type: String, required: true },
    friends: { type: Array, required: true },
  },
};
</script>
