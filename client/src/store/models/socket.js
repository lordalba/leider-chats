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
    // A socket left over from a previous login carries the old user's token: replace it.
    if (state.socket) {
      state.socket.removeAllListeners();
      state.socket.disconnect();
    }

    // The token lets the server identify this socket for workspace events.
    const socket = io("http://localhost:3000", {
      auth: { token: localStorage.getItem("token") },
    });
    commit("SET_SOCKET", socket);

    // Announce ourselves on every (re)connect, since the server forgets sockets that drop.
    const userId = store.state.connectedUser._id;
    socket.on("connect", () => {
      socket.emit("userOnline", userId);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
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
