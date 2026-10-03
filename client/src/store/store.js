import Vue from "vue";
import Vuex from "vuex";
import socket from "./models/socket";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    connectedUser: undefined,
  },
  modules: {
    socket
  },
  mutations: {
    setConnectedUser(state, connectedUser) {
      state.connectedUser = connectedUser;
    },
  },
  actions: {
    setConnectedUser({ commit }, connectedUser) {
      commit("setConnectedUser", connectedUser);
    },
  },
});
