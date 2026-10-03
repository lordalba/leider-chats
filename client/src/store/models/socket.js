import io from "socket.io-client";
import store from "@/store/store";

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
      const socket = io("http://localhost:3000");
      commit("SET_SOCKET", socket);

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
