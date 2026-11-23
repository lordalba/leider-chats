<template>
  <div v-if="src" class="lightbox" role="dialog" aria-modal="true" :aria-label="alt" @click="$emit('close')">
    <button class="close" aria-label="Close" @click.stop="$emit('close')">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <img v-avatar="fallback" :src="src" :alt="alt" @click.stop />
    <p v-if="caption" class="caption" @click.stop>{{ caption }}</p>
  </div>
</template>

<script>
/** Shows a picture large in the middle of the screen. Click outside or press Escape to close. */
export default {
  name: "ImageLightbox",
  props: {
    /** The picture to show; the lightbox is hidden while this is empty. */
    src: { type: String, default: "" },
    alt: { type: String, default: "Picture" },
    caption: { type: String, default: "" },
    /** "user" or "group": which default picture to use if this one fails to load. */
    fallback: { type: String, default: "user" },
  },
  mounted() {
    this.onKeyDown = (event) => {
      if (event.key === "Escape" && this.src) this.$emit("close");
    };
    window.addEventListener("keydown", this.onKeyDown);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKeyDown);
  },
};
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  cursor: zoom-out;
}
.lightbox img {
  max-width: min(90vw, 900px);
  max-height: 80vh;
  border-radius: 12px;
  object-fit: contain;
  background: #fff;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  cursor: default;
}
.caption {
  margin-top: 12px;
  color: #fff;
  font-size: 1.1em;
}
.close {
  position: absolute;
  top: 16px;
  right: 22px;
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
}
</style>
