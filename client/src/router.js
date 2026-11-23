import VueRouter from "vue-router";
import LoginPage from "./views/LoginPage.vue";
import RegisterPage from "./views/RegisterPage.vue";
import FriendsPage from "./views/FriendsPage.vue";
import ProfilePage from "./views/ProfilePage.vue";
import ChatRoomsPage from "./views/ChatRoomsPage.vue";
import WorkspacesPage from "./views/WorkspacesPage.vue";
import store from "./store/store";

const router = new VueRouter({
  scrollBehavior() {
    return { x: 0, y: 0 };
  },
  routes: [
    // The main page: chatrooms when logged in, otherwise the login page.
    {
      path: "/",
      redirect: () => (store.state.connectedUser ? "/chatrooms" : "/login"),
    },
    {
      path: "/login",
      name: "login",
      component: LoginPage,
      meta: { title: "Log in", guestOnly: true },
    },
    {
      path: "/register",
      name: "register",
      component: RegisterPage,
      meta: { title: "Sign up", guestOnly: true },
    },
    {
      path: "/chatrooms",
      name: "chatrooms",
      component: ChatRoomsPage,
      meta: { title: "Chatrooms", requiresAuth: true },
    },
    {
      path: "/workspaces/:workspaceId?",
      name: "workspaces",
      component: WorkspacesPage,
      meta: { title: "Workspaces", requiresAuth: true },
    },
    {
      path: "/friends",
      name: "friends",
      component: FriendsPage,
      meta: { title: "Friends", requiresAuth: true },
    },
    {
      path: "/profile",
      name: "profile",
      component: ProfilePage,
      meta: { title: "Profile", requiresAuth: true },
    },
    // Unknown addresses (including the removed Home/About pages) go to the main page.
    { path: "*", redirect: "/" },
  ],
});

router.beforeEach((to, from, next) => {
  const loggedIn = !!store.state.connectedUser;

  if (to.matched.some((r) => r.meta.requiresAuth) && !loggedIn) {
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }
  if (to.matched.some((r) => r.meta.guestOnly) && loggedIn) {
    next("/chatrooms");
    return;
  }

  document.title = to.meta.title ? `${to.meta.title} · Leider chats` : "Leider chats";
  next();
});

export default router;
