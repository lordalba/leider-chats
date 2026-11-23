<template>
  <section class="description">
    <header>
      <h5>Description</h5>
      <button v-if="canEdit && !editing" class="edit" title="Edit description" @click="startEditing">
        <i class="fa-solid fa-pen"></i>
      </button>
    </header>

    <div v-if="editing">
      <textarea v-model="draft" rows="4" maxlength="500" placeholder="What is this group about?"></textarea>
      <div class="actions">
        <span class="counter">{{ draft.length }}/500</span>
        <button class="link" :disabled="saving" @click="editing = false">Cancel</button>
        <button class="save" :disabled="saving" @click="save">{{ saving ? "Saving…" : "Save" }}</button>
      </div>
    </div>
    <p v-else-if="description" class="text">{{ description }}</p>
    <p v-else class="empty">
      {{ canEdit ? "No description yet. Click the pencil to add one." : "No description yet." }}
    </p>
  </section>
</template>

<script>
import { emitWithAck, errorMessage } from "@/socket/socketCall";

/** A group's description. Everyone can read it; only group admins can edit it. */
export default {
  name: "ChatDescription",
  props: {
    chatroomId: { type: String, required: true },
    description: { type: String, default: "" },
    canEdit: { type: Boolean, default: false },
  },
  data() {
    return { editing: false, draft: "", saving: false };
  },
  methods: {
    startEditing() {
      this.draft = this.description;
      this.editing = true;
    },
    async save() {
      this.saving = true;
      try {
        // The server checks admin rights and tells every member (including us) about the change.
        await emitWithAck(this.$store.getters["socket/socket"], "updateChatDescription", this.chatroomId, this.draft);
        this.editing = false;
      } catch (err) {
        this.$toast.error(errorMessage(err));
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.description {
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
h5 {
  margin: 0 0 6px;
}
.edit {
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.text {
  white-space: pre-wrap;
  margin: 0;
  text-align: left !important;
}
.empty {
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
  text-align: left !important;
}
textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  resize: vertical;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}
.counter {
  margin-right: auto;
  font-size: 0.8em;
  color: var(--text-muted);
}
.link {
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.save {
  border: none;
  border-radius: 6px;
  padding: 4px 14px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
</style>
