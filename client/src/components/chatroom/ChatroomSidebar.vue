<template>
  <div class="chatroom-sidebar">
    <div class="sidebar-header" style="margin-bottom: 10%">
      <button @click="$emit('close')"><i class="fa-solid fa-x"></i></button>
      <h6>Chat Details</h6>
    </div>
    <div class="sidebar-content">
      <div style="text-align: center" class="details">
        <img
          :src="friend ? friend.profilePictureUrl : chatroom.imageUrl"
          alt="Chatroom"
          class="sidebar-chatroom-image"
        />
        <h4>{{ friend ? friend.username : chatroom.name }}</h4>
        <p v-if="chatroom.isGroupChat">
          Group Chat - {{ chatroom.participants.length }} participants
        </p>
        <p v-else>
          {{ friend.age }} • {{ friend.profession }} • {{ friend.location }}
        </p>
      </div>
      <h5 style="margin-bottom: 5%">
        {{ isGroupChat ? "Participants:" : "Related Groups" }}
      </h5>
      <ul>
        <div v-if="isGroupChat">
          <li
            v-for="participant in chatroom.participants"
            :key="participant._id"
            class="user-details"
          >
            <div
              @click="toggleAccordion(participant._id)"
              class="participant-header"
            >
              <img
                :src="participant.profilePictureUrl"
                alt="User"
                class="participant-image"
              />
              {{ participant.username }}
              <i
                :class="[
                  'accordion-icon',
                  expandedParticipantId === participant._id
                    ? 'fa-solid fa-chevron-up'
                    : 'fa-solid fa-chevron-down',
                ]"
              ></i>
            </div>
            <div
              v-if="participant._id !== $store.state.connectedUser._id"
              v-show="expandedParticipantId === participant._id"
              class="accordion-content"
            >
              <p
                class="accordion-option"
                style="border-bottom: 1px solid rgb(228, 228, 228)"
                @click="messageParticipant(participant)"
              >
                Send Message
              </p>
              <p
                v-if="isUserAdmin($store.state.connectedUser)"
                class="accordion-option"
                style="border-bottom: 1px solid rgb(228, 228, 228)"
                @click="changeUserAdminStatus(participant)"
              >
                {{`${isUserAdmin(participant) ? 'Remove' : 'Add'} Admin permissions`}} 
              </p>
              <p
                v-if="isUserAdmin($store.state.connectedUser)"
                class="accordion-option"
                @click="removeParticipant(participant)"
              >
                Remove Participant
              </p>
            </div>
            <div v-if="isUserAdmin(participant)" class="admin-mark">
              Group Admin
            </div>
          </li>
          <div style="border-bottom: 1px solid rgb(153, 153, 153)"></div>
          <div
            v-if="isUserAdmin($store.state.connectedUser)"
            class="permissions-details delete-chat-option"
            id="delete-chat"
          >
            <i class="fa-solid fa-shield-halved" id="permissions-icon"></i>
            Admin-Only Mode
            <ToggleSwitch
              :value="chatroom.adminPermissions"
              @update:value="updateAdminPermissions"
            />
          </div>
          <div
            class="user-details delete-chat-option"
            id="delete-chat"
            @click="openExitModal"
          >
            <div style="margin-right: auto;">
              <i
                class="fa-solid fa-arrow-right-from-bracket"
                id="delete-chat-icon"
              ></i>
              Exit Group
            </div>
          </div>
          <ConfirmationModal
            v-if="showExitModal"
            title="Confirm Exiting GroupChat"
            description="Are you sure you want to exit this group chat?"
            confirmText="Yes"
            cancelText="No"
            :onConfirm="confirmExit"
            :onCancel="closeExitModal"
          />
          <div
            v-if="isUserAdmin($store.state.connectedUser)"
            class="user-details delete-chat-option"
            id="delete-chat"
            @click="openDeleteModal"
          >
            <div style="margin-right: auto;">
              <i class="fa-solid fa-trash" id="delete-chat-icon"></i>
              Delete GroupChat
            </div>
          </div>
          <!-- Generic Confirmation Modal -->
          <ConfirmationModal
            v-if="showDeleteModal"
            title="Confirm Deletion"
            description="Are you sure you want to delete this group chat?"
            confirmText="Yes"
            cancelText="No"
            :onConfirm="confirmDelete"
            :onCancel="closeDeleteModal"
          />
        </div>
        <div v-else>
          <h5 v-if="relatedGroups.length == 0" style="opacity: .6; text-align: center;">
        Pretty empty here..<br>
        (sure you're friends?)
      </h5>
          <li
            v-for="group in relatedGroups"
            :key="group._id"
            class="user-details"
            id="delete-chat"
            @click="handleChosenChatroom(group._id)"
            @mouseover="hoveredGroupId = group._id"
            @mouseleave="hoveredGroupId = null"
          >
            <div v-if="hoveredGroupId === group._id">
              Click to enter chatroom
            </div>
            <div v-else>
              <img :src="group.imageUrl" alt="User" class="participant-image" />
              {{ group.name }}
            </div>
          </li>
        </div>
      </ul>
    </div>
  </div>
</template>

<script>
import { fetchRelatedChatrooms } from "@/api/ChatRoomService"; // Replace with your API service
import ToggleSwitch from "../ToggleSwitch.vue";
import ConfirmationModal from "../ConfirmationModal.vue";

export default {
  components: {
    ToggleSwitch,
    ConfirmationModal,
  },
  props: {
    chatroom: {
      type: Object,
      required: true,
    },
    isGroupChat: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      friend: null,
      relatedGroups: [],
      showDeleteModal: false,
      showExitModal: false,
      hoveredGroupId: null,
      hoverOnPermissions: false,
      expandedParticipantId: null,
    };
  },
  async mounted() {
    if (!this.isGroupChat) {
      this.friend = this.extractFriendFromChatroom();
      const response = await fetchRelatedChatrooms(this.friend._id);
      this.relatedGroups = response.data;
    }
  },
  methods: {
    toggleAccordion(participantId) {
      this.expandedParticipantId =
        this.expandedParticipantId === participantId ? null : participantId;
    },
    getPermissionsText() {
      return this.chatroom.adminPermissions ? "On" : "Off";
    },
    extractFriendFromChatroom() {
      const chatParticipants = this.chatroom.participants || [];
      return chatParticipants.find(
        (participant) => participant._id !== this.$store.state.connectedUser._id
      );
    },
    async updateAdminPermissions(newState) {
      this.socket.emit("updateAdminPermissions", this.chatroom._id, newState);
    },
    changeUserAdminStatus(participant) {
      this.socket.emit("updateUserAdminStatus", this.chatroom._id, participant._id, !this.isUserAdmin(participant));
    },
    removeParticipant(participant) {
      this.socket.emit("removeParticipantFromChat", this.chatroom._id, participant._id, participant.username, this.$store.state.connectedUser.username);
    },
    isUserAdmin(user) {
      return this.chatroom.admins.includes(user._id);
    },
    openDeleteModal() {
      this.showDeleteModal = true;
    },
    openExitModal() {
      this.showExitModal = true;
    },
    closeDeleteModal() {
      this.showDeleteModal = false;
    },
    closeExitModal() {
      this.showExitModal = false;
    },
    async confirmDelete() {
      try {
        if (this.socket) {
          this.socket.emit(
            "deleteRoom",
            this.chatroom._id,
            this.$store.state.connectedUser._id
          );
        }
        this.closeDeleteModal();
      } catch (error) {
        console.error("Failed to delete chatroom:", error);
        alert("Failed to delete the chatroom. Please try again."); // Optional error alert
      }
    },
    async confirmExit() {
      try {
        if (this.socket) {
          this.socket.emit(
            "exitRoom",
            this.chatroom._id,
            this.$store.state.connectedUser._id,
            this.$store.state.connectedUser.username
          );

          this.$emit("chatroom-exited", this.chatroom._id);
        }

        this.closeExitModal();
      } catch (error) {
        console.error("Failed to exit chatroom:", error);
        alert("Failed to exit the chatroom. Please try again."); // Optional error alert
      }
    },
    handleChosenChatroom(chatRoomId) {
      this.$emit("chatroom-selected", chatRoomId);
    },
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
  watch: {
    chatroom: {
      immediate: true,
      handler() {},
      deep: true,
    },
  },
};
</script>

<style scoped>
.chatroom-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  width: 380px;
  height: 100vh;
  background: #fff;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  padding: 20px;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
}

.details {
  margin-bottom: 10%;
  border-bottom: 1px solid rgb(155, 154, 154);
}

.sidebar-chatroom-image {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  margin-bottom: 10px;
  object-fit: cover; /* Ensure the image scales properly without distortion */
}

.permissions-details {
  padding: 3%;
  cursor: pointer;
  border-bottom: 1px solid rgb(223, 223, 223);
}

.user-details:hover {
  background-color: #e6e5e5;
}

.participant-image {
  width: 60px; /* Updated size for participant images */
  height: 60px;
  border-radius: 50%; /* Make the image circular */
  object-fit: cover; /* Prevent distortion of the image */
  margin-right: 10px; /* Add spacing between the image and text */
}

.sidebar-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-content li {
  display: flex;
  align-items: center;
  margin-bottom: 15px; /* Space between participants */
}

.sidebar-content h4 {
  margin: 10px 0;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
}

.sidebar-content p {
  font-size: 14px;
  color: #666;
  text-align: center;
  margin: 5px 0;
}

#delete-chat {
  bottom: 0px;
  font-size: 120%;
}

#delete-chat-icon {
  margin-right: 10px;
  color: #b81010;
}

#permissions-icon {
  margin-right: 7px;
  color: #3997d6;
}

#delete-chat {
  border-bottom: 1px solid rgb(223, 223, 223);
}



.user-details {
  padding: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column; /* Arrange items in a row */
  align-items: center; /* Vertically align items */
  justify-content: flex-start; /* Align items to the left */
  transition: background-color 0.3s;
  gap: 10px; /* Add spacing between child elements */
}

.participant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%; /* Ensure it spans the width for the accordion icon alignment */
}

.accordion-icon {
  margin-left: auto;
  font-size: 16px;
}

.accordion-content {
  padding: 10px 15px;
  background-color: #f9f9f9;
  border-radius: 5px;
  margin-top: 5px;
  width: 100%;
  transition: max-height 0.3s ease, opacity 0.3s ease;
}

.accordion-option {
  cursor: pointer;
  margin: 5px 0;
  color: #007bff;
  font-weight: 500;
  transition: color 0.2s ease;
}

.accordion-option:hover {
  color: #0056b3;
}

.admin-mark {
  margin-right: auto;
  color: rgb(48, 138, 48);
  background-color: #8cf394;
  font-size: smaller;
  font-weight: 500;
  border-radius: 5%;
  padding: 3px 6px;
}
</style>
