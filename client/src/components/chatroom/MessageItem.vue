<template>
  <div class="message-row" :class="isOwnMessage ? 'own' : 'other'">
    <img
      v-if="isGroupChat && !isOwnMessage"
      v-avatar
      :src="sender.profilePictureUrl"
      :alt="sender.username"
      :title="sender.username"
      class="sender-picture"
    />

    <div class="bubble" :class="{ deleted: message.deleted, wide: isWide }">
      <span v-if="isGroupChat && !isOwnMessage" class="sender-name">{{ sender.username }}</span>

      <!-- Editing a text message in place -->
      <div v-if="editing" class="edit">
        <textarea
          ref="editor"
          v-model="draft"
          rows="2"
          maxlength="5000"
          @keydown.enter.exact.prevent="saveEdit"
          @keydown.esc.prevent="editing = false"
        ></textarea>
        <div class="edit-actions">
          <button class="link" @click="editing = false">Cancel</button>
          <button class="save" :disabled="!draft.trim() || saving" @click="saveEdit">Save</button>
        </div>
      </div>
      <MessageContent v-else :message="message" @open-image="(url) => (lightboxUrl = url)" />

      <div class="meta">
        <span v-if="message.editedAt && !message.deleted" class="edited">edited</span>
        <span class="time">{{ time }}</span>
        <span v-if="isOwnMessage && !message.deleted" class="ticks" :class="{ seen: isSeenByEveryone }">
          <i class="fa-solid fa-check-double"></i>
        </span>
      </div>
    </div>

    <!-- Options sit beside the bubble (towards the middle), never on top of the text. -->
    <div v-if="hasActions && !editing" class="menu">
      <button class="menu-button" title="Message options" aria-label="Message options" aria-haspopup="true">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>
      <div class="menu-items">
        <button v-if="canCopy" @click="copyText"><i class="fa-regular fa-copy"></i> Copy</button>
        <button v-if="canEdit" @click="startEdit"><i class="fa-solid fa-pen"></i> Edit</button>
        <button v-if="isOwnMessage" @click="showDetails = true"><i class="fa-solid fa-circle-info"></i> Message details</button>
        <button v-if="canDelete" class="danger" @click="confirmDelete"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>

    <MessageDetailsModal :message="message" :is-open="showDetails" @close="showDetails = false" />
    <ImageLightbox :src="lightboxUrl" :alt="message.fileName || 'Picture'" @close="lightboxUrl = ''" />
  </div>
</template>

<script>
import { format } from "date-fns";
import Swal from "sweetalert2";
import MessageContent from "./MessageContent.vue";
import MessageDetailsModal from "./MessageDetailsModal.vue";
import ImageLightbox from "@/components/common/ImageLightbox.vue";
import { emitWithAck, errorMessage } from "@/socket/socketCall";
import { hasCodeBlock } from "@/chat/messageFormatter";

export default {
  name: "MessageItem",
  components: { MessageContent, MessageDetailsModal, ImageLightbox },
  props: {
    message: { type: Object, required: true },
    participantsAmount: { type: Number, default: 0 },
    isGroupChat: { type: Boolean, default: false },
    isOwnMessage: { type: Boolean, required: true },
    /** Group admins may delete anyone's message. */
    canModerate: { type: Boolean, default: false },
  },
  data() {
    return { showDetails: false, lightboxUrl: "", editing: false, draft: "", saving: false };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    sender() {
      return this.message.senderId || { username: "Unknown", profilePictureUrl: "" };
    },
    time() {
      return format(new Date(this.message.createdAt || this.message.timestamp), "HH:mm");
    },
    isSeenByEveryone() {
      return this.participantsAmount > 0 && (this.message.seenBy || []).length >= this.participantsAmount;
    },
    canCopy() {
      return !this.message.deleted && !!this.message.content;
    },
    canEdit() {
      return this.isOwnMessage && !this.message.deleted && this.message.type === "text";
    },
    canDelete() {
      return !this.message.deleted && (this.isOwnMessage || this.canModerate);
    },
    hasActions() {
      return this.canCopy || this.canEdit || this.canDelete || this.isOwnMessage;
    },
    /** Code needs room: let those bubbles grow wider. */
    isWide() {
      return !this.message.deleted && this.message.type === "text" && hasCodeBlock(this.message.content);
    },
  },
  methods: {
    startEdit() {
      this.draft = this.message.content;
      this.editing = true;
      this.$nextTick(() => this.$refs.editor && this.$refs.editor.focus());
    },
    async saveEdit() {
      const text = this.draft.trim();
      if (!text || this.saving) return;
      if (text === this.message.content) {
        this.editing = false;
        return;
      }
      this.saving = true;
      try {
        await emitWithAck(this.socket, "editMessage", this.message._id, text);
        this.editing = false;
      } catch (err) {
        this.$toast.error(errorMessage(err));
      } finally {
        this.saving = false;
      }
    },
    async confirmDelete() {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "Delete this message?",
        text: "It will be removed for everyone in the chat.",
        showCancelButton: true,
        confirmButtonText: "Delete",
        confirmButtonColor: "#d33",
      });
      if (!isConfirmed) return;
      try {
        await emitWithAck(this.socket, "deleteMessage", this.message._id);
      } catch (err) {
        this.$toast.error(errorMessage(err));
      }
    },
    async copyText() {
      try {
        await navigator.clipboard.writeText(this.message.content);
        this.$toast.success("Copied");
      } catch {
        this.$toast.error("Couldn't copy the message.");
      }
    },
  },
};
</script>

<style scoped>
.message-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  margin: 3px 0;
}
/* Own messages on the right; the options button then sits to the left of the bubble. */
.message-row.own {
  flex-direction: row-reverse;
}
.sender-picture {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
  flex-shrink: 0;
  margin-bottom: 2px;
}
.bubble {
  position: relative;
  max-width: min(68%, 560px);
  padding: 6px 10px 4px;
  border-radius: 14px;
  font-size: 0.95em;
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
}
.bubble.wide {
  max-width: min(85%, 820px);
}
.own .bubble {
  background-color: var(--bubble-own);
  color: var(--bubble-own-text);
  border-bottom-right-radius: 4px;
}
.other .bubble {
  background-color: var(--bubble-other);
  color: var(--bubble-other-text);
  border-bottom-left-radius: 4px;
}
.bubble.deleted {
  opacity: 0.75;
}
.sender-name {
  display: block;
  font-size: 0.8em;
  font-weight: 600;
  color: #2f7fd1;
  margin-bottom: 1px;
}
.meta {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  font-size: 0.7em;
  opacity: 0.6;
  user-select: none;
}
.ticks.seen {
  color: #53bdeb;
  opacity: 1;
}

/* Options menu beside the bubble, visible while hovering the message. */
.menu {
  position: relative;
  align-self: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.message-row:hover .menu,
.menu:focus-within {
  opacity: 1;
}
.menu-button {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: var(--chip-bg);
  color: var(--chip-text);
  box-shadow: var(--shadow);
  cursor: pointer;
}
.menu-items {
  display: none;
  position: absolute;
  bottom: 30px;
  z-index: 20;
  min-width: 170px;
  padding: 4px 0;
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-strong);
}
.own .menu-items {
  right: 0;
}
.other .menu-items {
  left: 0;
}
.menu:hover .menu-items,
.menu:focus-within .menu-items {
  display: block;
}
.menu-items button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  color: inherit;
  font-size: 0.9em;
  text-align: left;
  cursor: pointer;
}
.menu-items button:hover {
  background: var(--hover);
}
.menu-items .danger {
  color: #dc3545;
}

.edit textarea {
  width: 100%;
  min-width: 260px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  resize: vertical;
}
.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.edit-actions .link {
  border: none;
  background: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}
.edit-actions .save {
  border: none;
  border-radius: 6px;
  padding: 3px 12px;
  background: #1aa721;
  color: #fff;
  cursor: pointer;
}
</style>
