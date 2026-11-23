import Vue from "vue";
import VueRouter from "vue-router";
import { BootstrapVue } from "bootstrap-vue";
import Toast from "vue-toastification";

import App from "./App.vue";
import store from "./store/store.js";
import router from "./router.js";
import { installAuthInterceptor, restoreSession } from "./auth/session";
import { avatarDirective } from "./utils/avatar";
import themeManager from "./theme/ThemeManager";

// Library styles first, so our theme can override them.
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import "@fortawesome/fontawesome-free/css/all.css";
import "vue-toastification/dist/index.css";
import "sweetalert2/dist/sweetalert2.min.css";
import "./styles/theme.css";

Vue.config.productionTip = false;

Vue.use(VueRouter);
Vue.use(BootstrapVue);
Vue.use(Toast, { position: "bottom-left", timeout: 5000, closeOnClick: true, pauseOnHover: false });
Vue.directive("avatar", avatarDirective);

themeManager.apply();
installAuthInterceptor(router);

// Restore the login (if any) before the router picks the first page.
restoreSession().finally(() => {
  new Vue({
    render: (h) => h(App),
    router,
    store,
  }).$mount("#app");
});
