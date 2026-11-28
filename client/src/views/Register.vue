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
              aria-label="Username"
              v-model="username"
              class="input-field"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              minlength="3"
              maxlength="30"
              required
            />
          </div>
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            v-model="email"
            class="input-field"
            autocomplete="email"
            required
          />
          <input
            type="number"
            placeholder="Age"
            aria-label="Age"
            v-model="age"
            class="input-field"
            min="1"
            max="120"
            step="1"
            required
          />
          <input
            type="text"
            placeholder="What do you do for a living? (optional)"
            aria-label="Profession (optional)"
            v-model="profession"
            class="input-field"
          />
          <input
            type="text"
            placeholder="Where do you live? (optional)"
            aria-label="Location (optional)"
            v-model="location"
            class="input-field"
          />
          <div class="input-group password">
            <input
              :type="showPassword ? 'text' : 'password'"
              placeholder="Password (at least 6 characters)"
              aria-label="Password"
              v-model="password"
              class="input-field"
              autocomplete="new-password"
              minlength="6"
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

          <!-- Buttons -->
          <div class="button-group">
            <button type="submit" class="submit-btn" :disabled="loading">
              {{ loading ? "Creating account..." : "Create account" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { registerUser } from "@/api/AuthService";
import Swal from "sweetalert2";

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;

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
      showPassword: false,
      loading: false,
    };
  },
  methods: {
    warn(text) {
      Swal.fire({ icon: "warning", title: "Oops...", text });
    },
    // Mirrors the server's rules so most mistakes are caught before a request.
    validationError() {
      const username = this.username.trim();
      const age = Number(this.age);
      if (!username || !this.email.trim() || !this.password || this.age === "") {
        return "Please fill in username, email, age and password.";
      }
      if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
        return `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters long.`;
      }
      if (username.includes("@")) return `Username can't contain "@".`;
      if (this.password.length < PASSWORD_MIN) {
        return `Password must be at least ${PASSWORD_MIN} characters long.`;
      }
      if (!Number.isInteger(age) || age < 1 || age > 120) {
        return "Please enter a valid age.";
      }
      return null;
    },
    async register() {
      if (this.loading) return;
      const problem = this.validationError();
      if (problem) {
        this.warn(problem);
        return;
      }

      this.loading = true;
      try {
        await registerUser({
          username: this.username.trim(),
          email: this.email.trim(),
          password: this.password,
          age: Number(this.age),
          profession: this.profession.trim(),
          location: this.location.trim(),
        });

        Swal.fire({
          icon: "success",
          title: "Good job!",
          text: "Account created successfully! You can log in with your username or email.",
        });

        this.$router.push("/login");
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Couldn't create account",
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
  background: rgba(26, 18, 13, 0.75);
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
  color: var(--ink);
}

.start-text {
  font-size: 0.9rem;
  color: var(--muted);
  margin-bottom: 10px;
}

h1 {
  font-size: 2rem;
  margin-bottom: 10px;
}

h1 .highlight {
  color: var(--ink);
}

.login-text {
  font-size: 0.9rem;
  color: var(--muted);
  margin-bottom: 20px;
}

.login-link {
  color: var(--brand-text);
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
  border: 1px solid var(--line);
  background-color: var(--surface);
  color: var(--ink);
}

.password .input-field {
  padding-right: 40px;
}

.password .show-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--muted);
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
  background-color: var(--brand-strong);
  color: white;
  font-size: 1rem;
  cursor: pointer;
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--brand-hover);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
</style>
