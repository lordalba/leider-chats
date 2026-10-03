<template>
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="selectTab(tab)"
      >
        {{ tab }}
      </button>
    </div>
  </template>
  
  <script>
  export default {
    name: "TabsComponent",
    props: {
      tabs: Array,
    },
    data() {
      return {
        activeTab: this.tabs[0],
      };
    },
    methods: {
      selectTab(tab) {
        this.activeTab = tab;
        this.$emit("change-tab", tab);
      },
    },
  };
  </script>
  
  <style scoped>
  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  .tabs button {
    padding: 10px 15px;
    border: none;
    background: #f5f5f5;
    cursor: pointer;
  }
  .tabs button.active {
    background-color: #007bff;
    color: white;
  }
  </style>
  