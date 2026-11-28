import Vue from 'vue'
import App from './App.vue';
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue';
import VueSweetalert2 from 'vue-sweetalert2';
import store from './store/store.js'
import router from './router.js';
import { restoreSession } from './auth/restoreSession';
import { clearSession } from './auth/session';
import { fetchUserData } from './api/PersonalService';
import VueRouter from 'vue-router';
import VueHead from 'vue-head'
import '@fortawesome/fontawesome-free/css/all.css';
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';
import "leaflet/dist/leaflet.css";

const notificationsConfig = {
  // Optional options for customization
  position: "bottom-left",
  timeout: 5000,
  closeOnClick: true,
  pauseOnHover: false,
};

Vue.use(Toast, notificationsConfig);
Vue.use(VueHead)
// Import Bootstrap and BootstrapVue CSS files (order is important)
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import 'sweetalert2/dist/sweetalert2.min.css';
// App color palette (Sunset Vinyl); after Bootstrap so its overrides win.
import './styles/theme.css';
// Workspace design tokens, mapped onto the palette.
import './styles/workspaces.css';

// Make BootstrapVue available throughout your project
Vue.use(BootstrapVue)
// Optionally install the BootstrapVue icon components plugin
Vue.use(IconsPlugin)
Vue.config.productionTip = false

Vue.use(VueRouter);

Vue.use(VueSweetalert2);

// Restore the logged-in user from the stored token before the first render,
// so a page refresh keeps the user logged in (views read connectedUser).
restoreSession({
  token: localStorage.getItem("token"),
  fetchUser: fetchUserData,
  setUser: (user) => store.dispatch("setConnectedUser", user),
  connect: () => store.dispatch("socket/initializeSocket"),
  clear: clearSession,
})
  .catch((error) => console.error("Session restore failed:", error))
  .finally(() => {
    new Vue({
      render: h => h(App),
      router,
      store
    }).$mount('#app')
  });
