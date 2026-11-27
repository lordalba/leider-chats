<template>
  <b-modal
    :visible="visible"
    content-class="ws-scope"
    title="New workspace"
    ok-title="Create workspace"
    cancel-variant="outline-secondary"
    :ok-disabled="!canSubmit"
    @show="onShow"
    @ok.prevent="submit"
    @hidden="onHidden"
    @change="(v) => $emit('update:visible', v)"
  >
    <b-form @submit.prevent="submit">
      <template v-if="!chatroomId">
        <p v-if="chatsLoading" class="text-muted">Loading your group chats…</p>
        <div v-else-if="!chatOptions.length" class="no-groups">
          <p>You need a group chat to create a workspace.</p>
          <router-link to="/chatrooms" @click.native="$emit('update:visible', false)">
            Go to your chats
          </router-link>
        </div>
        <b-form-group v-else label="Group chat" label-for="workspace-chat">
          <b-form-select
            id="workspace-chat"
            v-model="pickedChatId"
            :options="chatOptions"
            required
          >
            <template #first>
              <b-form-select-option :value="null" disabled>Choose a group chat</b-form-select-option>
            </template>
          </b-form-select>
        </b-form-group>
      </template>
      <b-form-group v-if="!needsGroup" label="Name" label-for="workspace-name">
        <b-form-input
          id="workspace-name"
          v-model="name"
          maxlength="80"
          placeholder="e.g. Trip planning"
          autofocus
        />
      </b-form-group>
      <b-form-group v-if="!needsGroup" label="Description (optional)" label-for="workspace-description">
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
import { fetchChatRooms } from "@/api/ChatRoomService";
import { groupChatOptions } from "@/workspaces/chatOptions";

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
    // Given when opened from a chat; otherwise the modal asks for one.
    chatroomId: {
      type: String,
      default: null,
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
      chatOptions: [],
      chatsLoading: false,
      pickedChatId: null,
    };
  },
  computed: {
    trimmedName() {
      return this.name.trim();
    },
    targetChatId() {
      return this.chatroomId || this.pickedChatId;
    },
    // No chat given and none to pick from.
    needsGroup() {
      return !this.chatroomId && (this.chatsLoading || !this.chatOptions.length);
    },
    canSubmit() {
      return !!this.trimmedName && !!this.targetChatId && !this.submitting;
    },
  },
  methods: {
    async submit() {
      if (!this.canSubmit) return;
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
          this.targetChatId,
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
    async onShow() {
      if (this.chatroomId) return;
      this.chatsLoading = true;
      try {
        const response = await fetchChatRooms();
        this.chatOptions = groupChatOptions(response.data);
        if (this.chatOptions.length === 1) this.pickedChatId = this.chatOptions[0].value;
      } catch (error) {
        console.error("Failed to load chats:", error);
        this.chatOptions = [];
        this.$toast.error("Could not load your chats");
      } finally {
        this.chatsLoading = false;
      }
    },
    onHidden() {
      this.name = "";
      this.description = "";
      this.pickedChatId = null;
      this.$emit("update:visible", false);
    },
  },
};
</script>

<style scoped>
.no-groups p {
  margin-bottom: var(--ws-space-1);
}
</style>
