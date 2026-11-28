<template>
  <div>
    <div class="about-container">
      <AboutTitle />
    </div>
    <div class="content-section">
      <ContentDescription />
      <Testimonial />
    </div>
  </div>
</template>

<script>
import AboutTitle from "../components/about/AboutTitle.vue";
import ContentDescription from "../components/about/ContentDescription.vue";
import Testimonial from "../components/about/Testimonial.vue";

export default {
  name: "AboutUs",
  components: {
    AboutTitle,
    ContentDescription,
    Testimonial,
  },
};
</script>

<style scoped>
.about-container {
  display: flex;
  align-items: center;
  padding: 20px;
  gap: 20px;
  background-color: #f9f9f9;
}

.content-section {
  display: flex;
  padding: 20px;
  gap: 40px;
  background-color: #ffffff;
}
</style>
