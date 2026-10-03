<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <i
        class="fa-solid fa-xmark"
        @click="closeModal"
        style="position: fixed; top: 0; left: 0"
      ></i>
      <div
        class="slides"
        :style="{ transform: `translateX(-${currentSlide * 100}%)` }"
      >
        <!-- Slide 1: Select Members -->
        <div class="slide">
          <h3>Select Chatroom Members</h3>
          <div class="member-selection">
            <label v-for="friend in friends" :key="friend.id">
              <input
                type="checkbox"
                :value="friend._id"
                v-model="selectedFriends"
              />
              <img
                v-if="!isEditing"
                :src="friend.profilePictureUrl"
                alt="Profile Picture"
                class="profile-picture"
              />
              {{ friend.username }}
            </label>
          </div>
        </div>

        <!-- Slide 2: Set Chat Room Name and Image -->
        <div class="slide">
          <h3>Set Chat Room Details</h3>
          <div class="form-group">
            <label for="chatName">Chat Room Name:</label>
            <input
              type="text"
              v-model="chatName"
              id="chatName"
              placeholder="Enter chat room name"
            />
          </div>
          <div class="form-group">
            <label for="chatImage">Chat Room Image:</label>
            <input
              type="file"
              name="chatImage"
              @change="handleImageUpload"
              id="chatImage"
            />
          </div>
          <img
            v-if="previewImage"
            :src="previewImage"
            alt="Chat Room Preview"
            class="preview-image"
          />
        </div>
      </div>

      <div class="navigation-buttons">
        <button class="nav-button" v-if="currentSlide !== 0" @click="prevSlide">
          Previous
        </button>
        <button
          class="nav-button"
          id="next-btn"
          v-if="currentSlide < slides.length - 1 && selectedFriends.length > 0"
          @click="nextSlide"
        >
          Next
        </button>
        <button
          v-else-if="currentSlide == slides.length - 1"
          class="nav-button"
          id="next-btn"
          style="width: 200px"
          @click="createChatRoom"
        >
          Create Chat Room
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { createChatroom } from "@/api/ChatRoomService";
import store from "@/store/store";

export default {
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
    friends: {
      type: Array,
    },
  },
  data() {
    return {
      slides: [1, 2], // Just a placeholder to control the slide count
      currentSlide: 0,
      selectedFriends: [],
      chatName: "",
      chatImage: null,
      previewImage: null,
    };
  },
  methods: {
    closeModal() {
      this.$emit("close");
    },
    nextSlide() {
      if (this.currentSlide < this.slides.length - 1) {
        this.currentSlide += 1;
      }
    },
    prevSlide() {
      if (this.currentSlide > 0) {
        this.currentSlide -= 1;
      }
    },
    handleImageUpload(event) {
      const file = event.target.files[0];
      this.chatImage = file;

      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previewImage = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    },
    async createChatRoom() {
      this.selectedFriends.push(store.state.connectedUser._id);

      const formData = new FormData();
      formData.append("participants", JSON.stringify(this.selectedFriends));
      formData.append("name", this.chatName == "" ? null : this.chatName);
      formData.append("chatImage", this.chatImage);
      try {
        const response = await createChatroom(formData);
        const chat = response.data;
        if (this.socket) {
          this.socket.emit("createdChatroom", chat._id);
          this.restartCardData();

          this.closeModal();
          this.$toast.success(`A new chatroom has been created! 🎉`);
        }
      } catch (error) {
        console.error("Error while creating chatroom:", error);
      }
    },
    restartCardData() {
      this.currentSlide = 0;
      this.selectedFriends = [];
      this.chatName = "";
      this.chatImage = null;
      this.previewImage = null;
    },
  },
  computed: {
    socket() {
      return this.$store.getters["socket/socket"];
    },
  },
};
</script>

<style scoped>
/* Styling for the input box */
input[type="text"] {
  width: 100%;
  padding: 10px;
  border: 2px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

input[type="text"]:focus {
  border-color: #4a90e2;
  outline: none;
}

/* Styling for file input */
input[type="file"] {
  border: none;
  font-size: 16px;
  margin-top: 10px;
  background: none;
}

.form-group {
  margin-bottom: 15px;
}

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
}

.modal-content {
  position: relative;
  width: 80%;
  max-width: 600px;
  padding: 20px;
  background: white;
  overflow: hidden;
  border-radius: 45px;
}

.member-selection::-webkit-scrollbar {
  width: 8px;
}

.member-selection::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.member-selection::-webkit-scrollbar-thumb {
  background-color: #a3ceff;
  border-radius: 10px;
  border: 2px solid #f1f1f1;
}

.member-selection {
  scrollbar-width: thin;
  scrollbar-color: #82b7f3 #f1f1f1;
}

.slides {
  display: flex;
  transition: transform 0.5s ease;
}

.slide {
  flex: 0 0 100%;
  padding: 20px;
  box-sizing: border-box;
  text-align: center;
}
.member-selection {
  align-items: start;
  text-align: start;
  overflow-y: auto;
  max-height: 300px;
}
.member-selection label {
  display: block;
  margin: 5px 0;
  padding: 8px;
  border: 2px solid rgb(204, 204, 204);
  border-radius: 45px;
  font-size: 30px;
}

.profile-picture {
  width: 70px; /* Adjust size */
  height: 70px; /* Adjust size */
  border: 2px solid #555;
  border-radius: 50%; /* Circular picture */
  margin: 5px; /* Center the picture and pull it up */
  object-fit: cover; /* Ensure the picture covers the area */
}

.preview-image {
  margin-top: 10px;
  max-width: 100%;
  max-height: 150px;
}

.navigation-buttons {
  display: inline-block;
  align-items: center;
}

.nav-button {
  background-color: #fff;
  border: 1px solid #d5d9d9;
  border-radius: 8px;
  box-shadow: rgba(213, 217, 217, 0.5) 0 2px 5px 0;
  box-sizing: border-box;
  color: #0f1111;
  cursor: pointer;
  display: inline-block;
  font-family: "Amazon Ember", sans-serif;
  font-size: 13px;
  line-height: 29px;
  padding: 0 10px 0 11px;
  position: relative;
  text-align: center;
  text-decoration: none;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  vertical-align: middle;
  width: 100px;
  margin-right: 20px;
}

.nav-button:hover {
  background-color: #f7fafa;
}

.nav-button:focus {
  border-color: #008296;
  box-shadow: rgba(213, 217, 217, 0.5) 0 2px 5px 0;
  outline: 0;
}

#next-btn {
  background-color: #1874fc !important;
  color: white;
}
</style>
