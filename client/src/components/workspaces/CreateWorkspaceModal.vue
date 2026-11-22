<template>
  <b-modal
    :visible="visible"
    title="New workspace"
    ok-title="Create"
    :ok-disabled="!trimmedName || submitting"
    @ok.prevent="submit"
    @hidden="onHidden"
    @change="(v) => $emit('update:visible', v)"
  >
    <b-form @submit.prevent="submit">
      <b-form-group label="Name" label-for="workspace-name">
        <b-form-input
          id="workspace-name"
          v-model="name"
          maxlength="80"
          placeholder="e.g. Trip planning"
          autofocus
        />
      </b-form-group>
      <b-form-group label="Description (optional)" label-for="workspace-description">
        <b-form-textarea
          id="workspace-description"
          v-model="description"
          rows="3"
        />
      </b-form-group>
    </b-form>
  </b-modal>
</template>

<script>
import { emitWithAck } from "@/workspaces/socketCall";

const ERROR_MESSAGES = {
  invalid: "Name must be 1–80 characters",
};

export default {
  name: "CreateWorkspaceModal",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    chatroomId: {
      type: String,
      required: true,
    },
    socket: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      name: "",
      description: "",
      submitting: false,
    };
  },
  computed: {
    trimmedName() {
      return this.name.trim();
    },
  },
  methods: {
    async submit() {
      if (!this.trimmedName || this.submitting) return;
      if (!this.socket) {
        this.$toast.error("Could not create workspace");
        return;
      }
      this.submitting = true;
      try {
        const input = { name: this.trimmedName };
        if (this.description.trim()) input.description = this.description.trim();
        const workspace = await emitWithAck(
          this.socket,
          "workspace:create",
          this.chatroomId,
          input
        );
        this.$emit("created", workspace);
        this.$emit("update:visible", false);
      } catch (error) {
        console.error("workspace:create failed:", error);
        this.$toast.error(
          ERROR_MESSAGES[error.message] || "Could not create workspace"
        );
      } finally {
        this.submitting = false;
      }
    },
    onHidden() {
      this.name = "";
      this.description = "";
      this.$emit("update:visible", false);
    },
  },
};
</script>
