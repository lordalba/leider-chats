import io from "socket.io-client";
import store from "@/store/store";
import { handleSessionExpired } from "@/auth/session";

const state = {
  socket: null,
};

const mutations = {
  SET_SOCKET(state, socket) {
    state.socket = socket;
  },
};

const actions = {
  initializeSocket({ commit }) {
    if (!state.socket) {
      const socket = io("http://localhost:3000", {
        // Function form: every (re)connect sends the current token.
        auth: (cb) => cb({ token: localStorage.getItem("token") }),
      });
      commit("SET_SOCKET", socket);

      // Single global listener: the server refused an event because this
      // socket has no valid token (e.g. it reconnected after the JWT expired).
      socket.on("auth:expired", handleSessionExpired);

      socket.emit("userOnline", store.state.connectedUser._id);

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });
    }
  },
};

const getters = {
  socket: (state) => state.socket,
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};
