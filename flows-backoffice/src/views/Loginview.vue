<template>
  <main class="auth-bg">
    <div class="card">
      <h1 class="title">Login</h1>

      <form @submit.prevent="goHome">
        <div class="form-group">
          <label class="label">Username</label>
          <input
            v-model.trim="form.username"
            type="text"
            placeholder="Enter username"
            required
            class="input"
          />
        </div>

        <div class="form-group">
          <label class="label">Password</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="Password"
            required
            class="input"
          />
        </div>

        <button class="btn">Sign in</button>
      </form>
    </div>
  </main>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'

const form = reactive({ username: '', password: '' })
const router = useRouter()
function goHome() { router.push('/index') } // autenticazione fittizia
</script>

<style scoped>
/* Background scuro e centratura */
.auth-bg {
  min-height: 100vh;
  background: #2f3337;            /* grigio scuro come nello screenshot */
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

/* Card bianca */
.card {
  width: 100%;
  max-width: 360px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
  padding: 22px 20px;
}

/* Titolo */
.title {
  margin: 0 0 14px 0;
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  color: #111827;
}

/* Gruppi form */
.form-group { margin-bottom: 14px; }
.label {
  display: block;
  font-size: 0.92rem;
  color: #111827;
  margin-bottom: 6px;
}

/* Input */
.input {
  width: 100%;
  height: 40px;
  padding: 8px 12px;
  font-size: 14px;
  color: #111827;
  background: #fff;
  border: 1px solid #ced4da;      /* look stile bootstrap-like */
  border-radius: 8px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.input::placeholder { color: #9aa0a6; }
.input:focus {
  border-color: #0d6efd;          /* blu del bottone */
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
}

/* Bottone */
.btn {
  width: 100%;
  height: 42px;
  margin-top: 6px;
  border: 1px solid #0d6efd;
  background: #0d6efd;
  color: #fff;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color .15s, border-color .15s;
}
.btn:hover {
  background: #0b5ed7;
  border-color: #0a58ca;
}
</style>
