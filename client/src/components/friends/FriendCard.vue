<template>
  <article class="friend-card" :class="{ expanded }">
    <div class="summary">
      <button class="picture-button" :title="`View ${user.username}'s picture`" @click="showPicture = true">
        <img v-avatar :src="user.profilePictureUrl" :alt="`${user.username}'s profile picture`" class="picture" />
      </button>

      <button class="info" :aria-expanded="expanded ? 'true' : 'false'" @click="expanded = !expanded">
        <span class="name">{{ user.username }}</span>
        <span class="status">
          <span class="status-dot" :class="user.isOnline ? 'online' : 'offline'"></span>
          {{ user.isOnline ? "Online" : "Offline" }}
        </span>
        <span v-if="user.profession" class="profession">{{ user.profession }}</span>
        <span class="toggle-hint">
          {{ expanded ? "Hide details" : "Show details" }}
          <i :class="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
        </span>
      </button>

      <button class="remove" :disabled="removing" @click="confirmRemove">
        Remove <i class="fa-solid fa-user-minus"></i>
      </button>
    </div>

    <div v-if="expanded" class="details">
      <p class="about">{{ user.aboutMe || `${user.username} hasn't written a description yet.` }}</p>
      <p class="facts">
        <span v-if="user.age"><i class="fa-solid fa-cake-candles"></i> {{ user.age }}</span>
        <span v-if="user.location"><i class="fa-solid fa-location-dot"></i> {{ user.location }}</span>
        <span v-if="user.profession"><i class="fa-solid fa-briefcase"></i> {{ user.profession }}</span>
      </p>
      <div v-if="user.skills && user.skills.length" class="tags">
        <span v-for="skill in user.skills" :key="skill" class="tag">{{ skill }}</span>
      </div>
    </div>

    <ImageLightbox
      :src="showPicture ? user.profilePictureUrl || defaultAvatar : ''"
      :alt="`${user.username}'s profile picture`"
      :caption="user.username"
      @close="showPicture = false"
    />
  </article>
</template>

<script>
import Swal from "sweetalert2";
import { removeFriend } from "@/api/UserService";
import ImageLightbox from "@/components/common/ImageLightbox.vue";
import { DEFAULT_AVATAR } from "@/utils/avatar";

export default {
  name: "FriendCard",
  components: { ImageLightbox },
  props: {
    user: { type: Object, required: true },
  },
  data() {
    return { expanded: false, showPicture: false, removing: false, defaultAvatar: DEFAULT_AVATAR };
  },
  methods: {
    async confirmRemove() {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: `Remove ${this.user.username}?`,
        text: "You will no longer be friends. Your chats stay as they are.",
        showCancelButton: true,
        confirmButtonText: "Remove",
        confirmButtonColor: "#d33",
      });
      if (!isConfirmed) return;
      this.removing = true;
      try {
        await removeFriend(this.user._id);
        this.$emit("removed", this.user._id);
      } catch (error) {
        this.$toast.error("Couldn't remove this friend. Please try again.");
      } finally {
        this.removing = false;
      }
    },
  },
};
</script>

<style scoped>
.friend-card {
  background: var(--surface);
  border-radius: 12px;
  border-left: 6px solid var(--accent);
  box-shadow: var(--shadow);
  padding: 14px 18px;
  transition: box-shadow 0.2s;
}
.friend-card.expanded {
  box-shadow: var(--shadow-strong);
}
.summary {
  display: flex;
  align-items: center;
  gap: 16px;
}
.picture-button {
  border: none;
  background: none;
  padding: 0;
  cursor: zoom-in;
  flex-shrink: 0;
}
.picture {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  color: inherit;
  cursor: pointer;
}
.name {
  font-size: 1.2em;
  font-weight: 600;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9em;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-dot.online {
  background-color: #22c55e;
}
.status-dot.offline {
  background-color: #9ca3af;
}
.profession {
  color: var(--text-muted);
  font-size: 0.9em;
}
.toggle-hint {
  margin-top: 4px;
  font-size: 0.8em;
  color: var(--accent);
}
.remove {
  flex-shrink: 0;
  background: transparent;
  color: #c43c3c;
  border: 1px solid #c43c3c;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}
.remove:hover {
  background: #c43c3c;
  color: #fff;
}
.details {
  margin: 14px 0 2px 80px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.about {
  white-space: pre-wrap;
  margin: 0 0 10px;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: var(--text-muted);
  margin: 0 0 10px;
}
.facts i {
  margin-right: 4px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  background-color: #9bb2ff;
  color: #fff;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.85em;
}
</style>
