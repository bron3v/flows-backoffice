<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="logo-dot">
        <img src="../assets/logo.png" alt="Logo Flows">
      </span>
      <span class="brand-name">Flows Backoffice</span>
    </div>

    <nav class="menu">
      <RouterLink to="/" class="item" :class="{ active: $route.path==='/' }">Dashboard</RouterLink>
      <RouterLink to="/utenti" class="item" :class="{ active: $route.path.startsWith('/utenti') }">Utenti</RouterLink>
      <RouterLink to="/logs" class="item" :class="{ active: $route.path.startsWith('/logs') }">Logs</RouterLink>
      <RouterLink to="/moduli" class="item" :class="{ active: $route.path.startsWith('/moduli') }">Moduli</RouterLink>
      <RouterLink to="/impostazioni" class="item" :class="{ active: $route.path.startsWith('/impostazioni') }">Impostazioni</RouterLink>

      <button id="request-button" @click="openModal" :disabled="loading">
        {{ loading ? 'Invio…' : 'New user' }}
      </button>
    </nav>
  </aside>

  <!-- Modal: nuova richiesta utente -->
  <teleport to="body">
    <div
      v-if="show"
      class="overlay"
      @click.self="closeModal"
      @keyup.esc="closeModal"
      tabindex="-1"
    >
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="nu-ttl">
        <h3 id="nu-ttl">Nuova richiesta utente</h3>

        <form @submit.prevent="submit">
          <div class="field">
            <label>Nome</label>
            <input
              v-model.trim="name"
              type="text"
              placeholder="Nome e cognome"
              required
              :disabled="loading || ok"
            />
          </div>

          <div class="field">
            <label>Email</label>
            <input
              v-model.trim="email"
              type="email"
              placeholder="es. name@example.com"
              required
              :disabled="loading || ok"
            />
          </div>

          <div class="field">
            <label>Ruolo richiesto</label>
            <select v-model="role" :disabled="loading || ok" required class="select">
              <option value="user">User (base)</option>
              <option value="user_manager">User manager</option>
              <option value="logs_manager">Logs manager</option>
              <option value="admin">Admin</option> <!-- ora NON è più disabilitato -->
            </select>
            <small class="hint">L’amministratore può confermare o modificare il ruolo richiesto.</small>
          </div>


          <p v-if="error" class="err">{{ error }}</p>
          <p v-if="ok" class="ok">Richiesta inviata! Controlla la casella di posta.</p>

          <div class="btns">
            <button type="button" class="btn secondary" @click="closeModal" :disabled="loading">Annulla</button>
            <button class="btn primary" :disabled="loading || ok">
              {{ loading ? 'Invio…' : 'Invia richiesta' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/utils/api'

const show = ref(false)
const name = ref('')
const email = ref('')
const role = ref('user')
const loading = ref(false)
const error = ref('')
const ok = ref(false)

const ALLOWED_ROLES = new Set(['user','user_manager','logs_manager','admin'])

function openModal () {
  error.value = ''
  ok.value = false
  show.value = true
  nextTick(() => document.querySelector('.modal input[type="text"]')?.focus())
}

function resetState () {
  name.value = ''
  email.value = ''
  role.value = 'user'
  loading.value = false
  error.value = ''
  ok.value = false
}

function closeModal () {
  show.value = false
  resetState()
}

function isEmail (s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '')
}

// username tecnico proposto dal nome (non usiamo la mail)
function makeUsername (fullName) {
  return String(fullName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')         // spazi -> punti
    .replace(/[^a-z0-9_.-]/g, '') // solo caratteri sicuri
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

async function submit () {
  error.value = ''
  ok.value = false

  if (!name.value || !email.value) {
    error.value = 'Compila tutti i campi'
    return
  }
  if (!isEmail(email.value)) {
    error.value = 'Email non valida'
    return
  }
  if (!ALLOWED_ROLES.has(role.value)) {
    error.value = 'Ruolo richiesto non valido'
    return
  }

  const desiredDisplayName = name.value.trim()
  const normalizedEmail = email.value.trim().toLowerCase()
  const suggestedUsername = makeUsername(desiredDisplayName)

  // salva preferenze locali (usate dal rendering della lista pending)
  savePreferredName(normalizedEmail, desiredDisplayName)
  savePreferredRole(normalizedEmail, role.value)

  const payload = {
    name: desiredDisplayName,
    email: normalizedEmail,
    username: suggestedUsername,      // facoltativo lato BE
    requested_role: role.value
  }

  loading.value = true
  try {
    // prova invio al backend
    const res = await api.requestApproval(payload)

    // normalizza l'oggetto creato per l'evento locale
    const created = {
      id: res?.request?.id ?? Date.now(),
      name: payload.name,
      email: payload.email,
      username: payload.username,
      requested_role: role.value,
      display_name: desiredDisplayName,     // 👈 sempre il nome scelto
      avatar: 'https://i.pravatar.cc/40?img=54'
    }
    window.dispatchEvent(new CustomEvent('flows:new-pending', { detail: created }))

    ok.value = true
    setTimeout(closeModal, 700)

  } catch (e) {
    // fallback FE-only se l'endpoint non esiste ancora
    if (e?.status === 404) {
      const created = {
        id: Date.now(),
        name: payload.name,
        email: payload.email,
        username: payload.username,
        requested_role: role.value,
        display_name: desiredDisplayName,   // 👈 sempre il nome scelto
        avatar: 'https://i.pravatar.cc/40?img=54'
      }
      window.dispatchEvent(new CustomEvent('flows:new-pending', { detail: created }))
      ok.value = true
      setTimeout(closeModal, 700)
      loading.value = false
      return
    }

    const msg = e?.data?.message || e?.message || ''
    if (e?.status === 409)      error.value = 'Richiesta già presente per questa email'
    else if (e?.status === 422) error.value = msg || 'Dati non validi'
    else                        error.value = msg || 'Errore durante l’invio della richiesta'
  } finally {
    loading.value = false
  }
}

// ESC globale per chiudere la modale
function onKey (e) {
  if (e.key === 'Escape' && show.value) closeModal()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>




<style scoped>
/* =============== SIDEBAR =============== */
.sidebar{
  width:240px;
  min-height:100vh;
  background:linear-gradient(180deg,#111827 0%, #0b1730 100%);
  color:#cbd5e1;
  display:flex;
  flex-direction:column;
  position:sticky; top:0; left:0;
}
.brand{display:flex;align-items:center;gap:10px;padding:18px 18px 14px;border-bottom:1px solid rgba(255,255,255,.06);}
.logo-dot{width:32px;height:32px;border-radius:50%;background:#6ee7b7;display:block;overflow:hidden;box-shadow:0 0 0 3px rgba(110,231,183,.15);}
.logo-dot img{width:125%;height:110%;object-fit:cover;display:block;}
.brand-name{font-weight:700;font-size:1.1rem;letter-spacing:.3px;color:#fff;}
.menu{padding:8px;display:flex;flex-direction:column;gap:4px;}
.item{display:block;padding:10px 12px;border-radius:10px;color:#cbd5e1;text-decoration:none;}
.item:hover{background:rgba(255,255,255,.06);color:#fff;}
.item.active{background:#1f2937;color:#fff;}
@media (max-width: 960px){ .sidebar{display:none;} }

/* =============== FLOAT BUTTON (SIDEBAR) =============== */
#request-button{
  position:fixed; left:16px; bottom:20px;
  padding:12px 20px;
  background:#10b981; color:#fff; font-weight:700;
  border:0; border-radius:12px; cursor:pointer;
  box-shadow:0 4px 10px rgba(0,0,0,.15);
  transition:box-shadow .3s ease, transform .08s ease;
  z-index:10;
}
#request-button:hover{box-shadow:0 6px 14px rgba(0,0,0,.25);}
#request-button:active{transform:translateY(1px);}

/* =============== MODAL =============== */
.overlay{
  position:fixed; inset:0;
  background:rgba(2,6,23,.55);
  display:grid; place-items:center;
  padding:12px;
  z-index:9999;
}
.modal{
  width:min(520px,92vw);
  background:#f5f7fb;
  border-radius:20px;
  box-shadow:0 22px 60px rgba(15,23,42,.28);
  padding:28px 28px 22px;          /* più aria ai lati */
  border:1px solid #e5e7eb;
  overflow:visible;                 /* evita clipping dei menu */
  position:relative; z-index:1010;
}
.modal h3{
  margin:2px 0 16px;
  font-size:1.35rem;
  font-weight:800;
  text-align:center;
  color:#0f172a;
  letter-spacing:.3px;
}

/* =============== FORM FIELDS =============== */
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
.field label{color:#111;font-weight:600;}

.input, .select, .field input, .field select{
  box-sizing:border-box;            /* evita sbordo a 100% */
  display:block;
  width:100%;
  padding:10px 12px;
  border:1px solid #d5dbe1;
  border-radius:10px;
  background:#fff;
  font-size:14px;
  color:#111;
}
.field input::placeholder{color:#6b7280;}
.field select option{color:#111;}
.field select{margin-bottom:6px;}   /* aria sotto la tendina */

.field input:-webkit-autofill{
  -webkit-box-shadow:0 0 0 1000px #e8eef6 inset !important;
  -webkit-text-fill-color:#0f172a !important;
  caret-color:#0f172a;
}

/* hint & messages */
.hint{color:#6b7280;font-size:12px;margin-top:4px;display:block;}
.err{color:#dc2626;margin-top:4px;}
.ok{color:#059669;margin-top:4px;}

/* =============== BUTTONS =============== */
.btns{display:flex;justify-content:flex-end;gap:10px;margin-top:14px;}
.btn{height:44px;padding:0 18px;border-radius:12px;border:none;cursor:pointer;font-weight:800;}
.btn.secondary{background:#e2e8f0;color:#0f172a;}
.btn.primary{background:#10b981;color:#fff;box-shadow:0 8px 24px rgba(16,185,129,.22);}
.btn.primary:hover{filter:brightness(1.03);}
.btn:disabled{opacity:.7;cursor:not-allowed;}


</style>
