<template>
  <div class="presence">
    <button
      :id="targetId"
      type="button"
      class="presence-trigger"
      :aria-label="`${label}. Show who is here`"
    >
      <span v-if="others.length" class="presence-avatars" aria-hidden="true">
        <UserAvatar
          v-for="member in shown"
          :key="member.userId"
          class="presence-avatar"
          :username="member.username"
          :userId="String(member.userId)"
          :src="member.profilePictureUrl || ''"
          :size="28"
        />
        <span v-if="extra" class="presence-more">+{{ extra }}</span>
      </span>
      <span class="presence-label">{{ label }}</span>
    </button>
    <b-popover
      :target="targetId"
      triggers="click blur"
      placement="bottomleft"
      custom-class="ws-scope presence-popover"
    >
      <p v-if="!others.length" class="presence-empty">
        Nobody else has this workspace open right now.
      </p>
      <ul v-else class="presence-list">
        <li v-for="member in others" :key="member.userId">
          <UserAvatar
            :username="member.username"
            :userId="String(member.userId)"
            :src="member.profilePictureUrl || ''"
            :size="24"
          />
          <span class="presence-name">{{ member.username }}</span>
          <span class="presence-focus">{{ focusText(member) }}</span>
        </li>
      </ul>
    </b-popover>
  </div>
</template>

<script>
import UserAvatar from "@/components/workspaces/UserAvatar.vue";
import { othersHere, presenceLabel, focusLabel } from "@/workspaces/presence";

const MAX_AVATARS = 4;

export default {
  name: "PresenceBar",
  components: { UserAvatar },
  props: {
    members: {
      type: Array,
      default: () => [],
    },
    meId: {
      type: String,
      default: null,
    },
    // Workspace detail, to name what each person has open.
    detail: {
      type: Object,
      default: null,
    },
  },
  computed: {
    targetId() {
      return `presence-${this._uid}`;
    },
    others() {
      return othersHere(this.members, this.meId);
    },
    shown() {
      return this.others.slice(0, MAX_AVATARS);
    },
    extra() {
      return Math.max(0, this.others.length - MAX_AVATARS);
    },
    label() {
      return presenceLabel(this.others);
    },
  },
  methods: {
    focusText(member) {
      return focusLabel(member, this.detail) || "In this workspace";
    },
  },
};
</script>

<style scoped>
.presence-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--ws-space-2);
  padding: var(--ws-space-1) var(--ws-space-2);
  border: 1px solid transparent;
  border-radius: 999px;
  background: none;
  color: var(--ws-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
}
.presence-trigger:hover {
  border-color: var(--ws-border);
  background: var(--ws-surface);
}
.presence-trigger:focus-visible {
  outline: none;
  box-shadow: var(--ws-focus);
}
.presence-avatars {
  display: inline-flex;
  align-items: center;
}
.presence-avatar + .presence-avatar {
  margin-left: -8px;
}
.presence-more {
  margin-left: 4px;
  font-weight: 600;
  color: var(--ws-text);
}
.presence-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
}
.presence-list li {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: var(--ws-space-2);
  align-items: center;
  padding: var(--ws-space-1) 0;
}
.presence-list li > :first-child {
  grid-row: span 2;
}
.presence-name {
  font-weight: 600;
}
.presence-focus,
.presence-empty {
  color: var(--ws-text-muted);
  font-size: 0.85em;
  margin: 0;
}

@media (max-width: 767.98px) {
  .presence-label {
    display: none;
  }
}
</style>
