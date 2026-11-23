<template>
  <div class="chat-card" role="button" tabindex="0" @click="select" @keyup.enter="select">
    <img
      v-avatar="chatroom.isGroupChat ? 'group' : 'user'"
      :src="picture"
      :alt="name"
      class="chat-picture"
    />
    <div class="chat-info">
      <p class="chat-name">{{ name }}</p>
      <p class="chat-preview">{{ preview }}</p>
    </div>
    <span v-if="chatroom.unreadMessages > 0" class="unread">{{ chatroom.unreadMessages }}</span>
  </div>
</template>

<script>
import { format, isToday } from "date-fns";
import { chatDisplayName, chatPicture, otherParticipant } from "@/chat/chatNames";

const formatTime = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return isToday(value) ? format(value, "HH:mm") : format(value, "dd MMM yyyy, HH:mm");
};

export default {
  name: "ChatCard",
  props: {
    chatroom: { type: Object, required: true },
    chatroomId: { type: String, required: true },
  },
  computed: {
    myId() {
      return this.$store.state.connectedUser && this.$store.state.connectedUser._id;
    },
    name() {
      return chatDisplayName(this.chatroom, this.myId);
    },
    picture() {
      return chatPicture(this.chatroom, this.myId);
    },
    preview() {
      const last = this.chatroom.lastMessage;
      if (last && last.content) return `${last.content} · ${formatTime(last.timestamp)}`;
      if (this.chatroom.isGroupChat) return "No messages yet";
      const friend = otherParticipant(this.chatroom, this.myId);
      return friend && friend.lastConnected ? `Last seen ${formatTime(friend.lastConnected)}` : "";
    },
  },
  methods: {
    select() {
      this.$emit("chatroom-selected", this.chatroomId);
    },
  },
};
</script>

<style scoped>
.chat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.chat-card:hover,
.chat-card:focus,
.chat-card.selected {
  background-color: var(--hover);
  outline: none;
}
.chat-picture {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
  flex-shrink: 0;
}
.chat-info {
  flex: 1;
  min-width: 0;
}
.chat-name {
  margin: 0;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-preview {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.85em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.unread {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background-color: #1aa721;
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
