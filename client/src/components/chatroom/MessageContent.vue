<template>
  <div class="message-content">
    <p v-if="message.deleted" class="deleted"><i class="fa-solid fa-ban"></i> This message was deleted</p>

    <template v-else-if="message.type === 'image'">
      <button class="image-button" title="Open picture" @click="$emit('open-image', message.mediaUrl)">
        <img :src="message.mediaUrl" :alt="message.fileName || 'Picture'" class="image" loading="lazy" />
      </button>
      <p v-if="message.content" class="text">{{ message.content }}</p>
    </template>

    <template v-else-if="message.type === 'voice'">
      <audio controls :src="message.mediaUrl" class="audio">Your browser does not support audio.</audio>
      <p v-if="message.content" class="text">{{ message.content }}</p>
    </template>

    <template v-else-if="message.type === 'file'">
      <a :href="message.mediaUrl" target="_blank" rel="noopener noreferrer" class="file" :download="message.fileName">
        <span class="file-icon"><i :class="fileIcon"></i></span>
        <span class="file-details">
          <span class="file-name">{{ message.fileName || "File" }}</span>
          <span class="file-meta">{{ fileExtension }}</span>
        </span>
        <i class="fa-solid fa-download"></i>
      </a>
      <p v-if="message.content" class="text">{{ message.content }}</p>
    </template>

    <!-- Location sharing was removed; old location messages link to the map instead. -->
    <a v-else-if="message.type === 'location'" :href="mapUrl" target="_blank" rel="noopener noreferrer" class="location">
      <i class="fa-solid fa-location-dot"></i> Shared a location · Open map
    </a>

    <!-- Text, with ```code blocks``` and `inline code` -->
    <div v-else class="rich-text">
      <template v-for="(segment, index) in segments">
        <CodeBlock v-if="segment.type === 'codeblock'" :key="index" :code="segment.code" :language="segment.language" />
        <code v-else-if="segment.type === 'code'" :key="index" class="inline-code">{{ segment.text }}</code>
        <span v-else :key="index" class="text">{{ segment.text }}</span>
      </template>
    </div>
  </div>
</template>

<script>
import CodeBlock from "./CodeBlock.vue";
import { parseMessage } from "@/chat/messageFormatter";

const ICONS = {
  PDF: "fa-solid fa-file-pdf",
  DOC: "fa-solid fa-file-word",
  DOCX: "fa-solid fa-file-word",
  XLS: "fa-solid fa-file-excel",
  XLSX: "fa-solid fa-file-excel",
  PPT: "fa-solid fa-file-powerpoint",
  PPTX: "fa-solid fa-file-powerpoint",
  ZIP: "fa-solid fa-file-zipper",
  RAR: "fa-solid fa-file-zipper",
  TXT: "fa-solid fa-file-lines",
  MP4: "fa-solid fa-file-video",
  MOV: "fa-solid fa-file-video",
};

/** Renders the body of a chat message (text, picture, voice, file, or a deleted placeholder). */
export default {
  name: "MessageContent",
  components: { CodeBlock },
  props: {
    message: { type: Object, required: true },
  },
  computed: {
    segments() {
      return parseMessage(this.message.content);
    },
    fileExtension() {
      const name = this.message.fileName || this.message.mediaUrl || "";
      const match = /\.([a-z0-9]+)(?:\?|$)/i.exec(name);
      return match ? match[1].toUpperCase() : "FILE";
    },
    fileIcon() {
      return ICONS[this.fileExtension] || "fa-solid fa-file";
    },
    mapUrl() {
      const [lat, lng] = String(this.message.content || "").split(",").map(Number);
      return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
    },
  },
};
</script>

<style scoped>
.text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.rich-text {
  line-height: 1.45;
}
.inline-code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--inline-code-bg);
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.88em;
}
.deleted {
  margin: 0;
  font-style: italic;
  opacity: 0.6;
}
.image-button {
  display: block;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
}
.image {
  display: block;
  max-width: 100%;
  max-height: 280px;
  border-radius: 8px;
  object-fit: cover;
}
.image + .text,
.image-button + .text,
.audio + .text,
.file + .text {
  margin-top: 6px;
}
.audio {
  max-width: 100%;
}
.file,
.location {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  color: inherit;
  text-decoration: none;
}
.file:hover,
.location:hover {
  background: rgba(0, 0, 0, 0.1);
}
.file-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 123, 255, 0.15);
  color: #007bff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.file-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.file-name {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-meta {
  font-size: 12px;
  opacity: 0.7;
}
</style>
