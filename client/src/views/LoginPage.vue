<template>
  <div class="login-container">
    <h2>Login</h2>
    <p>Hey, enter your email and password to log in to your account</p>

    <form @submit.prevent="handleLogin">
      <div class="input-group">
        <i class="fas fa-envelope"></i>
        <input
          type="email"
          autocomplete="email"
          placeholder="Email (not your username)"
          v-model="email"
          required
        />
      </div>

      <div class="input-group">
        <i class="fas fa-lock"></i>
        <input
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          placeholder="Enter your password"
          v-model="password"
          class="password-input"
          required
        />
        <button
          type="button"
          class="show-password"
          :title="showPassword ? 'Hide password' : 'Show password'"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
        </button>
      </div>

      <button type="submit" :disabled="loggingIn">{{ loggingIn ? "Logging in…" : "Log In" }}</button>
    </form>

    <p class="signup-text">
      Don’t have an account?
      <router-link to="/register">Signup Now</router-link>
    </p>
  </div>
</template>

<script>
import { loginUser } from "@/api/AuthService";
import Swal from "sweetalert2";
import { startSession } from "@/auth/session";

export default {
  name: "logIn",
  data() {
    return {
      email: "",
      password: "",
      showPassword: false,
      loggingIn: false,
    };
  },
  mounted() {
    if (this.$route.query.expired) {
      this.$toast.warning("Your session expired. Please log in again.");
    }
  },
  methods: {
    async handleLogin() {
      if (!this.email || !this.password) {
        Swal.fire({
          icon: "warning",
          title: "Oops...",
          text: "Please enter your email and password.",
        });
        return;
      }

      this.loggingIn = true;
      try {
        const result = await loginUser({ email: this.email.trim(), password: this.password });
        const user = await startSession(result.token);
        this.$toast.success(`Welcome back, ${user.username}!`);

        // Back to the page they were trying to open, or the chatrooms.
        const redirect = this.$route.query.redirect;
        this.$router.push(typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/chatrooms");
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Couldn't log in",
          text:
            error.message === "Invalid credentials."
              ? "Wrong email or password. Remember to log in with your email, not your username."
              : error.message,
        });
      } finally {
        this.loggingIn = false;
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
  color: var(--text-muted);
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
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 16px;
  outline: none;
}
.password-input {
  padding-right: 40px;
}
/* Hide Edge's built-in reveal button; we have our own. */
.password-input::-ms-reveal,
.password-input::-ms-clear {
  display: none;
}
.input-group .show-password {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: auto;
  padding: 4px 6px;
  background: transparent;
  color: var(--text-muted);
}
.input-group .show-password:hover {
  background: transparent;
  color: var(--text-muted);
}
.input-group .show-password i {
  position: static;
  transform: none;
  color: inherit;
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
button:disabled {
  opacity: 0.7;
  cursor: default;
}
.signup-text {
  margin-top: 20px;
  color: var(--text-muted);
}
.signup-text a {
  color: #5daa73;
  text-decoration: none;
}
</style>
