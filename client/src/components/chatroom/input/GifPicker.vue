<template>
  <div class="gif-picker" role="dialog" aria-label="GIF library">
    <header>
      <input v-model="search" type="search" class="search" placeholder="Search GIFs…" />
      <label class="upload" :class="{ busy: uploading }" title="Add a GIF for everyone">
        <input type="file" accept=".gif,.webp,.png,.jpg,.jpeg" :disabled="uploading" @change="onFilePicked" />
        <i :class="uploading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'"></i>
        {{ uploading ? "Adding…" : "Add GIF" }}
      </label>
    </header>

    <p v-if="loading" class="hint">Loading…</p>
    <p v-else-if="!gifs.length" class="hint">No GIFs yet. Click “Add GIF” to add the first one.</p>
    <p v-else-if="!visibleGifs.length" class="hint">No GIFs match “{{ search }}”. Add your own!</p>
    <div v-else class="grid">
      <div v-for="gif in visibleGifs" :key="gif._id" class="gif" :title="gif.title">
        <button class="send" :aria-label="`Send ${gif.title}`" @click="$emit('pick', gif.url)">
          <img :src="gif.url" :alt="gif.title" loading="lazy" />
        </button>
        <button v-if="isMine(gif)" class="remove" title="Remove this GIF (you added it)" @click="remove(gif)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
    <p class="footnote">GIFs you add are shared with everyone.</p>
  </div>
</template>

<script>
import { addGif, fetchGifs, removeGif } from "@/api/GifService";
import { serverMessage } from "@/api/httpClient";

const MAX_GIF_BYTES = 10 * 1024 * 1024;
const GIF_TYPES = ["image/gif", "image/webp", "image/png", "image/jpeg"];

/** The shared GIF library. Emits `pick(url)` to send a GIF. */
export default {
  name: "GifPicker",
  data() {
    return { gifs: [], loading: true, uploading: false, search: "" };
  },
  computed: {
    myId() {
      return this.$store.state.connectedUser._id;
    },
    visibleGifs() {
      const term = this.search.trim().toLowerCase();
      if (!term) return this.gifs;
      return this.gifs.filter((gif) => gif.title.toLowerCase().includes(term));
    },
  },
  async created() {
    try {
      this.gifs = await fetchGifs();
    } catch (error) {
      this.$toast.error(serverMessage(error, "Couldn't load the GIFs."));
    } finally {
      this.loading = false;
    }
  },
  methods: {
    isMine(gif) {
      return !gif.isDefault && String(gif.addedBy) === String(this.myId);
    },
    async onFilePicked(event) {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;
      if (!GIF_TYPES.includes(file.type)) {
        this.$toast.error(`Couldn't add a file of type "${file.name.split(".").pop()}". Pick a GIF or an image.`);
        return;
      }
      if (file.size > MAX_GIF_BYTES) {
        this.$toast.error("That GIF is too large (max 10 MB).");
        return;
      }
      this.uploading = true;
      try {
        const gif = await addGif(file);
        this.gifs = [gif, ...this.gifs];
        this.search = "";
        this.$toast.success(`“${gif.title}” was added for everyone.`);
      } catch (error) {
        this.$toast.error(serverMessage(error, "Couldn't add the GIF."));
      } finally {
        this.uploading = false;
      }
    },
    async remove(gif) {
      try {
        await removeGif(gif._id);
        this.gifs = this.gifs.filter((g) => g._id !== gif._id);
      } catch (error) {
        this.$toast.error(serverMessage(error, "Couldn't remove the GIF."));
      }
    },
  },
};
</script>

<style scoped>
.gif-picker {
  width: 360px;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-strong);
  padding: 10px;
}
header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.search {
  flex: 1;
  min-width: 0;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text);
}
.upload {
  margin: 0;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: 0.85em;
  white-space: nowrap;
  cursor: pointer;
}
.upload.busy {
  opacity: 0.6;
  cursor: default;
}
.upload input {
  display: none;
}
.hint {
  color: var(--text-muted);
  font-size: 0.9em;
  margin: 10px 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}
.gif {
  position: relative;
}
.send {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: var(--surface-2);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
}
.send img {
  display: block;
  width: 100%;
  height: 90px;
  object-fit: cover;
}
.remove {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  display: none;
  cursor: pointer;
}
.gif:hover .remove {
  display: block;
}
.footnote {
  margin: 8px 0 0;
  font-size: 0.75em;
  color: var(--text-muted);
  text-align: center;
}
</style>
