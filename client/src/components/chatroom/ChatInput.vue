<template>
  <div v-if="chatroomId" class="chat-input">
    <div class="input-wrapper">
      <!-- Hidden File Input -->
      <input
        type="file"
        ref="fileInput"
        class="hidden-file-input"
        accept="*/*"
        @change="handleFileSelection"
      />
      <!-- Custom Upload Trigger -->
      <button v-if="canUserSendMessage" class="upload-trigger" @click="triggerFileInput">
        <i class="fa-solid fa-paperclip"></i>
      </button>
      <button v-if="canUserSendMessage" class="send-location-button" @click="sendLocation">
        <i class="fa-solid fa-location-dot"></i> Send Location
      </button>
      <!-- Message Input -->
      <input
        v-if="canUserSendMessage"
        type="text"
        placeholder="Type your message..."
        v-model="messageText"
        @keyup.enter="sendMessage"
        v-on:input="startTyping()"
      />
      <div
        v-if="adminPermissionState && !isConnectedUserAdmin"
        class="only-admins"
      >
        Only
        <notin
          style="color: chartreuse; font-weight: bolder; font-size: larger"
        >
          Admins
        </notin>
        can send Messages in this GroupChat
      </div>
    </div>

    <!-- Typing Indicator -->
    <div v-if="isFriendTyping" class="typing-indicator">
      {{ typingUserName }} is typing <span class="dot">.</span
      ><span class="dot">.</span><span class="dot">.</span>
    </div>

    <!-- File Preview Modal -->
    <div v-if="showFilePreview" class="modal-overlay">
      <div class="modal-content">
        <h3>Preview File</h3>

        <!-- Image Preview -->
        <div v-if="isImage(mediaFile)" class="file-preview">
          <img :src="mediaPreviewUrl" alt="Image Preview" />
        </div>

        <!-- Audio Preview -->
        <div v-else-if="isAudio(mediaFile)" class="file-preview">
          <audio controls>
            <source :src="mediaPreviewUrl" type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>

        <!-- File Type Preview -->
        <div v-else-if="isFile(mediaFile)" class="file-preview">
          <p><strong>File:</strong> {{ mediaFile.name }}</p>
          <p><strong>Type:</strong> {{ getFileExtension(mediaFile.name) }}</p>
          <a :href="mediaPreviewUrl" target="_blank">Open File</a>
        </div>

        <!-- Modal Actions -->
        <div class="modal-actions">
          <button @click="cancelFile">Cancel</button>
          <button @click="confirmFile">Send</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { uploadMessageMedia } from "@/api/MediaService";
import store from "@/store/store";
import { debounce } from "lodash";

export default {
  props: {
    chatroomId: {
      type: String,
      required: false,
    },
    adminPermissionState: {
      type: Boolean,
      required: false,
    },
    isConnectedUserAdmin: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      messageText: "",
      mediaFile: null,
      mediaUrl: null,
      mediaPreviewUrl: null,
      showFilePreview: false,
      isFriendTyping: false,
      typingUserName: "",
    };
  },
  mounted() {
    if (this.socket) {
      this.socket.on("friendTyping", (message) => {
        if (
          message.chatroomId == this.chatroomId &&
          message.userId !== store.state.connectedUser._id
        ) {
          this.isFriendTyping = true;
          this.typingUserName = message.username;
          this.debounceStopTyping();
        }
      });
    }
  },
  methods: {
    async sendLocation() {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          const message = {
            chatRoomId: this.chatroomId,
            senderId: store.state.connectedUser._id,
            type: "location",
            content: String(latitude) + "," + String(longitude),
            mediaUrl: null,
          };

          this.socket.emit("sendMessage", message);
        },
        (error) => {
          console.error("Error retrieving location:", error);
          alert("Unable to retrieve location.");
        }
      );
    },
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    handleFileSelection(event) {
      this.mediaFile = event.target.files[0];
      if (!this.mediaFile) return;

      // Generate a preview URL for the selected file
      this.mediaPreviewUrl = URL.createObjectURL(this.mediaFile);
      this.showFilePreview = true;
    },
    cancelFile() {
      // Clear the file and hide the modal
      this.mediaFile = null;
      this.mediaPreviewUrl = null;
      this.showFilePreview = false;
    },
    async confirmFile() {
      if (!this.mediaFile) return;

      const formData = new FormData();
      formData.append("media", this.mediaFile);

      try {
        const response = await uploadMessageMedia(formData);
        const data = await response.json();
        this.mediaUrl = data.fileUrl;

        // Automatically send the message with the file
        this.sendMessage();
      } catch (error) {
        console.error("File upload failed:", error);
      } finally {
        // Clean up
        this.cancelFile();
      }
    },
    sendMessage() {
      if (!this.messageText.trim() && !this.mediaFile) return;

      const message = {
        chatRoomId: this.chatroomId,
        senderId: store.state.connectedUser._id,
        content: this.messageText || null,
        type: this.mediaFile ? this.getFileType() : "text",
        fileName: this.mediaFile ? this.mediaFile.name : null,
        mediaUrl: this.mediaUrl || null,
      };

      this.socket.emit("sendMessage", message);

      this.messageText = "";
      this.mediaFile = null;
      this.mediaUrl = null;
    },
    getFileType() {
      if (this.isAudio(this.mediaFile)) return "voice";
      if (this.isImage(this.mediaFile)) return "image";
      if (this.isFile(this.mediaFile)) return "file";
      return "text";
    },
    isImage(file) {
      return file && file.type.startsWith("image");
    },
    isAudio(file) {
      return file && file.type.startsWith("audio");
    },
    isFile(file) {
      // Check for common document MIME types
      const fileMimeTypes = [
        "application/pdf", // PDF files
        "application/msword", // Word .doc files
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word .docx files
        "application/vnd.ms-excel", // Excel .xls files
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // Excel .xlsx files
      ];
      return file && fileMimeTypes.includes(file.type);
    },
    getFileExtension(fileName) {
      const parts = fileName.split(".");
      return parts.length > 1
        ? parts[parts.length - 1].toUpperCase()
        : "Unknown";
    },
    startTyping() {
      this.socket.emit("typing", {
        chatroomId: this.chatroomId,
        userId: store.state.connectedUser._id,
        username: store.state.connectedUser.username,
      });
    },
    debounceStopTyping: debounce(function () {
      this.isFriendTyping = false;
    }, 500),
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    canUserSendMessage() {
      return (
        !this.adminPermissionState ||
        (this.adminPermissionState && this.isConnectedUserAdmin)
      );
    },
  },
  watch: {
    chatroomId: {
      immediate: true,
      handler(newVal) {
        console.log("new val for chatroomId: " + newVal);
      },
      deep: true,
    },
    adminPermissionState: {
      immediate: true,
      handler(newVal) {
        console.log("new val for isConnectedUserAdmin: " + newVal);
      },
      deep: true,
    },
    isConnectedUserAdmin: {
      immediate: true,
      handler(newVal) {
        console.log("new val for isConnectedUserAdmin: " + newVal);
      },
      deep: true,
    },
  },
};
</script>

<style scoped>
.chat-input {
  padding: 10px;
  border-top: 1px solid #ddd;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

input[type="text"] {
  flex: 1;
  padding: 10px;
  font-size: 16px;
  border-radius: 20px;
  border: 1px solid #ddd;
}

.file-upload-label {
  cursor: pointer;
}

.file-upload-input {
  display: none;
}

.typing-indicator {
  display: flex;
  align-items: center;
  font-style: italic;
  font-size: 0.9em;
  color: #666;
}

.dot {
  animation: blink 1.2s infinite steps(1, end);
  font-weight: bold;
}

.dot:nth-child(1) {
  animation-delay: 0s;
}
.dot:nth-child(2) {
  animation-delay: 0.3s;
}
.dot:nth-child(3) {
  animation-delay: 0.6s;
}

@keyframes blink {
  0%,
  20% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.file-input-container {
  position: relative;
  display: inline-block;
}

/* Hidden File Input */
.hidden-file-input {
  display: none; /* Hide the default file input */
}

/* Custom Upload Trigger */
.upload-trigger {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #13a749; /* WhatsApp green */
  border: none;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.3s ease;
}

/* Hover Effect */
.upload-trigger:hover {
  transform: scale(1.1);
}

/* Selected File Preview */
.file-preview {
  margin-top: 10px;
  padding: 10px;
  background-color: #f1f1f1;
  border-radius: 5px;
  font-size: 14px;
  color: #555;
  max-width: 100%;
  word-wrap: break-word;
}

/* Modal Styling */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
  text-align: center;
}

.file-preview img {
  max-width: 100%;
  border-radius: 10px;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.modal-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.modal-actions button:first-child {
  background-color: #ddd;
}

.modal-actions button:last-child {
  background-color: #13a749;
  color: #fff;
}

.send-location-button {
  background-color: #ff5722;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.send-location-button i {
  margin-right: 5px;
}

.only-admins {
  margin-left: 35%;
}
</style>
