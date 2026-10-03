<template>
  <div class="login-container">
    <h2>Login</h2>
    <p>Hey, enter your details to log in to your account</p>

    <form @submit.prevent="handleLogin">
      <div class="input-group">
        <i class="fas fa-user"></i>
        <input
          type="text"
          placeholder="Enter your email"
          v-model="email"
          required
        />
      </div>

      <div class="input-group">
        <i class="fas fa-lock"></i>
        <input
          type="password"
          placeholder="Enter your password"
          v-model="password"
          required
        />
      </div>

      <button type="submit">Login In</button>
    </form>

    <p class="signup-text">
      Don’t have an account?
      <router-link to="/register">Signup Now</router-link>
    </p>
  </div>
</template>

<script>
import { loginUser } from "@/api/AuthService";
import { fetchUserData } from "@/api/PersonalService";
import Swal from "sweetalert2";
import { mapActions } from "vuex";
import store from "@/store/store";

export default {
  name: "logIn",
  data() {
    return {
      email: "",
      password: "",
    };
  },
  methods: {
    ...mapActions(["setConnectedUser"]),
    async handleLogin() {
      if (!this.email || !this.password) {
        // Show SweetAlert popup
        Swal.fire({
          icon: "warning",
          title: "Oops...",
          text: "All fields must be filled before creating an account.",
        });
        return; // Block form submission
      }

      try {
        const userData = {
          email: this.email,
          password: this.password,
        };

        const result = await loginUser(userData);
        localStorage.setItem("token", result.token); // Save the token in localStorage

        const connectedUser = await fetchUserData();
        store.dispatch("setConnectedUser", connectedUser.data);

        Swal.fire({
          icon: "success",
          title: "good job!",
          text: "Logged in successful!",
          footer:
            '<a href="shorturl.at/gwRUY">why is your mother in a pita?</a>',
        });

        this.$store.dispatch("socket/initializeSocket");

        this.$router.push("/"); // Navigate to login page
      } catch (error) {
        alert(error.message);
      }
    },
  },
};
</script>

<!-- Styling -->
<style scoped>
.login-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px;
  border-radius: 10px;
  text-align: center;
}
h2 {
  color: #1a5f2d;
  font-size: 52px;
  margin-bottom: 10px;
}
p {
  color: #666;
  margin-bottom: 30px;
}
.input-group {
  position: relative;
  margin-bottom: 20px;
}
.input-group i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #aaa;
}
input {
  width: 100%;
  padding: 10px 10px 10px 35px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
  outline: none;
}
button {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  color: #fff;
  background-color: #298b3a;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}
button:hover {
  background-color: #30924c;
}
.signup-text {
  margin-top: 20px;
  color: #666;
}
.signup-text a {
  color: #5daa73;
  text-decoration: none;
}
</style>
