<template>
  <div ref="messageContainer" class="message-list">
    <div v-if="!chatroomId" class="welcome">
      <h2>Welcome to the<br />Leider chats Chatrooms!</h2>
      <p>Choose a chat from the list on your left :)</p>
    </div>

    <template v-else>
      <p v-if="loading" class="quiet">Loading messages…</p>
      <p v-else-if="!messages.length" class="quiet">
        Pretty quiet here.. Write a message to lighten up the conversation.
      </p>

      <template v-for="entry in entries">
        <div v-if="entry.isDate" :key="entry.key" class="date-separator"><span>{{ entry.label }}</span></div>
        <div v-else-if="entry.message.type === 'system'" :key="entry.key" class="system-message">
          <span>{{ entry.message.content }}</span>
        </div>
        <MessageItem
          v-else
          :key="entry.key"
          :message="entry.message"
          :participants-amount="participantsAmount"
          :is-group-chat="isGroupChat"
          :is-own-message="isOwnMessage(entry.message)"
          :can-moderate="isGroupChat && isConnectedUserAdmin"
        />
      </template>
    </template>
  </div>
</template>

<script>
import { format, isToday, isYesterday } from "date-fns";
import { fetchChatMessages } from "@/api/ChatRoomService";
import MessageItem from "./MessageItem.vue";

const dayLabel = (date) => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd MMM yyyy");
};

export default {
  name: "MessageList",
  components: { MessageItem },
  props: {
    /** null until a chat is picked. */
    chatroomId: { type: String, default: null },
    isGroupChat: { type: Boolean, default: false },
    participantsAmount: { type: Number, default: 0 },
    isConnectedUserAdmin: { type: Boolean, default: false },
  },
  data() {
    return { messages: [], loading: false };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    myId() {
      return this.$store.state.connectedUser._id;
    },
    /** Messages with a date separator before each new day. */
    entries() {
      const entries = [];
      let lastDay = null;
      this.messages.forEach((message) => {
        const date = new Date(message.createdAt || message.timestamp);
        const day = format(date, "yyyy-MM-dd");
        if (day !== lastDay) {
          entries.push({ isDate: true, key: `date-${day}`, label: dayLabel(date) });
          lastDay = day;
        }
        entries.push({ isDate: false, key: message._id, message });
      });
      return entries;
    },
  },
  watch: {
    chatroomId: {
      immediate: true,
      handler(chatroomId) {
        this.messages = [];
        if (chatroomId) this.loadMessages(chatroomId);
      },
    },
  },
  mounted() {
    if (this.socket) {
      this.socket.on("newMessage", this.onNewMessage);
      this.socket.on("messageUpdated", this.onMessageUpdated);
      this.socket.on("messagesMarkedAsRead", this.onMessagesMarkedAsRead);
    }
  },
  beforeDestroy() {
    // Without this, every visit adds another listener and messages appear twice.
    if (this.socket) {
      this.socket.off("newMessage", this.onNewMessage);
      this.socket.off("messageUpdated", this.onMessageUpdated);
      this.socket.off("messagesMarkedAsRead", this.onMessagesMarkedAsRead);
    }
  },
  methods: {
    async loadMessages(chatroomId) {
      this.loading = true;
      try {
        const { data } = await fetchChatMessages(chatroomId);
        if (chatroomId !== this.chatroomId) return; // switched chats meanwhile
        this.messages = data;
        this.scrollToBottom();
      } catch (error) {
        this.$toast.error("Couldn't load the messages.");
      } finally {
        this.loading = false;
      }
    },
    onNewMessage(message) {
      if (message.chatRoomId !== this.chatroomId) return;
      if (this.messages.some((m) => m._id === message._id)) return;
      this.messages.push(message);
      this.scrollToBottom();
    },
    /** An edit or delete: replace the message in place. */
    onMessageUpdated(updated) {
      if (updated.chatRoomId !== this.chatroomId) return;
      const index = this.messages.findIndex((m) => m._id === updated._id);
      if (index !== -1) this.messages.splice(index, 1, updated);
    },
    onMessagesMarkedAsRead({ chatroomId, user }) {
      if (this.chatroomId !== chatroomId || !user) return;
      const userId = String(user._id);
      this.messages = this.messages.map((message) => {
        const seenBy = message.seenBy || [];
        // seenBy holds user objects (or plain ids), so compare by id.
        if (seenBy.some((s) => String(s && s._id ? s._id : s) === userId)) return message;
        const reader = { _id: user._id, username: user.username, profilePictureUrl: user.profilePictureUrl };
        return { ...message, seenBy: [...seenBy, reader] };
      });
    },
    isOwnMessage(message) {
      return !!message.senderId && message.senderId._id === this.myId;
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messageContainer;
        if (container) container.scrollTop = container.scrollHeight;
      });
    },
  },
};
</script>

<style scoped>
.message-list {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  overflow-y: auto;
  background: var(--chat-bg) url("~@/assets/chat-background.png");
  background-blend-mode: var(--chat-bg-blend);
}
.quiet {
  text-align: center;
  opacity: 0.7;
}
.welcome {
  text-align: center;
  margin-top: 10vh;
}
.welcome h2 {
  font-weight: bold;
  font-size: 2.6em;
  opacity: 0.85;
}
.welcome p {
  margin-top: 30px;
  opacity: 0.8;
}
.date-separator,
.system-message {
  text-align: center;
  margin: 10px 0;
}
.date-separator span {
  display: inline-block;
  padding: 4px 12px;
  font-size: 0.8em;
  border-radius: 10px;
  background-color: var(--chip-bg);
  color: var(--chip-text);
}
.system-message span {
  display: inline-block;
  max-width: 420px;
  padding: 6px 14px;
  font-size: 0.85em;
  font-style: italic;
  border-radius: 14px;
  background-color: var(--chip-bg);
  color: var(--chip-text);
}
</style>
