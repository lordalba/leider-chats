<template>
    <div class="description">
      <p class="intro">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ut labore et dolore magna aliqua.
      </p>
      <p>
        Laboris nisi ut aliquip ex ea commodo consequat. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.
      </p>
      
      <div class="social-links">
        <h4>Follow Us</h4>
        <ul>
          <li><a href="#">Instagram</a></li>
          <li><a href="#">YouTube</a></li>
        </ul>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'ContentDescription',
  };
  </script>
  
  <style scoped>
  .intro {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 10px;
  }
  
  .social-links h4 {
    margin-top: 20px;
    font-size: 18px;
  }
  
  .social-links ul {
    list-style-type: none;
    margin-top: 10px;
  }
  
  .social-links li {
    margin-bottom: 8px;
  }
  
  .social-links a {
    color: #333;
    text-decoration: none;
  }
  
  .social-links a:hover {
    text-decoration: underline;
  }
  </style>
  