<template>
  <div class="document-editor">
    <div v-if="status" class="document-status">{{ status }}</div>
    <div ref="editor" class="document-quill"></div>
  </div>
</template>

<script>
import * as Y from "yjs";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import { QuillBinding } from "y-quill";
import "quill/dist/quill.snow.css";
import { SocketYProvider } from "@/workspaces/SocketYProvider";
import { userColor, itemErrorMessage } from "@/workspaces/items";

// Pasted/dropped images are embedded as data: URLs inside the Yjs doc; past
// this size they'd exceed what one socket frame may carry.
const MAX_INLINE_IMAGE_CHARS = 3e6;
const Delta = Quill.import("delta");

let cursorsRegistered = false;
function registerCursors() {
  if (cursorsRegistered) return;
  Quill.register("modules/cursors", QuillCursors);
  cursorsRegistered = true;
}

export default {
  name: "DocumentEditor",
  props: {
    docId: {
      type: String,
      required: true,
    },
    connectedUser: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      // Shown until the first sync; afterwards edits made offline are kept
      // locally and merged on reconnect, so the editor stays writable.
      status: "Connecting…",
    };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
  mounted() {
    // Non-reactive on purpose: Vue must not observe Yjs/Quill internals.
    this.ydoc = new Y.Doc();
    registerCursors();
    this.quill = new Quill(this.$refs.editor, {
      theme: "snow",
      readOnly: true,
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "blockquote", "code-block"],
          ["clean"],
        ],
        history: { userOnly: true },
      },
      placeholder: "Start writing…",
    });

    this.quill.clipboard.addMatcher("IMG", (node, delta) => {
      const src = node.getAttribute("src") || "";
      if (src.startsWith("data:") && src.length > MAX_INLINE_IMAGE_CHARS) {
        this.$toast.error(itemErrorMessage("too_large", "document"));
        return new Delta();
      }
      return delta;
    });

    if (!this.socket) {
      this.status = itemErrorMessage("timeout", "document");
      return;
    }

    this.provider = new SocketYProvider(this.socket, this.docId, this.ydoc);
    const user = this.connectedUser || {};
    this.provider.awareness.setLocalStateField("user", {
      name: user.username || "Someone",
      color: userColor(user._id),
    });
    this.binding = new QuillBinding(
      this.ydoc.getText("quill"),
      this.quill,
      this.provider.awareness
    );

    this.provider.on("synced", () => {
      this.status = "";
      this.quill.enable(true);
    });
    this.provider.on("error", (error) => this.onError(error));
    this.socket.on("disconnect", this.onDisconnect);
    // resync() retries a failed open with backoff instead of waiting for a reconnect.
    this.provider.resync();
  },
  beforeDestroy() {
    if (this.socket) this.socket.off("disconnect", this.onDisconnect);
    // Order matters: binding first (it listens to both), then provider, then doc.
    if (this.binding) this.binding.destroy();
    if (this.provider) this.provider.destroy();
    if (this.ydoc) this.ydoc.destroy();
    this.binding = null;
    this.provider = null;
    this.ydoc = null;
    this.quill = null;
  },
  methods: {
    onDisconnect() {
      if (!this.status) this.status = "Offline — your edits will sync when you reconnect";
    },
    onError(error) {
      const code = error && error.message;
      this.$toast.error(itemErrorMessage(code, "document"));
      if (code === "not_found" || code === "forbidden") {
        this.$emit("closed");
      } else if (code === "diverged") {
        // Further edits could never sync: stop accepting them.
        if (this.quill) this.quill.enable(false);
        this.status = itemErrorMessage(code, "document");
      } else if (code !== "too_large") {
        this.status = itemErrorMessage(code, "document");
      }
    },
  },
};
</script>

<style scoped>
.document-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.document-status {
  color: gray;
  font-size: 0.9em;
  margin-bottom: 6px;
}
.document-quill {
  min-height: 60vh;
  background: #fff;
}
</style>
