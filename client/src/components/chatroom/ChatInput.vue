<template>
  <div
    v-if="chatroomId"
    class="chat-input"
    :class="{ dragging }"
    @dragenter.prevent="dragging = canUserSendMessage"
    @dragover.prevent
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <div v-if="typingUserName" class="typing-indicator">
      {{ typingUserName }} is typing<span class="dots"><span>.</span><span>.</span><span>.</span></span>
    </div>

    <p v-if="!canUserSendMessage" class="only-admins">
      <i class="fa-solid fa-shield-halved"></i> Only <strong>admins</strong> can send messages in this group.
    </p>

    <template v-else>
      <!-- Attachment waiting to be sent -->
      <div v-if="pendingFile" class="attachment">
        <img v-if="pendingPreviewUrl" :src="pendingPreviewUrl" alt="Preview" class="attachment-thumb" />
        <span v-else class="attachment-icon"><i class="fa-solid fa-file"></i></span>
        <span class="attachment-info">
          <span class="attachment-name">{{ pendingFile.name }}</span>
          <span class="attachment-size">{{ pendingSize }} · type a caption below (optional)</span>
        </span>
        <button class="icon" title="Remove attachment" :disabled="uploading" @click="clearAttachment">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div ref="composer" class="composer">
        <div class="tools">
          <button class="icon" :class="{ active: openPicker === 'emoji' }" title="Emoji" @click="togglePicker('emoji')">
            <i class="fa-regular fa-face-smile"></i>
          </button>
          <button class="icon gif" :class="{ active: openPicker === 'gif' }" title="Your GIFs" @click="togglePicker('gif')">
            GIF
          </button>
          <button class="icon" title="Attach a file" @click="$refs.fileInput.click()">
            <i class="fa-solid fa-paperclip"></i>
          </button>
          <button class="icon" title="Insert a code block" @click="insertCodeBlock">
            <i class="fa-solid fa-code"></i>
          </button>
          <input ref="fileInput" type="file" class="hidden" :accept="acceptedTypes" @change="onFilePicked" />
        </div>

        <textarea
          ref="textInput"
          v-model="messageText"
          rows="1"
          :placeholder="pendingFile ? 'Add a caption…' : 'Type a message…  (Shift+Enter for a new line)'"
          maxlength="5000"
          @keydown.enter="onEnter"
          @input="onTyping"
          @paste="onPaste"
        ></textarea>

        <button class="send" title="Send" :disabled="!canSend" @click="send">
          <i :class="uploading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-paper-plane'"></i>
        </button>

        <EmojiPicker v-if="openPicker === 'emoji'" class="popover" @pick="insertText" />
        <GifPicker v-if="openPicker === 'gif'" class="popover" @pick="sendGif" />
      </div>
    </template>

    <div v-if="dragging" class="drop-hint"><i class="fa-solid fa-file-arrow-up"></i> Drop to attach</div>
  </div>
</template>

<script>
import { uploadMessageMedia } from "@/api/MediaService";
import { serverMessage } from "@/api/httpClient";
import { ALLOWED_EXTENSIONS, attachmentProblem, formatFileSize, messageTypeFor } from "@/chat/attachments";
import { hasUnclosedFence } from "@/chat/messageFormatter";
import EmojiPicker from "./input/EmojiPicker.vue";
import GifPicker from "./input/GifPicker.vue";

const TYPING_EMIT_INTERVAL_MS = 1500;
const TYPING_HIDE_AFTER_MS = 2500;
const MAX_TEXTAREA_HEIGHT = 180;

export default {
  name: "ChatInput",
  components: { EmojiPicker, GifPicker },
  props: {
    chatroomId: { type: String, default: null },
    adminPermissionState: { type: Boolean, default: false },
    isConnectedUserAdmin: { type: Boolean, default: false },
  },
  data() {
    return {
      messageText: "",
      pendingFile: null,
      pendingPreviewUrl: "",
      uploading: false,
      openPicker: null,
      dragging: false,
      typingUserName: "",
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    connectedUser() {
      return this.$store.state.connectedUser;
    },
    canUserSendMessage() {
      return !this.adminPermissionState || this.isConnectedUserAdmin;
    },
    canSend() {
      return !this.uploading && (!!this.messageText.trim() || !!this.pendingFile);
    },
    /** Limits the file dialog to the types we can send. */
    acceptedTypes() {
      return Array.from(ALLOWED_EXTENSIONS, (extension) => `.${extension}`).join(",");
    },
    pendingSize() {
      return this.pendingFile ? formatFileSize(this.pendingFile.size) : "";
    },
  },
  watch: {
    chatroomId() {
      // New chat: start fresh.
      this.typingUserName = "";
      this.messageText = "";
      this.openPicker = null;
      this.clearAttachment();
    },
    messageText() {
      this.$nextTick(this.resizeTextarea);
    },
  },
  mounted() {
    if (this.socket) this.socket.on("friendTyping", this.onFriendTyping);
    this.onDocumentClick = (event) => {
      if (this.openPicker && this.$refs.composer && !this.$refs.composer.contains(event.target)) {
        this.openPicker = null;
      }
    };
    document.addEventListener("click", this.onDocumentClick);
  },
  beforeDestroy() {
    if (this.socket) this.socket.off("friendTyping", this.onFriendTyping);
    document.removeEventListener("click", this.onDocumentClick);
    clearTimeout(this.typingTimer);
    this.clearAttachment();
  },
  methods: {
    // ---- sending -------------------------------------------------------
    onEnter(event) {
      // Shift+Enter, or Enter inside an open ``` block, adds a line instead of sending.
      if (event.shiftKey || hasUnclosedFence(this.messageText)) return;
      event.preventDefault();
      this.send();
    },
    async send() {
      if (!this.canSend) return;
      const text = this.messageText.trim();
      if (this.pendingFile) {
        await this.sendAttachment(text);
      } else {
        this.emitMessage({ type: "text", content: text });
        this.messageText = "";
      }
      this.openPicker = null;
    },
    async sendAttachment(caption) {
      this.uploading = true;
      try {
        const file = this.pendingFile;
        const { fileUrl } = await uploadMessageMedia(file);
        this.emitMessage({
          type: messageTypeFor(file),
          content: caption || null,
          fileName: file.name,
          mediaUrl: fileUrl,
        });
        this.messageText = "";
        this.clearAttachment();
      } catch (error) {
        this.$toast.error(serverMessage(error, "Couldn't upload the file."));
      } finally {
        this.uploading = false;
      }
    },
    sendGif(url) {
      this.emitMessage({ type: "image", content: null, fileName: "GIF", mediaUrl: url });
      this.openPicker = null;
    },
    emitMessage(message) {
      this.socket.emit("sendMessage", {
        chatRoomId: this.chatroomId,
        senderId: this.connectedUser._id,
        fileName: null,
        mediaUrl: null,
        ...message,
      });
    },

    // ---- attachments ---------------------------------------------------
    onFilePicked(event) {
      const file = event.target.files[0];
      // Reset so picking the same file again still triggers a change.
      event.target.value = "";
      if (file) this.attach(file);
    },
    onDrop(event) {
      this.dragging = false;
      if (!this.canUserSendMessage) return;
      const file = event.dataTransfer && event.dataTransfer.files[0];
      if (file) this.attach(file);
    },
    onPaste(event) {
      const file = event.clipboardData && event.clipboardData.files[0];
      if (!file) return;
      event.preventDefault();
      this.attach(file);
    },
    attach(file) {
      const problem = attachmentProblem(file);
      if (problem) {
        this.$toast.error(problem);
        return;
      }
      this.clearAttachment();
      this.pendingFile = file;
      if (messageTypeFor(file) === "image") this.pendingPreviewUrl = URL.createObjectURL(file);
      this.$nextTick(() => this.$refs.textInput && this.$refs.textInput.focus());
    },
    clearAttachment() {
      if (this.pendingPreviewUrl) URL.revokeObjectURL(this.pendingPreviewUrl);
      this.pendingPreviewUrl = "";
      this.pendingFile = null;
    },

    // ---- composing -----------------------------------------------------
    togglePicker(name) {
      this.openPicker = this.openPicker === name ? null : name;
    },
    insertText(text) {
      const input = this.$refs.textInput;
      const start = input ? input.selectionStart : this.messageText.length;
      const end = input ? input.selectionEnd : this.messageText.length;
      this.messageText = this.messageText.slice(0, start) + text + this.messageText.slice(end);
      this.$nextTick(() => {
        if (!input) return;
        input.focus();
        input.selectionStart = input.selectionEnd = start + text.length;
      });
    },
    insertCodeBlock() {
      const input = this.$refs.textInput;
      const start = input ? input.selectionStart : this.messageText.length;
      const end = input ? input.selectionEnd : this.messageText.length;
      const selected = this.messageText.slice(start, end);
      const before = start > 0 && !this.messageText.slice(0, start).endsWith("\n") ? "\n" : "";
      const block = `${before}\`\`\`\n${selected}\n\`\`\``;
      this.messageText = this.messageText.slice(0, start) + block + this.messageText.slice(end);
      // Put the cursor inside the block.
      const cursor = start + before.length + 4 + selected.length;
      this.$nextTick(() => {
        if (!input) return;
        input.focus();
        input.selectionStart = input.selectionEnd = cursor;
      });
    },
    resizeTextarea() {
      const input = this.$refs.textInput;
      if (!input) return;
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    },

    // ---- typing indicator ---------------------------------------------
    onTyping() {
      const now = Date.now();
      if (now - (this.lastTypingEmit || 0) < TYPING_EMIT_INTERVAL_MS) return;
      this.lastTypingEmit = now;
      this.socket.emit("typing", {
        chatroomId: this.chatroomId,
        userId: this.connectedUser._id,
        username: this.connectedUser.username,
      });
    },
    onFriendTyping(message) {
      if (message.chatroomId !== this.chatroomId || message.userId === this.connectedUser._id) return;
      this.typingUserName = message.username;
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => (this.typingUserName = ""), TYPING_HIDE_AFTER_MS);
    },
  },
};
</script>

<style scoped>
.chat-input {
  position: relative;
  padding: 8px 12px 10px;
  background: var(--surface-2);
  border-top: 1px solid var(--border);
}
.chat-input.dragging {
  outline: 2px dashed var(--accent);
  outline-offset: -4px;
}
.hidden {
  display: none;
}
.typing-indicator {
  font-size: 0.8em;
  color: var(--text-muted);
  font-style: italic;
  margin: 0 0 4px 6px;
}
.dots span {
  animation: blink 1.4s infinite both;
}
.dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
}
.only-admins {
  margin: 6px 0;
  text-align: center;
  color: var(--text-muted);
}
.attachment {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.attachment-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
}
.attachment-icon {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: rgba(0, 123, 255, 0.15);
  color: #007bff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.attachment-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.attachment-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachment-size {
  font-size: 0.8em;
  color: var(--text-muted);
}
.composer {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.tools {
  display: flex;
  gap: 2px;
}
.icon {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
}
.icon:hover,
.icon.active {
  background: var(--hover);
  color: var(--text);
}
.icon.gif {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
textarea {
  flex: 1;
  min-width: 0;
  min-height: 40px;
  max-height: 180px;
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  color: var(--text);
  line-height: 1.35;
  resize: none;
  outline: none;
}
textarea:focus {
  border-color: var(--accent);
}
.send {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
}
.send:disabled {
  opacity: 0.45;
  cursor: default;
}
.popover {
  position: absolute;
  bottom: 48px;
  left: 0;
  z-index: 50;
}
.drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(69, 129, 92, 0.12);
  color: var(--accent);
  font-weight: 600;
  pointer-events: none;
}
</style>
