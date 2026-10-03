<template>
  <div ref="messageContainer" class="message-list">
    <div v-for="message in messagesWithDates" :key="message.id">
      <div class="date-separator-wrapper">
        <div v-if="message.isDate" class="date-separator">
          {{ message.date }}
        </div>
        <div v-else-if="message.type === 'system' && message.chatRoomId === chatroomId" class="system-message">
          {{ message.content }}
        </div>
      </div>
      <MessageItem
        v-if="!message.isDate && message.type !== 'system'"
        :key="message.id"
        :message="message"
        :participantsAmount="participantsAmount"
        :isGroupChat="isGroupChat"
        :isOwnMessage="isOwnMessage(message)"
      />
    </div>
    <p v-if="!messages.length && chatroomId != null" class="quiet">
      Pretty quiet here.. Write a message to your friend to lighten up the
      conversation.
    </p>
    <div v-else-if="chatroomId == null" class="quiet">
      <div class="welcome">Welcome to the<br />Leider chats Chatrooms!</div>
      <br />
      <br />
      <p>Choose a friend to talk to from the list on your left :)</p>
    </div>
  </div>
</template>

<script>
import { fetchChatMessages } from "@/api/ChatRoomService";
import MessageItem from "./MessageItem.vue";
import store from "@/store/store";
import { format } from "date-fns";
// import TopChatCard from "./TopChatCard.vue";

export default {
  components: {
    MessageItem,
    // TopChatCard
  },
  props: {
    chatroomId: {
      type: String,
      required: true,
    },
    isGroupChat: {
      type: Boolean,
      required: false,
    },
    participantsAmount: {
      type: Number,
      required: false,
    },
  },
  data() {
    return {
      messages: [],
    };
  },
  computed: {
    messagesWithDates() {
      const groupedMessages = [];
      let lastDate = null;

      this.messages.forEach((message) => {
        const messageDate = format(new Date(message.createdAt), "dd MMM yyyy");

        if (messageDate !== lastDate) {
          groupedMessages.push({ isDate: true, date: messageDate });
          lastDate = messageDate;
        }

        groupedMessages.push(message);
      });

      return groupedMessages;
    },
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
  mounted() {
    if (this.socket) {
      this.socket.on("newMessage", (message) => {
        if (message.chatRoomId === this.chatroomId) {
          this.messages.push(message);
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        }
      });

      this.socket.on("messagesMarkedAsRead", ({ chatroomId, user }) => {
        if (this.chatroomId === chatroomId) {
          this.messages = this.messages.map((message) => {
            if (!message.seenBy.includes(user._id)) {
              message.seenBy.push({
                _id: user._id,
                username: user.username,
                profilePictureUrl: user.profilePictureUrl,
              });
            }
            return message;
          });
        }
      });
    }
  },
  watch: {
    chatroomId: {
      immediate: true,
      async handler(newChatroomId) {
        if (newChatroomId == null) {
          this.messages = [];
        }

        await this.loadMessages(newChatroomId);
      },
    },
    participantsAmount: {
      immediate: true,
    },
    isGroupChat: {
      immediate: true,
      async handler() {},
    },
  },
  methods: {
    async loadMessages(chatroomId) {
      try {
        if (chatroomId) {
          const response = await fetchChatMessages(chatroomId);
          this.messages = response.data;
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    },
    isOwnMessage(message) {
      return message.senderId._id === store.state.connectedUser._id;
    },
    scrollToBottom() {
      const container = this.$refs.messageContainer;
      container.scrollTop = container.scrollHeight;
    },
  },
};
</script>

<style scoped>
.message-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: url("../../../public/full-bloom.png");
}

.quiet {
  text-align: center;
  opacity: 0.7;
}

.date-separator-wrapper {
  text-align: center;
}

.date-separator {
  display: inline-block;
  margin: 10px auto;
  padding: 5px 10px;
  font-size: 0.9em;
  color: #3b3838;
  background-color: #dfcece;
  border-radius: 10px;
  text-align: center;
}

.welcome {
  text-align: center;
  opacity: 0.85;
  font-weight: bold;
  font-size: 300%;
}

.system-message {
  text-align: center; /* Center text horizontally */
  font-style: italic;
  color: rgb(34, 34, 34);
  background-color: gray;
  margin: 10px auto; /* Center the element itself horizontally */
  padding: 8px; /* Add padding to prevent text from touching edges */
  max-width: 300px;
  border-radius: 25px;
  opacity: 0.6;
  display: inline-block; /* Ensure element width wraps content */
}

</style>
