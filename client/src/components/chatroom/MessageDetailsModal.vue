<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <i
        class="fa-solid fa-xmark close-icon"
        @click="closeModal"
      ></i>

      <div class="slides">
        <div class="slide">
          <h3>Message Details</h3>
          <div class="member-selection">
            <MessageItem
              :message="message"
              :isOwnMessage="true"
              :onPropetriesMode="true"
            />
          </div>
          <br />
          Seen by:
          <div class="seen-by-list">
            <label class="seenby-unit"
              v-for="(user, index) in filteredSeenBy"
              :key="user._id + '-' + index"
            >
              <div v-if="user._id != $store.state.connectedUser._id">
                <img
                  :src="user.profilePictureUrl"
                  alt="Profile Picture"
                  class="profile-picture"
                />
                {{ user.username }}
              </div>
            </label>
            <label v-if="filteredSeenBy.length === 0" style="opacity: 0.4"
              >Seen by None.. :(</label
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



<script>
/* eslint-disable */
export default {
  name: "MessageDetailsModal",
  components: {
    MessageItem: () => import("./MessageItem.vue"),
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
    message: {
      type: Object,
      required: true,
    },
  },
  methods: {
    closeModal() {
      this.$emit("close");
    },
  },
  computed: {
    filteredSeenBy() {
      return this.message.seenBy.filter(
        (user) => user._id !== this.$store.state.connectedUser._id
      );
    },
  },
  watch: {
    message: {
      immediate: true,
      handler() {
      },
    },
  },
};
</script>


<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000; /* Ensure it stays above other elements */
}

.modal-content {
  position: relative;
  width: 80%;
  max-width: 600px;
  padding: 20px;
  background: white;
  overflow: hidden;
  border-radius: 10px;
}

.close-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 24px;
  cursor: pointer;
}

.seen-by-list {
  overflow-y: auto;
  max-height: 100px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  display: block;
  margin: 5px 0;
  padding: 8px;
  border: 2px solid rgb(204, 204, 204);
  border-radius: 45px;
  font-size: 16px;
}

.seenby-unit {
  margin-right: 2%;
}

.profile-picture {
  width: 30px; /* Adjust size */
  height: 30px; /* Adjust size */
  border: 1px solid #555;
  border-radius: 50%; /* Circular picture */
  margin: 2px; /* Center the picture and pull it up */
  object-fit: cover; /* Ensure the picture covers the area */
}
</style>
