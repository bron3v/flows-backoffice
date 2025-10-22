<template>
  <main class="auth-shell">
    <section class="flows-card">
      <div class="brand">
        <h2 id="brand-name">FLOWS BACKOFFICE</h2>
      </div>

      <div class="login-card">
        <h1 class="title">Login</h1>

        <form @submit.prevent="doLogin">
          <div class="form-group">
            <input
              v-model.trim="usernameOrEmail"
              type="text"
              placeholder="Username o e-mail"
              required
              class="input"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <input
              v-model="password"
              type="password"
              placeholder="Password"
              required
              class="input"
              autocomplete="current-password"
            />
          </div>

          <div>
            <button class="btn" :disabled="loading">
              {{ loading ? 'Accesso…' : 'Login' }}
            </button>
          </div>

          <p v-if="error" style="margin-top:10px;color:#b00020">{{ error }}</p>
        </form>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/utils/api'
import { markLoggedIn } from '@/router'

const usernameOrEmail = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const router = useRouter()
const route = useRoute()

function sanitizeRedirect(q) {
  if (typeof q !== 'string' || !q) return '/app'
  if (q.startsWith('http://') || q.startsWith('https://')) return '/app'
  return q
}

async function doLogin() {
  error.value = ''
  const user = usernameOrEmail.value.trim()
  const pass = password.value

  if (!user || !pass) {
    error.value = 'Inserisci username (o e-mail) e password'
    return
  }

  // reset eventuale ruolo vecchio
  try { sessionStorage.removeItem('flows_role') } catch {}

  loading.value = true
  try {
    // 1) login
    const res = await api.login(user, pass) // POST /auth/login
    if (!(res?.ok)) {
      error.value = 'Credenziali errate'
      return
    }

    // 2) leggi ruolo SOLAMENTE da /me (fonte autoritativa)
    let me
    try { me = await api.me() } catch {}
    const role = String(
      me?.role ?? me?.user?.role ?? res?.user?.role ?? ''
    ).toLowerCase()

    // 3) blocca ruolo "user" o ruolo mancante
    if (!role || role === 'user') {
      error.value = 'Accesso negato: il tuo ruolo non consente l’accesso al backoffice. Contatta un amministratore.'
      try { await api.logout?.() } catch {}
      return
    }

    // 4) ok: salva stato e vai
    markLoggedIn()
    try { sessionStorage.setItem('flows_role', role) } catch {}
    router.replace(sanitizeRedirect(route.query.redirect))
  } catch {
    error.value = 'Errore di connessione'
  } finally {
    loading.value = false
  }
}


</script>



<style scoped>
/* Sfondo esterno */
.auth-shell {
  min-height: 100vh;
  background: #bfc5c8;
  display: grid;
  place-items: center;
  padding: 18px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

.flows-card {
  width: min(850px, 96vw);
  min-height: 600px;
  background: #17aba2;
  border-radius: 28px;
  box-shadow: 0 12px 30px rgba(0,0,0,.18);
  position: relative;
  padding: 40px 28px 28px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  align-content: start;
}

.brand { width: 100%; text-align: center; margin: 6px 0 24px; }
#brand-name {
  margin: 0;
  font-size: clamp(28px, 6vw, 64px);
  font-weight: 800;
  letter-spacing: .5px;
  color: #ececef;
}

.login-card {
  width: min(380px, 90vw);
  height: min(380px, 90vw);
  background: #ececef;
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(0,0,0,.16);
  padding: 14px 16px 18px;
  text-align: center;
}

.title { margin: 6px 0 12px; font-size: 24px; font-weight: 700; color: #1cb5a9; }
.form-group { margin-bottom: 10px; }

.input {
  width: 100%;
  height: 40px;
  padding: 0;
  font-size: 14px;
  color: #111827;
  background: #fff;
  border: 1px solid #1cb5a9;
  border-radius: 8px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.input::placeholder { color: #8fa3a9; }
.input:focus { border-color: #15978f; box-shadow: 0 0 0 3px rgba(28,181,169,.18); }

.btn {
  width: 100%;
  height: 42px;
  border: none;
  background: #1cb5a9;
  color: #fff;
  border-radius: 12px;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  transition: transform .06s ease, filter .15s ease;
}
.btn:hover { filter: brightness(0.96); }
.btn:active { transform: translateY(1px); }

@media (max-width: 720px) {
  #brand-name { font-size: clamp(28px, 8vw, 48px); }
}
</style>
