<template>
    <div class="testimonial">
      <p class="quote">
        "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur."
      </p>
      <p class="testimonial-by">
        Testimonial by<br><span>Cynthia Summer</span>
      </p>
    </div>
  </template>
  
  <script>
  export default {
    name: 'TestimonialComponent',
  };
  </script>
  
  <style scoped>
  .testimonial {
    background-color: #f4f4f4;
    padding: 20px;
    border-radius: 8px;
  }
  
  .quote {
    font-style: italic;
    font-size: 16px;
  }
  
  .testimonial-by {
    margin-top: 20px;
    font-size: 14px;
    text-transform: uppercase;
  }
  
  .testimonial-by span {
    font-weight: bold;
  }
  </style>
  