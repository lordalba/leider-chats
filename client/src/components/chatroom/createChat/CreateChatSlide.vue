<template>
  <div class="slide">
    <p>{{ title }}</p>
  </div>
</template>

<script>
/* eslint-disable */
export default {
  components: {},
  props: {
    title: {
      type: Array,
      Required: true,
    },
  },
  data() {
    return {
      showModal: false,
    };
  },
  created() {},
  computed: {},
  methods: {},
};
</script>

<style scoped></style>
