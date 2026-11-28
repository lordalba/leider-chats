<template>
  <div class="login-container">
    <h2>Login</h2>
    <p>Hey, enter your details to log in to your account</p>

    <form @submit.prevent="handleLogin">
      <div class="input-group">
        <i class="fas fa-user"></i>
        <input
          type="text"
          placeholder="Username or email"
          aria-label="Username or email"
          v-model="identifier"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
        />
      </div>

      <div class="input-group">
        <i class="fas fa-lock"></i>
        <input
          :type="showPassword ? 'text' : 'password'"
          placeholder="Enter your password"
          aria-label="Password"
          v-model="password"
          autocomplete="current-password"
          required
        />
        <button
          type="button"
          class="show-password"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
        </button>
      </div>

      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? "Logging in..." : "Log In" }}
      </button>
    </form>

    <p class="signup-text">
      Don’t have an account?
      <router-link to="/register">Sign up now</router-link>
    </p>
  </div>
</template>

<script>
import { loginUser } from "@/api/AuthService";
import { fetchUserData } from "@/api/PersonalService";
import Swal from "sweetalert2";

export default {
  name: "logIn",
  data() {
    return {
      identifier: "",
      password: "",
      showPassword: false,
      loading: false,
    };
  },
  methods: {
    async handleLogin() {
      if (this.loading) return;
      const identifier = this.identifier.trim();
      if (!identifier || !this.password) {
        Swal.fire({
          icon: "warning",
          title: "Oops...",
          text: "Please enter your username or email and your password.",
        });
        return;
      }

      this.loading = true;
      try {
        const result = await loginUser({ identifier, password: this.password });
        localStorage.setItem("token", result.token);

        let connectedUser;
        try {
          connectedUser = await fetchUserData();
        } catch (error) {
          // Don't leave a token behind for a login that didn't finish.
          localStorage.removeItem("token");
          throw new Error("Logged in, but couldn't load your account. Please try again.");
        }
        this.$store.dispatch("setConnectedUser", connectedUser.data);

        this.$toast.success(`Welcome back, ${connectedUser.data.username}`);

        this.$store.dispatch("socket/initializeSocket");

        this.$router.push("/chatrooms");
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Login failed",
          text: error.message,
        });
      } finally {
        this.loading = false;
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
  color: var(--ink);
  font-size: 52px;
  margin-bottom: 10px;
}
p {
  color: var(--muted);
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
  color: var(--muted);
}
input {
  width: 100%;
  padding: 10px 40px 10px 35px;
  border: 1px solid var(--line);
  border-radius: 5px;
  font-size: 16px;
  outline: none;
}
.show-password {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 6px;
}
.show-password i {
  position: static;
  transform: none;
}
.submit-btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  color: var(--on-brand);
  background-color: var(--brand-strong);
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}
.submit-btn:hover:not(:disabled) {
  background-color: var(--brand-hover);
}
.submit-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
.signup-text {
  margin-top: 20px;
  color: var(--muted);
}
.signup-text a {
  color: var(--brand-text);
  text-decoration: none;
}
</style>
