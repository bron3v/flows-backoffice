<template>
  <main class="auth-shell">
    <section class="flows-card">
      <div class="brand">
        <h2 id="brand-name">FLOWS BACKOFFICE</h2>
      </div>

      <div class="login-card">
        <h1 class="title">Richiesta accesso</h1>

        <form @submit.prevent="submitRequest">
          <div class="form-group">
            <input
              v-model.trim="usernameOrEmail"
              type="text"
              placeholder="Username"
              required
              class="input"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <input
              v-model.trim="email"
              type="email"
              placeholder="E-mail"
              required
              class="input"
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <select v-model="role" required class="input">
              <option value="user">User (base)</option>
              <option value="user_manager">User manager</option>
              <option value="logs_manager">Logs manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <button class="btn" :disabled="loading || ok">
              {{ loading ? 'Invio…' : (ok ? 'Richiesta inviata' : 'Invia richiesta') }}
            </button>
          </div>

          <p v-if="error" style="margin-top:10px;color:#b00020">{{ error }}</p>

          <!-- Messaggio di conferma richiesto -->
          <p v-if="ok" style="margin-top:10px;color:#0f7b6c">
            La tua richiesta è stata inviata. Attendi che un amministratore approvi il tuo account.
          </p>
        </form>

        <!-- Link "Torna al login" sotto tutto -->
        <p style="margin-top:12px;font-size:13px;">
          Torna al <RouterLink to="/login" style="font-weight:700; text-decoration: underline; text-underline-offset: 2px;">Login</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/utils/api'

function prettyRole(role) {
  const k = String(role || '').toLowerCase()
  return ({ admin:'Admin', user_manager:'User Manager', logs_manager:'Logs Manager', user:'User' }[k]) || 'User'
}
function appendPendingLocally(item) {
  try {
    const key = 'flows_pending'
    const arr = JSON.parse(localStorage.getItem(key) || '[]')
    const role = String(item.requested_role || item.role || 'user').toLowerCase()
    const roleLabel = item.roleLabel || prettyRole(role)
    const safe = {
      id: item.id ?? Date.now(),
      email: item.email,
      name: item.name,
      username: item.username,
      requested_role: role,
      roleLabel,
      avatar: item.avatar || 'https://i.pravatar.cc/40?img=54',
      display_name: item.display_name || item.name || (item.email ? String(item.email).split('@')[0] : 'Nuovo utente')
    }
    const exists = arr.some(x => (x.id ?? x.email) === (safe.id ?? safe.email))
    const next = exists ? arr.map(x => ((x.id ?? x.email) === (safe.id ?? safe.email) ? safe : x)) : [safe, ...arr]
    localStorage.setItem(key, JSON.stringify(next))
  } catch {}
}

const usernameOrEmail = ref('')
const email = ref('')
const role = ref('user')
const loading = ref(false)
const error = ref('')
const ok = ref(false)

const ALLOWED_ROLES = new Set(['user','user_manager','logs_manager','admin'])

function isEmail (s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim())
}
function makeUsername (fullName) {
  return String(fullName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 32)
}
function savePreferredName(emailAddr, displayName) {
  try {
    const key = 'flows_preferred_names'
    const map = JSON.parse(localStorage.getItem(key) || '{}')
    map[String(emailAddr || '').toLowerCase()] = String(displayName || '').trim()
    localStorage.setItem(key, JSON.stringify(map))
  } catch {}
}
function savePreferredRole(emailAddr, wantedRole) {
  try {
    const key = 'flows_preferred_roles'
    const map = JSON.parse(localStorage.getItem(key) || '{}')
    map[String(emailAddr || '').toLowerCase()] = wantedRole
    localStorage.setItem(key, JSON.stringify(map))
  } catch {}
}

async function submitRequest () {
  error.value = ''
  ok.value = false

  const userField = usernameOrEmail.value.trim()
  const emailField = email.value.trim().toLowerCase()
  const wantedRole = role.value

  if (!userField || !emailField) {
    error.value = 'Compila tutti i campi'
    return
  }
  if (!isEmail(emailField)) {
    error.value = 'Email non valida'
    return
  }
  if (!ALLOWED_ROLES.has(wantedRole)) {
    error.value = 'Ruolo richiesto non valido'
    return
  }

  const displayName = userField
  const suggestedUsername = makeUsername(userField)

  savePreferredName(emailField, displayName)
  savePreferredRole(emailField, wantedRole)

  const payload = {
    name: displayName,
    email: emailField,
    username: suggestedUsername,
    requested_role: wantedRole
  }

  loading.value = true
  try {
    const res = await api.requestApproval(payload)

    const created = {
      id: res?.request?.id ?? res?.id ?? Date.now(),
      name: payload.name,
      email: payload.email,
      username: payload.username,
      requested_role: wantedRole,
      display_name: displayName,
      avatar: 'https://i.pravatar.cc/40?img=54'
    }

    appendPendingLocally(created)
    window.dispatchEvent(new CustomEvent('flows:new-pending', { detail: created }))
    ok.value = true
  } catch (e) {
    const status = e?.status ?? 0
    const codeStr = (e?.data?.code || e?.data?.error || e?.data?.message || e?.message || '').toString()
    const msg = e?.data?.message || e?.message || ''

    // 401 legacy "not_logged_in" trattato come modalità offline/compat
    const notLogged = status === 401 && /not_logged_in/i.test(codeStr)

    // In caso di endpoint mancante (404) o 401 not_logged_in → crea localmente e conferma
    if (status === 404 || notLogged) {
      const created = {
        id: Date.now(),
        name: payload.name,
        email: payload.email,
        username: payload.username,
        requested_role: wantedRole,
        display_name: displayName,
        avatar: 'https://i.pravatar.cc/40?img=54'
      }
      appendPendingLocally(created)
      window.dispatchEvent(new CustomEvent('flows:new-pending', { detail: created }))
      ok.value = true
      return
    }

    if (status === 409) {
      error.value = 'Richiesta già presente per questa email'
    } else if (status === 422) {
      error.value = msg || 'Dati non validi'
    } else if (status >= 500) {
      error.value = 'Errore server, riprova più tardi'
    } else {
      error.value = msg || 'Errore durante l’invio della richiesta'
    }
  } finally {
    loading.value = false
  }
}

</script>

<style scoped>
/* (stili invariati) */
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
#brand-name { margin: 0; font-size: clamp(28px, 6vw, 64px); font-weight: 800; letter-spacing: .5px; color: #ececef; }
.login-card {
  width: min(380px, 90vw);
  height: min(420px, 92vw);
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
  padding: 0 10px;
  font-size: 14px;
  color: #111827;
  background: #fff;
  border: 1px solid #1cb5a9;
  border-radius: 8px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  appearance: none;
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

.login-card a { color: #1cb5a9 !important; }
.login-card a:visited { color: #1cb5a9 !important; }
.login-card a:hover { color: #15978f !important; }

</style>
