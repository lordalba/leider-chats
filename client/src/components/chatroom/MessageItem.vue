<template>
  <div :class="[isOwnMessage ? 'own-msg-cnt' : 'other-msg-cnt']">
    <div
      :class="['message-item', isOwnMessage ? 'own-message' : 'other-message']"
    >
      <!-- Dropdown for actions -->
      <div v-if="!onPropetriesMode" class="dropup">
        <button class="dropbtn">
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div
          :class="[
            'dropup-content',
            isOwnMessage ? 'dropup-content-own' : 'dropup-content-other',
          ]"
        >
          <a
            v-if="isOwnMessage"
            href="#"
            @click.prevent="showMessageDetails = true"
          >
            Message Details
          </a>
          <a v-if="isOwnMessage" href="#">Edit</a>
          <a href="#">Delete</a>
        </div>
      </div>

      <!-- Modal for Message Details -->
      <MessageDetailsModal
        :message="message"
        :isOpen="showMessageDetails"
        @close="showMessageDetails = false"
      />

      <!-- Message Content -->
      <template v-if="message.type === 'text'">
        <p>{{ message.content }}</p>
      </template>

      <template v-else-if="message.type === 'image'">
        <div class="media-content">
          <img :src="message.mediaUrl" alt="Image" class="image-message" />
        </div>
      </template>

      <template v-else-if="message.type === 'voice'">
        <div class="media-content">
          <audio controls>
            <source :src="message.mediaUrl" type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      </template>

      <template v-if="message.type === 'location'">
        <div class="media-content location-preview">
          <div ref="mapContainer" class="map-container"></div>
        </div>
      </template>

      <template v-else-if="message.type === 'file'">
        <div class="media-content file-message">
          <div class="file-icon">
            <i class="fa-solid fa-file"></i>
          </div>
          <div class="file-details">
            <p class="file-name">{{ message.fileName }}</p>
            <p class="file-meta">{{ getFileMeta(message.mediaUrl) }}</p>
          </div>
          <a
            :href="message.mediaUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="file-download"
          >
            <i class="fa-solid fa-download"></i>
          </a>
        </div>
      </template>

      <!-- Seen Indicators -->
      <div v-if="isOwnMessage" class="seen-indicators">
        <span v-if="!isMessageSeenByEveryone" class="seen-indicator">
          <i class="fa-solid fa-check"></i>
          <i class="fa-solid fa-check"></i>
        </span>
        <span v-else class="seen-indicator">
          <i class="fa-solid fa-check" style="color: rgb(100, 173, 255)"></i>
          <i class="fa-solid fa-check" style="color: rgb(100, 173, 255)"></i>
        </span>
      </div>

      <!-- Timestamp -->
      <p class="friend-message">
        {{ formatMessageCreationTime(message.createdAt) }}
      </p>
    </div>

    <!-- Group Chat: Sender Profile Picture -->
    <img
      v-if="isGroupChat && !isOwnMessage"
      :src="message.senderId.profilePictureUrl"
      alt="Profile Picture"
      class="profile-picture"
    />
  </div>
</template>

<script>
import { format } from "date-fns";
import MessageDetailsModal from "./MessageDetailsModal.vue";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

export default {
  name: "MessageItem",
  components: {
    MessageDetailsModal,
  },
  props: {
    message: {
      type: Object,
      required: true,
    },
    participantsAmount: {
      type: Number,
      required: false,
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    isOwnMessage: {
      type: Boolean,
      required: true,
    },
    onPropetriesMode: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      showMessageDetails: false,
    };
  },
  mounted() {
    if (this.message.type === "location" && this.message.content) {
      this.renderMap();
    }
  },

  methods: {
    formatMessageCreationTime(createdAt) {
      return format(new Date(createdAt), "HH:mm");
    },
    renderMap() {
      const mapContainer = this.$refs.mapContainer;
      if (!mapContainer) return;

      const [latitude, longitude] = this.getCoordinatesFromContent(
        this.message.content
      );

      this.$nextTick(() => {
        const map = L.map(mapContainer).setView([latitude, longitude], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        L.Icon.Default.mergeOptions({
          iconUrl: markerIcon,
          iconRetinaUrl: markerIconRetina,
          shadowUrl: markerShadow,
        });
        
        L.marker([latitude, longitude]).addTo(map);

        setTimeout(() => {
          map.invalidateSize();
        }, 300);
      });
    },
    getCoordinatesFromContent(content) {
      const coordinatesAsString = content.split(",");
      return [
        parseFloat(coordinatesAsString[0]),
        parseFloat(coordinatesAsString[1]),
      ];
    },
    getFileMeta(fileUrl) {
      // For simplicity, extract file extension as metadata
      const parts = fileUrl.split(".");
      const fileType =
        parts.length > 1
          ? parts[parts.length - 1].toUpperCase()
          : "Unknown Type";

      // You can extend this to fetch file size or more info if stored in your backend
      return fileType;
    },
  },
  computed: {
    isMessageSeenByEveryone() {
      return this.participantsAmount === this.message.seenBy.length;
    },
  },
};
</script>

<style scoped>
.message-item {
  display: inline-block;
  margin: 5px 0;
  padding: 10px;
  border-radius: 10px;
  max-width: 70%;
}

.media-content {
  margin-top: 10px;
  text-align: center;
}

.media-content a {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}

.image-message {
  max-width: 100%;
  max-height: 300px; /* Limit image height */
  object-fit: cover; /* Ensure proper scaling */
  border-radius: 10px;
}

.own-msg-cnt {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  align-items: flex-end;
}

.other-msg-cnt {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: flex-end;
}

.own-message {
  background-color: #dcf8c6;
  color: #000;
  border-radius: 10px 10px 10px 0;
  padding-left: 20px;
  text-align: left;
}

.other-message {
  background-color: #fff;
  color: #000;
  border-radius: 10px 10px 0 10px;
  padding-right: 20px;
  margin-bottom: 20px;
  text-align: left;
}

.friend-message {
  color: #666;
  font-size: 0.9em;
  margin-top: 5px;
}

.seen-indicator {
  font-size: 0.8em;
  color: #888;
  margin-top: 5px;
}

.profile-picture {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.dropbtn {
  color: rgb(175, 175, 175);
  padding: 5px;
  font-size: 8px;
  border-radius: 50%;
  border: none;
}

.dropup {
  position: relative;
  display: inline-block;
}

.dropup-content {
  display: none;
  position: absolute;
  background-color: #f1f1f1;
  min-width: 160px;
  bottom: 20px;
  z-index: 1;
}

.dropup-content a {
  color: black;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
}

.dropup-content a:hover {
  background-color: #ccc;
}

.dropup:hover .dropup-content {
  display: block;
}

.map-container {
  width: 450px; /* Slightly larger max width for better visibility */
  height: 250px; /* Increase the height for a more visible map */
  border-radius: 10px;
  overflow: hidden;
  margin-top: 10px;
  background: #f1f1f1; /* Add a fallback background to avoid collapse */
}

.location-preview {
  text-align: center;
  width: 100%; /* Allow it to take the full width of the parent */
}

.file-message {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #f1f0f0;
  border-radius: 10px;
  gap: 10px;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: #e6e6e6;
  border-radius: 50%;
  font-size: 18px;
  color: #007bff;
}

.file-details {
  flex-grow: 1;
  overflow: hidden;
}

.file-name {
  font-weight: bold;
  font-size: 14px;
  color: #333;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.file-meta {
  font-size: 12px;
  color: #666;
}

.file-download {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #007bff;
  font-size: 18px;
  text-decoration: none;
}

.file-download:hover {
  color: #0056b3;
}
</style>
