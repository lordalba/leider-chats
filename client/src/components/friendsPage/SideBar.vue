<template>
<b-sidebar
  id="sidebar-footer"
  aria-label="Sidebar with custom footer"
  no-header
  shadow
  width="30%"
>
  <AddFriendsPage :friends="friends"></AddFriendsPage>
</b-sidebar>
</template>

<script>
import AddFriendsPage from "@/views/AddFriendsPage.vue";

export default {
  name: "friendsPage",
  components: {
    AddFriendsPage,
  },
  props: {
    friends: {
      type: Array,
      required: true,
    },
  },
};
</script>

<style scoped>
</style>
