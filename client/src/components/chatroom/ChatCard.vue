<template>
  <div class="friend-item" @click="selectChatroom">
    <div class="profile-picture-wrapper">
      <img
        :src="friend?.profilePictureUrl || chatroom?.imageUrl"
        alt="Profile picture"
        class="friend-avatar"
      />
    </div>
    <!-- Display info based on whether it's a group chat or private chat -->
    <div v-if="!chatroom.isGroupChat" class="friend-info">
      <p class="friend-name">{{ friend?.username || "Friend" }}</p>
      <p class="friend-message">
        Last connected: {{ friend && formatLastConnected(friend.lastConnected) }}
      </p>
    </div>
    <div v-else class="friend-info">
      <p class="friend-name">{{ chatroom?.name || "Group Chat" }}</p>
      <p v-if="chatroom?.lastMessage" class="friend-message">
        {{ chatroom.lastMessage.content }}
        {{ formatLastConnected(chatroom.lastMessage.timestamp) }}
      </p>
    </div>
    <div v-if="chatroom.unreadMessages !== 0" class="unread">{{ chatroom.unreadMessages }}</div>
  </div>
</template>

<script>
import { isToday, format } from "date-fns";
/* eslint-disable */
export default {
  props: {
    chatroom: {
      type: Object,
      required: true,
    },
    chatroomId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      friend: null,
    };
  },
  mounted() {
    this.handleFriendCreation();
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
  methods: {
    handleFriendCreation() {
      if (!this.chatroom.isGroupChat) {
        this.friend = this.extractFriendFromChatroom();
      }
    },
    extractFriendFromChatroom() {
      const chatParticipants = this.chatroom.participants || [];

      return chatParticipants.find(
        (participant) => participant._id !== this.$store.state.connectedUser._id
      );
    },
    formatLastConnected(date) {
      const lastConnectedDate = new Date(date);
      if (isToday(lastConnectedDate)) {
        return `${format(lastConnectedDate, "HH:mm")}`;
      }
      return `${format(lastConnectedDate, "dd MMM yyyy")} at ${format(
        lastConnectedDate,
        "HH:mm"
      )}`;
    },
    selectChatroom() {
      this.$emit("chatroom-selected", this.chatroomId);
      this.chatroom.unreadMessages = 0;
    },
  },
  watch: {
  chatroom: {
    handler() {
      this.handleFriendCreation();
    },
    deep: true,
  },
},
};
</script>

<style scoped>
.friend-item {
  display: flex;
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--line);
  border-spacing: 10px;
}

.friend-item:hover {
  background-color: var(--line);
}

.friend-item:focus {
  background-color: var(--line);
}

.profile-picture-wrapper {
  position: relative;
}

.friend-avatar {
  width: 55px;
  height: 55px;
  background-color: var(--line);
  border-radius: 50%;
  margin-right: 10px;
  object-fit: cover;
}

.status-dot {
  position: absolute;
  bottom: 33%;
  right: 15%;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid var(--surface);
}

.status-dot.online {
  background-color: var(--plum);
}

.status-dot.offline {
  background-color: var(--line-strong);
}

.friend-info {
  flex: 1;
}
.friend-name {
  font-size: larger;
  font-weight: bold;
}
.friend-message {
  color: var(--muted);
  font-size: 0.9em;
}

.unread {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 5%;
  width: 20px;
  height: 20px;
  background-color: var(--brand-strong);
  color: var(--on-brand);
  border-radius: 50%;
  font-size: 12px;
}
</style>
