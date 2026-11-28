<template>
  <div class="assignee-picker">
    <div class="picker-tools">
      <input
        v-if="participants.length > FILTER_FROM"
        v-model="query"
        type="search"
        class="form-control form-control-sm picker-filter"
        placeholder="Filter people"
        aria-label="Filter people"
      />
      <button
        v-if="meId && isParticipant(meId) && !selected.has(meId)"
        type="button"
        class="btn btn-link btn-sm picker-me"
        @click="toggle(meId)"
      >
        Assign to me
      </button>
    </div>
    <div class="picker-list" role="group" :aria-label="label">
      <button
        v-for="person in visible"
        :key="person.id"
        type="button"
        role="checkbox"
        class="picker-chip"
        :class="{ selected: selected.has(person.id) }"
        :aria-checked="selected.has(person.id) ? 'true' : 'false'"
        @click="toggle(person.id)"
      >
        <UserAvatar
          :username="person.username"
          :userId="person.id"
          :src="person.profilePictureUrl || ''"
          :size="24"
        />
        <span class="picker-name">{{ person.username }}{{ person.id === meId ? " (you)" : "" }}</span>
        <i v-if="selected.has(person.id)" class="fa-solid fa-check" aria-hidden="true"></i>
      </button>
      <p v-if="!visible.length" class="picker-empty">No one matches “{{ query.trim() }}”.</p>
    </div>
  </div>
</template>

<script>
import UserAvatar from "@/components/workspaces/UserAvatar.vue";

// Show the filter box once the list is long enough to need it.
const FILTER_FROM = 8;

// Toggle chips for choosing assignees. v-model: array of user id strings.
export default {
  name: "AssigneePicker",
  components: { UserAvatar },
  props: {
    participants: { type: Array, default: () => [] },
    value: { type: Array, default: () => [] },
    meId: { type: String, default: null },
    label: { type: String, default: "Assignees" },
  },
  data() {
    return { query: "", FILTER_FROM };
  },
  computed: {
    selected() {
      return new Set(this.value.map(String));
    },
    people() {
      // Me first, then everyone else by name.
      return this.participants
        .map((p) => ({ ...p, id: String(p._id) }))
        .sort((a, b) =>
          a.id === this.meId
            ? -1
            : b.id === this.meId
            ? 1
            : String(a.username).localeCompare(String(b.username), undefined, { sensitivity: "base" })
        );
    },
    visible() {
      const needle = this.query.trim().toLowerCase();
      if (!needle) return this.people;
      return this.people.filter(
        (p) => this.selected.has(p.id) || String(p.username).toLowerCase().includes(needle)
      );
    },
  },
  methods: {
    isParticipant(id) {
      return this.people.some((p) => p.id === id);
    },
    toggle(id) {
      const next = this.selected.has(id)
        ? this.value.filter((v) => String(v) !== id)
        : [...this.value, id];
      this.$emit("input", next);
    },
  },
};
</script>

<style scoped>
.picker-tools {
  display: flex;
  align-items: center;
  gap: var(--ws-space-2);
  margin-bottom: var(--ws-space-2);
}
.picker-tools:empty {
  display: none;
}
.picker-filter {
  flex: 1;
}
.picker-me {
  padding: 0;
  margin-left: auto;
  white-space: nowrap;
}
.picker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
  padding: 2px;
}
.picker-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 3px;
  border: 1px solid var(--ws-border);
  border-radius: 999px;
  background: var(--ws-surface);
  color: var(--ws-text);
  font-size: 14px;
  cursor: pointer;
}
.picker-chip:hover {
  border-color: var(--ws-accent);
}
.picker-chip.selected {
  background: var(--ws-accent-soft);
  border-color: var(--ws-accent);
  color: var(--ws-accent-strong);
  font-weight: 500;
}
.picker-chip .fa-check {
  font-size: 11px;
}
.picker-name {
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.picker-empty {
  margin: 0;
  color: var(--ws-text-muted);
  font-size: 14px;
}
</style>
