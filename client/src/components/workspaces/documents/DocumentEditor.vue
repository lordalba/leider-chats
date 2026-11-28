<template>
  <div class="document-editor">
    <header class="doc-header">
      <form v-if="renaming" class="doc-rename" @submit.prevent="saveRename">
        <input
          ref="renameInput"
          v-model="draftTitle"
          class="form-control"
          maxlength="120"
          aria-label="Document title"
          @keydown.esc.prevent.stop="renaming = false"
          @blur="saveRename"
        />
      </form>
      <button
        v-else
        type="button"
        class="doc-title"
        :title="title + ' (click to rename)'"
        @click="startRename"
      >
        <span class="doc-title-text">{{ title }}</span>
        <i class="fa-solid fa-pen" aria-hidden="true"></i>
      </button>
      <div v-if="viewers.length" class="doc-viewers" :aria-label="viewersLabel">
        <UserAvatar
          v-for="member in viewers"
          :key="member.userId"
          class="doc-viewer"
          :username="member.username"
          :userId="String(member.userId)"
          :src="member.profilePictureUrl || ''"
          :size="26"
        />
      </div>
      <span class="doc-sync" :class="'tone-' + sync.tone" role="status" aria-live="polite">
        <span class="doc-sync-dot" aria-hidden="true"></span>
        {{ sync.text }}
      </span>
    </header>
    <div class="doc-body">
      <div ref="editor" class="document-quill"></div>
    </div>
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
import { syncLabel } from "@/workspaces/syncStatus";
import UserAvatar from "@/components/workspaces/UserAvatar.vue";

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
  components: { UserAvatar },
  props: {
    title: {
      type: String,
      default: "",
    },
    // Other people with this document open (presence members).
    viewers: {
      type: Array,
      default: () => [],
    },
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
      // SocketYProvider status(), shown through syncLabel. Until the first
      // sync the editor is read-only; afterwards edits made offline are kept
      // locally and merged on reconnect.
      syncState: { connected: true, synced: false, diverged: false, retrying: false },
      // Set when the editor can't work at all (no socket).
      fatal: "",
      renaming: false,
      draftTitle: "",
    };
  },
  computed: {
    sync() {
      return this.fatal ? { text: this.fatal, tone: "error" } : syncLabel(this.syncState);
    },
    viewersLabel() {
      return "Also here: " + this.viewers.map((m) => m.username).join(", ");
    },
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
      this.fatal = itemErrorMessage("timeout", "document");
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
      if (this.quill) this.quill.enable(true);
    });
    this.provider.on("status", (state) => {
      this.syncState = state;
    });
    this.provider.on("error", (error) => this.onError(error));
    // resync() retries a failed open with backoff instead of waiting for a reconnect.
    this.provider.resync();
  },
  beforeDestroy() {
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
    startRename() {
      this.draftTitle = this.title;
      this.renaming = true;
      this.$nextTick(() => {
        const input = this.$refs.renameInput;
        if (input) {
          input.focus();
          input.select();
        }
      });
    },
    // Enter or leaving the field saves; Esc cancels (and skips the blur save).
    saveRename() {
      if (!this.renaming) return;
      this.renaming = false;
      const title = this.draftTitle.trim();
      if (title && title !== this.title) this.$emit("rename", title);
    },
    onError(error) {
      const code = error && error.message;
      // The status pill shows offline/retrying; toasts are for what needs
      // the user's attention now.
      if (["diverged", "not_found", "forbidden", "too_large"].includes(code)) {
        this.$toast.error(itemErrorMessage(code, "document"));
      }
      if (code === "not_found" || code === "forbidden") {
        this.$emit("closed");
      } else if (code === "diverged") {
        // Further edits could never sync: stop accepting them.
        if (this.quill) this.quill.enable(false);
      }
    },
  },
};
</script>

<style scoped>
.document-editor {
  flex: 1;
  align-self: stretch;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ws-surface);
  border: 1px solid var(--ws-border);
  border-radius: var(--ws-radius);
  overflow: hidden;
}
.doc-header {
  display: flex;
  align-items: center;
  gap: var(--ws-space-3);
  padding: var(--ws-space-2) var(--ws-space-3);
  border-bottom: 1px solid var(--ws-border);
}
.doc-title,
.doc-rename {
  flex: 1;
  min-width: 0;
}
.doc-title {
  display: flex;
  align-items: center;
  gap: var(--ws-space-2);
  padding: 4px 6px;
  border: none;
  border-radius: var(--ws-radius-sm);
  background: none;
  color: var(--ws-text);
  font-size: 18px;
  font-weight: 600;
  text-align: left;
}
.doc-title:hover {
  background: var(--ws-surface-muted);
}
.doc-title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.doc-title .fa-pen {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ws-text-muted);
}
.doc-viewers {
  display: flex;
}
.doc-viewer + .doc-viewer {
  margin-left: -6px;
}
.doc-sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
  color: var(--ws-text-muted);
  background: var(--ws-surface-muted);
}
.doc-sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.doc-sync.tone-ok .doc-sync-dot {
  background: var(--ws-accent);
}
.doc-sync.tone-warn {
  background: var(--ws-warn-soft);
  color: var(--ws-warn);
}
.doc-sync.tone-error {
  background: #fbeaea;
  color: var(--ws-danger);
}
/* The toolbar stays put; only the text area scrolls. */
.doc-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.doc-body ::v-deep .ql-toolbar {
  flex-shrink: 0;
  border: none;
  border-bottom: 1px solid var(--ws-border);
}
.document-quill {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: none !important;
  font-size: 15px;
}
.document-quill ::v-deep .ql-editor {
  min-height: 100%;
  padding: var(--ws-space-4) 20px;
}
</style>
