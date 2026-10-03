<template>
  <div>
    <div class="about-container">
      <AboutTitle />
      <ProfileImage />
    </div>
    <div class="content-section">
      <ContentDescription />
      <Testimonial />
    </div>
  </div>
</template>

<script>
import AboutTitle from "../components/about/AboutTitle.vue";
import ProfileImage from "../components/about/ProfileImage.vue";
import ContentDescription from "../components/about/ContentDescription.vue";
import Testimonial from "../components/about/Testimonial.vue";

export default {
  name: "AboutUs",
  components: {
    AboutTitle,
    ProfileImage,
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
