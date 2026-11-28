import Login from "./views/Login.vue";
import VueRouter from "vue-router";
import { pageTitle } from "./pageTitle";
import { entryPath } from "./entryRoute";
import store from "./store/store";
import Register from "./views/Register.vue";
import FriendsPage from "./views/FriendsPage.vue";
import Profile from "./views/Profile.vue";
import About from "./views/About.vue";
import ChatRoom from "./views/ChatRoom.vue";
import Workspaces from "./views/Workspaces.vue";

/* eslint-disable */
const router = new VueRouter({
  scrollBehavior: function (to, from, savedPosition) {
    document.getElementById("app").scrollIntoView();
  },
  routes: [
    {
      // No home page: straight to the chats (or the login page).
      path: "/",
      redirect: () => entryPath(localStorage.getItem("token")),
    },

    {
      path: "/login",
      name: "log in",
      component: Login,
      meta: {
        title: "Log in",
      },
    },

    {
      path: "/register",
      name: "Register",
      component: Register,
      meta: {
        title: "Register",
      },
    },

    {
      path: "/friends",
      name: "friends",
      component: FriendsPage,
      meta: {
        title: "friends",
      },
    },

    {
      path: "/about",
      name: "aboutUs",
      component: About,
      meta: {
        title: "aboutUs",
      },
    },

    {
      path: "/chatrooms",
      name: "chat with your friends",
      component: ChatRoom,
      meta: {
        title: "chat with your friends",
      },
    },

    {
      path: "/profile",
      name: "profile page",
      component: Profile,
      meta: {
        title: "profile page",
      },
    },

    {
      path: "/workspaces/:workspaceId?/:tab?/:itemId?",
      name: "workspaces",
      component: Workspaces,
      meta: {
        title: "Workspaces",
        // App-style page: fills the viewport under the header, no footer,
        // panes scroll on their own (see App.vue).
        fullHeight: true,
      },
    },
  ],
});

// Pages a logged-out visitor may open; every other page needs a user.
const PUBLIC_PATHS = ["/login", "/register", "/about"];

router.beforeEach((to, from, next) => {
  document.title = pageTitle(to.meta);
  if (!store.state.connectedUser && !PUBLIC_PATHS.includes(to.path)) {
    next("/login");
    return;
  }
  next();
});

export default router;
