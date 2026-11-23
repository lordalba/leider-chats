<template>
  <div v-if="isOpen" class="overlay" @click="$emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="message-details-title" @click.stop>
      <header>
        <h3 id="message-details-title">Message details</h3>
        <button class="close" aria-label="Close" @click="$emit('close')"><i class="fa-solid fa-xmark"></i></button>
      </header>

      <div class="preview">
        <MessageContent :message="message" />
        <p class="sent">Sent {{ sentAt }}<span v-if="message.editedAt"> · edited {{ editedAt }}</span></p>
      </div>

      <h4>Seen by</h4>
      <ul v-if="readers.length" class="readers">
        <li v-for="user in readers" :key="user._id">
          <img v-avatar :src="user.profilePictureUrl" :alt="user.username" class="picture" />
          {{ user.username }}
        </li>
      </ul>
      <p v-else class="empty">Nobody has seen it yet.</p>
    </div>
  </div>
</template>

<script>
import { format } from "date-fns";
import MessageContent from "./MessageContent.vue";

const formatDate = (value) => (value ? format(new Date(value), "dd MMM yyyy, HH:mm") : "");

export default {
  name: "MessageDetailsModal",
  components: { MessageContent },
  props: {
    isOpen: { type: Boolean, default: false },
    message: { type: Object, required: true },
  },
  computed: {
    readers() {
      const me = this.$store.state.connectedUser._id;
      // seenBy may contain plain ids for messages that arrived live; only show populated users.
      return (this.message.seenBy || []).filter((user) => user && user._id && user._id !== me);
    },
    sentAt() {
      return formatDate(this.message.createdAt || this.message.timestamp);
    },
    editedAt() {
      return formatDate(this.message.editedAt);
    },
  },
};
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dialog {
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 18px 22px;
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
h3 {
  margin: 0;
  font-size: 1.2em;
}
h4 {
  font-size: 1em;
  margin: 14px 0 8px;
}
.close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
}
.preview {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bubble-own);
  color: var(--bubble-own-text);
}
.sent {
  margin: 6px 0 0;
  font-size: 0.75em;
  opacity: 0.7;
}
.readers {
  list-style: none;
  padding: 0;
  margin: 0;
}
.readers li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
}
.picture {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.empty {
  color: var(--text-muted);
}
</style>
