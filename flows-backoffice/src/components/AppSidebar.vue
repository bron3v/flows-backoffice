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
      <RouterLink to="/tabelle" class="item" :class="{ active: $route.path.startsWith('/tabelle') }">Tabelle</RouterLink>
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
const loading = ref(false)
const error = ref('')
const ok = ref(false)

function openModal () {
  error.value = ''
  ok.value = false
  show.value = true
  nextTick(() => document.querySelector('.modal input[type="text"]')?.focus())
}

function resetState () {
  name.value = ''
  email.value = ''
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

// username "pulito" derivato dal nome (senza usare l'email)
function makeUsername (fullName) {
  return String(fullName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')           // spazi -> punti
    .replace(/[^a-z0-9_.-]/g, '')   // solo caratteri sicuri
    .slice(0, 32)                   // limiti ragionevoli
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

  const payload = {
    name: name.value.trim(),
    email: email.value.trim().toLowerCase(),
    username: makeUsername(name.value)
  }

  loading.value = true
  try {
    const res = await api.requestApproval(payload)  // <-- tenta il backend
    ok.value = true

    const created = {
      id: res?.request?.id ?? Date.now(),
      name: payload.name,
      email: payload.email,
      avatar: 'https://i.pravatar.cc/40?img=54'
    }
    window.dispatchEvent(new CustomEvent('flows:new-pending', { detail: created }))
    setTimeout(closeModal, 700)

  } catch (e) {
    // 👉 FALLBACK: se l’endpoint non esiste ancora (404),
    // crea il pending solo FE così puoi approvare dalla Home.
    if (e?.status === 404) {
      const created = {
        id: Date.now(),
        name: payload.name,
        email: payload.email,
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



// Esc globale
function onKey (e) {
  if (e.key === 'Escape' && show.value) closeModal()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>



<style scoped>
.sidebar{
  width: 240px;
  min-height: 100vh;
  background: linear-gradient(180deg,#111827 0%, #0b1730 100%);
  color:#cbd5e1;
  display:flex;
  flex-direction:column;
  position:sticky; top:0; left:0;
}
.brand{ display:flex; align-items:center; gap:10px; padding:18px 18px 14px; border-bottom:1px solid rgba(255,255,255,.06); }
.logo-dot{ width: 32px; height: 32px; border-radius: 50%; background: #6ee7b7; display: block; overflow: hidden; box-shadow: 0 0 0 3px rgba(110,231,183,.15); }
.logo-dot img{ width: 125%; height: 110%; object-fit: cover; display: block; }
.brand-name{ font-weight:700; font-size:1.1rem; letter-spacing:.3px; color:#fff; }
.menu{ padding:8px; display:flex; flex-direction:column; gap:4px; }
.item{ display:block; padding:10px 12px; border-radius:10px; color:#cbd5e1; text-decoration:none; }
.item:hover{ background:rgba(255,255,255,.06); color:#fff; }
.item.active{ background:#1f2937; color:#fff; }
@media (max-width: 960px){ .sidebar{ display:none; } }

/* Pulsante flottante nella sidebar */
#request-button{
  position: fixed;
  left: 16px; /* allinea dentro la sidebar */
  bottom: 20px;
  padding: 12px 20px;
  background:#10b981;
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
  transition: all 0.3s ease;
  z-index: 10;
}
#request-button:hover { box-shadow: 0 6px 14px rgba(0,0,0,0.25); }

/* Modal */
.overlay{
  position: fixed; inset: 0;
  background: rgba(2,6,23,.55);
  display: grid; place-items: center; z-index: 9999;
  padding: 12px;
}
.modal{
  width: min(480px, 92vw);
  background: #f5f7fb;
  border-radius: 20px;
  box-shadow: 0 22px 60px rgba(15,23,42,.28);
  padding: 22px 22px 18px;
  border: 1px solid #e5e7eb;
  overflow: hidden; 
}
.modal h3{
  margin: 2px 0 14px;
  font-size: 1.35rem;
  font-weight: 800;
  text-align: center;
  color: #0f172a;
  letter-spacing: .3px;
}

/* campi */
.field{ margin-bottom: 12px; }
.field label{
  display:block; font-size:.9rem; color:#334155; margin-bottom:6px; font-weight:600;
}
.field input{
  width:100%;
  height:46px;
  border:1.5px solid #c8d3e1;
  border-radius:12px;
  outline:none;
  padding:0 12px;
  font-size:1rem;
  background:#e8eef6;
  color:#0f172a;
  box-sizing:border-box; 
}
.field input:focus{
  border-color:#10b981;
  box-shadow: 0 0 0 2px rgba(16,185,129,.25) inset;
}
.field input:-webkit-autofill{
  -webkit-box-shadow: 0 0 0 1000px #e8eef6 inset !important;
  -webkit-text-fill-color:#0f172a !important;
  caret-color:#0f172a;
}

/* bottoni */
.btns{ display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }
.btn{ height:44px; padding:0 18px; border-radius:12px; border:none; cursor:pointer; font-weight:800; }
.btn.secondary{ background:#e2e8f0; color:#0f172a; }
.btn.primary{ background:#10b981; color:#fff; box-shadow:0 8px 24px rgba(16,185,129,.22); }
.btn.primary:hover{ filter:brightness(1.03); }
.btn:disabled{ opacity:.7; cursor:not-allowed; }

.ok { color:#059669; margin-top:4px; }
.err { color:#dc2626; margin-top:4px; }
</style>
