<template>
  <div class="user-card">
    <div class="profile-section">
      <img
        :src="user.profilePictureUrl"
        alt="Profile picture"
        class="profile-pic"
      />
      <div class="user-info">
        <h2>{{ user.username }}</h2>
        <div class="status-section">
          <span
            class="status-dot"
            :class="{ online: user.isOnline, offline: !user.isOnline }"
          ></span>
          <span class="status-text">{{
            user.isOnline ? "Online" : "Offline"
          }}</span>
        </div>
        <p class="profession">{{ user.profession }}</p>
      </div>
      <div class="details-section">
        <button class="visit-website">
          Remove Friend <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>

    <!-- Single tags container -->
    <div class="tags">
      <span class="tag" v-for="skill in user.skills" :key="skill.id">{{
        skill
      }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: "userCard",
  props: {
    user: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {};
  },
  async created() {},
  computed: {},
  methods: {
  },
  watch: {
    user: {
      handler(newVal) {
        console.log("Friend status changed:", newVal);
      },
      deep: true,
    },
  },
};
</script>

<style scoped>
.user-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 900px; /* Wider */
  padding: 10px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-left: 8px solid;
  margin-top: 1%;
  border-left: 8px solid #74aa6d;
}

.online-indicator {
  width: 10px;
  height: 10px;
  background-color: green;
  border-radius: 50%;
  position: absolute;
  top: 5px;
  right: 5px;
}

.profile-section {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Align content horizontally */
  width: 100%;
}

.profile-pic {
  width: 70px; /* Slightly smaller */
  height: 70px;
  border-radius: 50%;
  margin-right: 20px;
}

.user-info {
  flex-grow: 1;
}

.user-info h2 {
  font-size: 1.2em;
  margin: 0;
}

.user-info p {
  margin: 2px 0;
}

.profession {
  color: #888;
}

.languages,
.timezone {
  font-size: 0.9em;
  color: #666;
}

.status-section {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.online {
  background-color: #00ff00; /* Green for online */
}

.offline {
  background-color: #888888; /* Gray for offline */
}

.details-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.rate {
  font-size: 1.1em;
  font-weight: bold;
}

.visit-website {
  background-color: #c43c3c;
  color: rgb(0, 0, 0);
  padding: 7px 15px; /* More compact */
  border-radius: 5px;
  text-decoration: none;
  margin-top: 15px;
  margin-right: 15px;
}

.tags {
  display: flex;
  justify-content: flex-start;
  margin-top: 10px;
}

.tag {
  background-color: #9bb2ff;
  color: #fff;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.85em;
  margin-right: 5px; /* Small gap between tags */
}
</style>
