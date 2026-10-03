import Home from "./views/Home.vue";
import Login from "./views/Login.vue";
import VueRouter from "vue-router";
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
      path: "/",
      name: "Home",
      component: Home,
      meta: {
        title: "Home Page", // Set the title for this route
      },
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
      path: "/workspaces",
      name: "workspaces",
      component: Workspaces,
      meta: {
        title: "chat with your friends",
      },
    },
  ],
});

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || "Letter for every soldier"; // Set the document title
  next();
});

export default router;
