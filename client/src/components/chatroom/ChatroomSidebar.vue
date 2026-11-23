<template>
  <aside class="chatroom-sidebar">
    <header class="sidebar-header">
      <h6>{{ isGroupChat ? "Group details" : "Contact details" }}</h6>
      <button class="close" aria-label="Close" @click="$emit('close')"><i class="fa-solid fa-xmark"></i></button>
    </header>

    <div class="identity">
      <button class="picture-button" title="View picture" @click="showPicture = true">
        <img v-avatar="isGroupChat ? 'group' : 'user'" :src="picture" :alt="name" class="picture" />
      </button>
      <h4>{{ name }}</h4>
      <p v-if="isGroupChat" class="subtitle">Group · {{ chatroom.participants.length }} members</p>
      <p v-else-if="friend" class="subtitle">
        {{ [friend.age, friend.profession, friend.location].filter(Boolean).join(" • ") }}
      </p>
    </div>

    <ChatDescription
      v-if="isGroupChat"
      :chatroom-id="chatroom._id"
      :description="chatroom.description || ''"
      :can-edit="amIAdmin"
    />

    <ChatWorkspaces :chatroom-id="chatroom._id" />

    <!-- Group: members and admin tools -->
    <section v-if="isGroupChat" class="members">
      <h5>Members</h5>
      <ul>
        <li v-for="participant in chatroom.participants" :key="participant._id" class="member">
          <button class="member-header" @click="toggleMember(participant._id)">
            <img v-avatar :src="participant.profilePictureUrl" :alt="participant.username" class="member-picture" />
            <span class="member-name">
              {{ participant.username }}<span v-if="participant._id === myId" class="you"> (you)</span>
            </span>
            <span v-if="isAdmin(participant)" class="admin-mark">Admin</span>
            <i
              v-if="participant._id !== myId"
              :class="expandedMemberId === participant._id ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
            ></i>
          </button>
          <div v-if="participant._id !== myId && expandedMemberId === participant._id" class="member-actions">
            <button @click="messageParticipant(participant)"><i class="fa-regular fa-comment"></i> Send message</button>
            <template v-if="amIAdmin">
              <button @click="toggleAdmin(participant)">
                <i class="fa-solid fa-shield-halved"></i>
                {{ isAdmin(participant) ? "Remove admin rights" : "Make admin" }}
              </button>
              <button class="danger" @click="removeParticipant(participant)">
                <i class="fa-solid fa-user-minus"></i> Remove from group
              </button>
            </template>
          </div>
        </li>
      </ul>

      <div v-if="amIAdmin" class="setting">
        <span><i class="fa-solid fa-shield-halved"></i> Only admins can send messages</span>
        <ToggleSwitch :value="!!chatroom.adminPermissions" @update:value="updateAdminPermissions" />
      </div>
      <button class="row-action danger" @click="pendingAction = 'exit'">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> Exit group
      </button>
      <button v-if="amIAdmin" class="row-action danger" @click="pendingAction = 'delete'">
        <i class="fa-solid fa-trash"></i> Delete group
      </button>
    </section>

    <!-- One-on-one: groups you share with this person -->
    <section v-else class="members">
      <h5>Groups in common</h5>
      <p v-if="!relatedGroups.length" class="empty">No groups in common yet.</p>
      <ul>
        <li v-for="group in relatedGroups" :key="group._id">
          <button class="member-header" @click="$emit('chatroom-selected', group._id)">
            <img v-avatar="'group'" :src="group.imageUrl" :alt="group.name" class="member-picture" />
            <span class="member-name">{{ group.name }}</span>
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </li>
      </ul>
    </section>

    <ConfirmationModal
      v-if="pendingAction"
      :title="pendingAction === 'delete' ? 'Delete group' : 'Exit group'"
      :description="
        pendingAction === 'delete'
          ? 'Delete this group, its messages and its workspaces for everyone?'
          : 'Are you sure you want to leave this group?'
      "
      confirm-text="Yes"
      cancel-text="No"
      :on-confirm="confirmPendingAction"
      :on-cancel="() => (pendingAction = null)"
    />
    <ImageLightbox
      :src="showPicture ? picture || defaultPicture : ''"
      :caption="name"
      :fallback="isGroupChat ? 'group' : 'user'"
      @close="showPicture = false"
    />
  </aside>
</template>

<script>
import { createChatroom, fetchRelatedChatrooms } from "@/api/ChatRoomService";
import { serverMessage } from "@/api/httpClient";
import { chatDisplayName, chatPicture, otherParticipant } from "@/chat/chatNames";
import { DEFAULT_AVATAR, DEFAULT_GROUP_AVATAR } from "@/utils/avatar";
import ToggleSwitch from "@/components/common/ToggleSwitch.vue";
import ConfirmationModal from "@/components/common/ConfirmationModal.vue";
import ImageLightbox from "@/components/common/ImageLightbox.vue";
import ChatWorkspaces from "./sidebar/ChatWorkspaces.vue";
import ChatDescription from "./sidebar/ChatDescription.vue";

export default {
  name: "ChatroomSidebar",
  components: { ToggleSwitch, ConfirmationModal, ImageLightbox, ChatWorkspaces, ChatDescription },
  props: {
    chatroom: { type: Object, required: true },
    isGroupChat: { type: Boolean, default: false },
  },
  data() {
    return { relatedGroups: [], expandedMemberId: null, pendingAction: null, showPicture: false };
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
    me() {
      return this.$store.state.connectedUser;
    },
    myId() {
      return this.me._id;
    },
    friend() {
      return this.isGroupChat ? null : otherParticipant(this.chatroom, this.myId);
    },
    name() {
      return chatDisplayName(this.chatroom, this.myId);
    },
    picture() {
      return chatPicture(this.chatroom, this.myId);
    },
    defaultPicture() {
      return this.isGroupChat ? DEFAULT_GROUP_AVATAR : DEFAULT_AVATAR;
    },
    amIAdmin() {
      return (this.chatroom.admins || []).includes(this.myId);
    },
  },
  watch: {
    "chatroom._id": {
      immediate: true,
      handler() {
        this.loadRelatedGroups();
      },
    },
  },
  methods: {
    async loadRelatedGroups() {
      this.relatedGroups = [];
      if (this.isGroupChat || !this.friend) return;
      try {
        const { data } = await fetchRelatedChatrooms(this.friend._id);
        this.relatedGroups = data;
      } catch (error) {
        // Not essential: the panel still works without the shared groups.
        this.relatedGroups = [];
      }
    },
    isAdmin(user) {
      return (this.chatroom.admins || []).includes(user._id);
    },
    toggleMember(memberId) {
      if (memberId === this.myId) return;
      this.expandedMemberId = this.expandedMemberId === memberId ? null : memberId;
    },
    /** Opens (or starts) the private chat with a group member. */
    async messageParticipant(participant) {
      try {
        const formData = new FormData();
        formData.append("participants", JSON.stringify([participant._id]));
        const { data: chat } = await createChatroom(formData);
        if (this.socket) this.socket.emit("createdChatroom", chat._id);
        this.$emit("open-chat", chat);
      } catch (error) {
        this.$toast.error(serverMessage(error, "Couldn't open the chat."));
      }
    },
    updateAdminPermissions(adminsOnly) {
      this.socket.emit("updateAdminPermissions", this.chatroom._id, adminsOnly);
    },
    toggleAdmin(participant) {
      this.socket.emit("updateUserAdminStatus", this.chatroom._id, participant._id, !this.isAdmin(participant));
    },
    removeParticipant(participant) {
      this.socket.emit(
        "removeParticipantFromChat",
        this.chatroom._id,
        participant._id,
        participant.username,
        this.me.username
      );
    },
    confirmPendingAction() {
      if (this.pendingAction === "delete") {
        this.socket.emit("deleteRoom", this.chatroom._id, this.myId);
      } else {
        this.socket.emit("exitRoom", this.chatroom._id, this.myId, this.me.username);
        this.$emit("chatroom-exited", this.chatroom._id);
      }
      this.pendingAction = null;
    },
  },
};
</script>

<style scoped>
.chatroom-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1000;
  width: 380px;
  max-width: 100vw;
  height: 100vh;
  padding: 18px 20px;
  overflow-y: auto;
  background: var(--surface);
  color: var(--text);
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
}
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.sidebar-header h6 {
  margin: 0;
  font-weight: 600;
}
.close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-muted);
  cursor: pointer;
}
.identity {
  text-align: center;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.picture-button {
  border: none;
  background: none;
  padding: 0;
  cursor: zoom-in;
}
.picture {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.identity h4 {
  margin: 10px 0 4px;
  font-size: 18px;
  font-weight: bold;
}
.subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}
.members h5 {
  margin-bottom: 8px;
}
.members ul {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}
.member-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 4px;
  border: none;
  border-radius: 8px;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.member-header:hover {
  background: var(--hover);
}
.member-picture {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.member-name {
  flex: 1;
  min-width: 0;
}
.you {
  color: var(--text-muted);
}
.admin-mark {
  color: #2f8a3a;
  background-color: #c8f5cc;
  font-size: 0.75em;
  font-weight: 600;
  border-radius: 6px;
  padding: 2px 6px;
}
.member-actions {
  display: flex;
  flex-direction: column;
  margin: 2px 0 8px 54px;
}
.member-actions button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border: none;
  background: none;
  color: #2f7fd1;
  text-align: left;
  cursor: pointer;
}
.member-actions .danger,
.row-action.danger {
  color: #c0392b;
}
.setting {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.row-action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 0;
  border: none;
  border-top: 1px solid var(--border);
  background: none;
  text-align: left;
  font-size: 1.05em;
  cursor: pointer;
}
.empty {
  color: var(--text-muted);
}
</style>
