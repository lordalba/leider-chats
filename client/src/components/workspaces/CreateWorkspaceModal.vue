<template>
  <b-modal
    :visible="visible"
    title="New workspace"
    ok-title="Create"
    :ok-disabled="!trimmedName || saving"
    @ok.prevent="create"
    @hidden="reset"
    @change="(v) => $emit('update:visible', v)"
  >
    <p class="hint">Everyone in this chat can open and edit the workspace.</p>
    <b-form @submit.prevent="create">
      <b-form-group label="Name" label-for="workspace-name">
        <b-form-input id="workspace-name" v-model="name" maxlength="80" autofocus required />
      </b-form-group>
      <b-form-group label="Description (optional)" label-for="workspace-description">
        <b-form-textarea id="workspace-description" v-model="description" maxlength="500" rows="3" />
      </b-form-group>
    </b-form>
  </b-modal>
</template>

<script>
import { emitWithAck, errorMessage } from "@/workspaces/socketCall";

export default {
  name: "CreateWorkspaceModal",
  props: {
    visible: { type: Boolean, default: false },
    chatroomId: { type: String, required: true },
  },
  data() {
    return { name: "", description: "", saving: false };
  },
  computed: {
    trimmedName() {
      return this.name.trim();
    },
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
  methods: {
    async create() {
      if (!this.trimmedName || this.saving) return;
      this.saving = true;
      try {
        const workspace = await emitWithAck(this.socket, "workspace:create", this.chatroomId, {
          name: this.trimmedName,
          description: this.description.trim(),
        });
        this.$emit("update:visible", false);
        this.$emit("created", workspace);
      } catch (err) {
        this.$toast.error(errorMessage(err));
      } finally {
        this.saving = false;
      }
    },
    reset() {
      this.name = "";
      this.description = "";
    },
  },
};
</script>

<style scoped>
.hint {
  color: gray;
  font-size: 0.9em;
}
</style>
