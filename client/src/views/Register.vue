<template>
  <div class="register-page">
    
    <div class="form-container">
      <div class="form-content">
        <p class="start-text">START FOR FREE</p>
        <h1>Create new account<span class="highlight">.</span></h1>
        <p class="login-text">
          Already a Member?
          <router-link to="/login" class="login-link">Log In</router-link>
        </p>

        <form @submit.prevent="register">
          <div class="input-group">
            <input
              type="text"
              placeholder="Username"
              v-model="username"
              class="input-field"
              required
            />
          </div>
          <input
            type="email"
            placeholder="Email"
            v-model="email"
            class="input-field"
            required
          />
          <input
            type="text"
            placeholder="Age"
            v-model="age"
            class="input-field"
            required
          />
          <input
            type="text"
            placeholder="What do you do for a living?"
            v-model="profession"
            class="input-field"
          />
          <input
            type="text"
            placeholder="Where do you live?"
            v-model="location"
            class="input-field"
          />
          <div class="input-group password">
            <input
              type="password"
              placeholder="Password"
              v-model="password"
              class="input-field"
              required
            />
            <button type="button" class="show-password">
              <i class="fas fa-eye"></i>
            </button>
          </div>

          <!-- Buttons -->
          <div class="button-group">
            <button type="submit" class="submit-btn">Create account</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { registerUser } from "@/api/AuthService";
import Swal from "sweetalert2";

export default {
  name: "RegisterPage",
  data() {
    return {
      username: "",
      email: "",
      password: "",
      age: "",
      profession: "",
      location: "",
    };
  },
  methods: {
    async register() {
      if (!this.username || !this.email || !this.password || !this.age) {
        Swal.fire({
          icon: "warning",
          title: "Oops...",
          text: "All fields must be filled before creating an account.",
        });
        return;
      }

      try {
        const userData = {
          username: this.username,
          email: this.email,
          password: this.password,
          age: parseInt(this.age),
          profession: this.profession,
          location: this.location,
        };

        await registerUser(userData);

        Swal.fire({
          icon: "success",
          title: "Good job!",
          text: "Account created successfully!",
        });

        this.$router.push("/login");
      } catch (error) {
        alert(error.message);
      }
    },
  },
};
</script>

<!-- Styling -->
<style scoped>
.register-page {
  display: flex;

}

.background {
  flex: 1;
  position: relative;
  background-size: cover;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
}

.form-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px;
}

.form-content {
  padding: 40px;
  border-radius: 10px;
  width: 100%;
  max-width: 600px;
  text-align: center;
  color: #333;
}

.start-text {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 10px;
}

h1 {
  font-size: 2rem;
  margin-bottom: 10px;
}

h1 .highlight {
  color: #1a5f2d;
}

.login-text {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 20px;
}

.login-link {
  color: #5daa73;
  text-decoration: none;
}

.input-group {
  position: relative;
  margin-bottom: 15px;
}

.input-field {
  width: 100%;
  padding: 12px;
  border-radius: 5px;
  border: 1px solid #ddd;
  background-color: #fafafa;
  color: #333;
}

.password .show-password {
  position: absolute;
  right: 10px;
  top: 10px;
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
}

.button-group {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.submit-btn {
  width: 100%;
  padding: 15px;
  border-radius: 5px;
  border: none;
  background-color: #298b3a;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}

.submit-btn:hover {
  background-color: #30924c;
}
</style>
