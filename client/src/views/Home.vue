<template>
  <section class="hero">
    <div class="text-content">
      <h1>In Leider chats We Create</h1>
      <p>A better, more approachable platform to edit your music with people you like. We invite you to explore all our site abilities.</p>
      <button class="learn-more">Learn More</button>
    </div>
    <div class="image-content">
      <img src="../assets/music-homepage.png" alt="Minimalist Chair"/>
    </div>
  </section>
</template>

<script>
export default {
  name: "HomePage",
};
</script>

<style scoped>
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30px;
  margin-left: 20%;
}
.text-content {
  max-width: 50%;
}
.text-content h1 {
  font-size: 48px;
  font-weight: bold;
}
.text-content p {
  font-size: 18px;
  color: #555;
  margin: 20px 0;
}
.learn-more {
  padding: 15px 30px;
  font-size: 100%;
  background-color: #000;
  border-radius: 35px;
  color: #fff;
  border: none;
  cursor: pointer;
}
.image-content img {
  max-width: 70%;
  height: auto;
}
</style>
