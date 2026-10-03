<template>
  <div class="profile-container" v-if="user">
    <!-- Profile Header -->
    <div class="profile-header">
      <img
        v-if="!isEditing"
        :src="user.backgroundPictureUrl"
        alt="Profile Background"
        class="background-image"
      />
      <div class="profile-details">
        <!-- Edit Button -->
        <img
          v-if="!isEditing"
          :src="user.profilePictureUrl"
          alt="Profile Picture"
          class="profile-picture"
        />
        <div class="profile-info">
          <h1 v-if="!isEditing">{{ user.username }}</h1>
          <h5 v-if="!isEditing" style="opacity: 0.5">
            {{ user.age }} • {{ user.profession }} • {{ user.location }}
          </h5>
          <h1 v-else>Profile Edit Mode</h1>
          <input v-if="isEditing" v-model="user.username" class="edit-input" />
        </div>
      </div>
    </div>

    <!-- Skills Section -->
    <div v-if="!isEditing" class="skills">
      <div v-if="!user.skills">There are no musical skills added yet..</div>
      <span v-for="skill in user.skills" :key="skill" class="skill-tag">
        <div class="skill">{{ skill }}</div></span
      >
    </div>
    <div v-if="isEditing" class="skills">
      <span
        v-for="(skill, index) in user.skills"
        :key="skill"
        class="skill-tag"
      >
        <div
          class="skill"
          @mouseover="hoveringSkillIndex = index"
          @mouseleave="hoveringSkillIndex = null"
          @click="user.skills.splice(index, 1)"
          :class="{ skill_to_delete: hoveringSkillIndex === index }"
        >
          {{ hoveringSkillIndex === index ? "Delete Skill" : skill }}
        </div>
      </span>
      <input
        v-if="isEditing"
        v-model="skillToAdd"
        class="edit-input"
        placeholder="write a skill to add"
      />
      <button class="save-button" @click="addSkill()">Add skill</button>
    </div>

    <!-- About Me Section -->
    <div class="about-section">
      <h2>About Me</h2>
      <p v-if="!isEditing">
        {{
          !user.aboutMe
            ? "There is no Account desctiption now.. add one :)"
            : user.aboutMe
        }}
      </p>
      <textarea
        v-if="isEditing"
        v-model="user.aboutMe"
        class="edit-textarea"
      ></textarea>
    </div>

    <!-- Image Uploads -->
    <div v-if="isEditing" class="image-upload-section">
      <!-- <h3>Change Profile Picture</h3> -->
      <label for="file-upload" class="custom-file-upload">
        Update Profile Picture
      </label>
      <input
        type="file"
        id="file-upload"
        accept="image/*"
        placeholder="Change Profile Picture"
        @change="handleProfilePictureChange"
      />
    </div>
    <div class="ending-buttons-container">
    <button v-if="isEditing" @click="toggleEdit" class="save-button">
      cancel
    </button>
    <button v-if="isEditing" @click="saveProfile" class="save-button">
      Save
    </button>
  </div>
    <button v-if="!isEditing" @click="toggleEdit" class="edit-button">
          Edit Profile <i class="fa-regular fa-pen-to-square"></i>
        </button>
  </div>
</template>

<script>
import Swal from "sweetalert2";
import { updateProfile, fetchUserData } from "@/api/PersonalService";

export default {
  name: "profilePage",
  data() {
    return {
      hoveringSkillIndex: null,
      skillToAdd: null,
      user: null,
      showReadMore: true,
      isEditing: false,
      newProfilePicture: null,
      newBackgroundImage: null,
    };
  },
  async created() {
    await this.fetchUserData();
  },
  methods: {
    async fetchUserData() {
      try {
        const response = await fetchUserData();
        this.user = response.data;
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    },
    toggleEdit() {
      this.isEditing = !this.isEditing;
    },
    addSkill() {
      if (this.skillToAdd !== null) {
        this.user.skills.push(this.skillToAdd);
        this.skillToAdd = null;
      } else {
        Swal.fire({
          icon: "warning",
          title: "Oops...",
          text: "Make sure not to leave the skill input box empty..",
        });
      }
    },
    handleProfilePictureChange(event) {
      const file = event.currentTarget.files[0];
      this.newProfilePicture = file;
      this.user.profilePictureUrl = file.filename;
    },
    async saveProfile() {
      try {
        const formData = new FormData();
        formData.append("username", this.user.username);
        formData.append("aboutMe", this.user.aboutMe ? this.user.aboutMe : null);
        formData.append("skills", JSON.stringify(this.user.skills));
        formData.append("profilePicture", this.newProfilePicture);

        await updateProfile(formData); // Update API method to handle FormData

        this.toggleEdit();
        Swal.fire({
          icon: "success",
          title: "success",
          text: "Changes saved successfully!",
        });
      } catch (error) {
        console.error("Error while sending updated profile data: ", error);
      }
    },
  },
};
</script>

<style scoped>
input[type="file"] {
  display: none;
}

.custom-file-upload {
  border: 1px solid #ccc;
  color: white;
  background-color: #1e77d6;
  border-radius: 8px; /* Rounded corners */
  display: inline-block;
  padding: 6px 12px;
  cursor: pointer;
}

.custom-file-upload:hover {
  background-color: #3390f3;
  transform: scale(1.02);
}

.profile-container {
  max-width: 70%; /* Limit the maximum width of the profile */
  margin: 0 auto; /* Center the container */
  padding: 20px;
  background-color: #fff; /* White background for the profile section */
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); /* Subtle shadow for depth */
  border-radius: 8px; /* Rounded corners */
  text-align: center; /* Center text within the container */
}

.profile-header {
  position: relative; /* Allow positioning of elements */
}

.background-image {
  width: 100%; /* Make the background image responsive */
  height: 200px; /* Set a fixed height */
  object-fit: cover; /* Ensure the image covers the area */
  border-radius: 8px 8px 0 0; /* Rounded top corners */
}

.profile-picture {
  width: 100px; /* Adjust size */
  height: 100px; /* Adjust size */
  border: 2px solid #555;
  border-radius: 50%; /* Circular picture */
  margin: -50px auto 20px; /* Center the picture and pull it up */
  object-fit: cover; /* Ensure the picture covers the area */
}

h1,
h2,
h3 {
  color: #333; /* Dark text for readability */
  margin: 10px 0; /* Space out headings */
}

.skills {
  margin: 20px 0; /* Space out the skills section */
}

.skill-tag {
  display: inline-block;
}

.skill {
  background-color: #6e00ff;
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  margin: 5px;
}

.skill_to_delete {
  background-color: #b10311;
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  margin: 5px;
  cursor: pointer;
}

.about-section {
  text-align: left; /* Left-align text for the about section */
  margin: 20px 0; /* Space out the about section */
}

.edit-input,
.edit-textarea {
  width: 100%; /* Full width for inputs */
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.ending-buttons-container {
  justify-content: center;
  text-align: center;
  display: inline-box;
}

.edit-button {
  background-color: #0eb833; /* Default button color */
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px; /* Rounded corners */
  cursor: pointer;
  margin-top: 1%;
  margin-left: 87%;
}

.save-button {
  background-color: #0eb833; /* Default button color */
  margin-top: 5%;
  margin-right: 2%;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px; /* Rounded corners */
  cursor: pointer;
}

.edit-button:hover,
.save-button:hover {
  background-color: #27dd4f;
  transform: scale(1.02); /* Darker color on hover */
}

.image-upload-section {
  margin-top: 20px; /* Space above the image upload section */
}

.image-upload-section h3 {
  margin-bottom: 5px; /* Space below headings in upload section */
}
</style>
