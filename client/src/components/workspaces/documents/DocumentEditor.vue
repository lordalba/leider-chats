<template>
  <div class="document-editor">
    <div v-if="!synced" class="status">
      <i class="fa-solid fa-spinner fa-spin"></i> {{ error ? "Couldn't open this document." : "Connecting…" }}
    </div>
    <div ref="editor" class="editor"></div>
  </div>
</template>

<script>
import * as Y from "yjs";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import { QuillBinding } from "y-quill";
import "quill/dist/quill.snow.css";
import { SocketYProvider } from "@/workspaces/SocketYProvider";
import { colorForUser } from "@/workspaces/colors";
import { errorMessage } from "@/workspaces/socketCall";

Quill.register("modules/cursors", QuillCursors);

export default {
  name: "DocumentEditor",
  props: {
    docId: { type: String, required: true },
    connectedUser: { type: Object, required: true },
  },
  data() {
    return { synced: false, error: null };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
  mounted() {
    // Kept off `data` so Vue doesn't make Yjs/Quill internals reactive.
    this.ydoc = new Y.Doc();
    this.provider = new SocketYProvider(this.socket, this.docId, this.ydoc);
    this.quill = new Quill(this.$refs.editor, {
      theme: "snow",
      readOnly: true,
      placeholder: "Start writing…",
      modules: {
        cursors: { transformOnTextChange: true },
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "code-block", "link"],
          ["clean"],
        ],
        history: { userOnly: true },
      },
    });
    this.binding = new QuillBinding(this.ydoc.getText("quill"), this.quill, this.provider.awareness);

    const user = this.connectedUser;
    this.provider.awareness.setLocalStateField("user", {
      name: user.username,
      color: colorForUser(user._id),
    });

    this.provider.on("synced", () => {
      this.synced = true;
      this.error = null;
      this.quill.enable(true);
    });
    this.provider.on("error", (err) => {
      this.error = err;
      this.$toast.error(errorMessage(err));
    });
    this.onDisconnect = () => {
      this.synced = false;
      this.quill.enable(false);
    };
    if (this.socket) this.socket.on("disconnect", this.onDisconnect);

    this.provider.connect().catch((err) => {
      this.error = err;
      this.$toast.error(errorMessage(err));
    });
  },
  beforeDestroy() {
    if (this.socket) this.socket.off("disconnect", this.onDisconnect);
    if (this.binding) this.binding.destroy();
    if (this.provider) this.provider.destroy();
    if (this.ydoc) this.ydoc.destroy();
  },
};
</script>

<style scoped>
.document-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border-radius: 8px;
  position: relative;
}
.status {
  position: absolute;
  top: 50px;
  right: 12px;
  z-index: 2;
  background: #fff8e1;
  border: 1px solid #f1d27a;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 0.85em;
}
.editor {
  min-height: 55vh;
  font-size: 15px;
}
</style>
