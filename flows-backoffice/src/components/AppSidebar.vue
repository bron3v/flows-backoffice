<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="logo-dot">
        <img src="../assets/logo.png" alt="Logo Flows">
      </span>
      <span class="brand-name">Flows Backoffice</span>
    </div>

    <nav class="menu">
      <RouterLink to="/" class="item active">Dashboard</RouterLink>
      <RouterLink to="/" class="item">Utenti</RouterLink>
      <RouterLink to="/" class="item">Tabelle</RouterLink>
      <RouterLink to="/" class="item">Moduli</RouterLink>
      <RouterLink to="/" class="item">Impostazioni</RouterLink>
      <button id="request-button" @click="openModal">New user</button>
    </nav>
  </aside>

  <!-- Modal: nuova richiesta utente (solo FE) -->
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="closeModal" @keyup.esc="closeModal" tabindex="-1">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="nu-ttl">
        <h3 id="nu-ttl">Nuova richiesta utente</h3>

        <form @submit.prevent="submit">
          <div class="field">
            <label>Nome</label>
            <input v-model.trim="name" type="text" placeholder="Nome e cognome" required />
          </div>

          <div class="field">
            <label>Email</label>
            <input v-model.trim="email" type="email" placeholder="es. name@example.com" required />
          </div>

          <p v-if="error" class="err">{{ error }}</p>
          <p v-if="ok" class="ok">Richiesta salvata!</p>

          <div class="btns">
            <button type="button" class="btn secondary" @click="closeModal">Annulla</button>
            <button class="btn primary" :disabled="loading">
              {{ loading ? 'Salvo…' : 'Invia richiesta' }}
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

function closeModal () {
  show.value = false
  name.value = ''
  email.value = ''
  loading.value = false
  error.value = ''
  ok.value = false
}

async function submit () {
  error.value = ''
  ok.value = false

  // validazione minima FE
  if (!name.value || !email.value) {
    error.value = 'Compila tutti i campi'
    return
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRe.test(email.value)) {
    error.value = 'Email non valida'
    return
  }

  loading.value = true
  try {
    // salva SOLO in localStorage
    const pending = JSON.parse(localStorage.getItem('flows_pending') || '[]')
    const item = {
      id: Date.now(),
      name: name.value,
      email: email.value,
      avatar: 'https://i.pravatar.cc/40?img=54'
    }
    pending.push(item)
    localStorage.setItem('flows_pending', JSON.stringify(pending))

    // notifica l’app (Home aggiorna subito)
    window.dispatchEvent(new CustomEvent('flows:new-pending', { detail: item }))

    ok.value = true
    setTimeout(closeModal, 600)
  } catch {
    error.value = 'Impossibile salvare la richiesta'
  } finally {
    loading.value = false
  }
}

// Esc globale
function onKey (e) { if (e.key === 'Escape' && show.value) closeModal() }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
/* (stili identici ai tuoi, li lascio come sono) */
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
/* Pulsante */
#request-button{ position: fixed; bottom: 20px; padding: 12px 20px; background:#6ee7b7; color: white; font-weight: bold; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.15); transition: all 0.3s ease; }
#request-button:hover { box-shadow: 0 6px 14px rgba(0,0,0,0.25); }
/* Modal */
.overlay{ position: fixed; inset: 0; background: rgba(2,6,23,.55); display: grid; place-items: center; z-index: 50; }
.modal{ width: min(420px, 92vw); background: #fff; border-radius: 14px; box-shadow: 0 16px 40px rgba(0,0,0,.25); padding: 18px 16px 14px; }
.modal h3{ margin: 0 0 12px; font-size: 1.05rem; font-weight: 800; color: #0f172a; }
.field{ margin-bottom: 10px; }
.field label{ display:block; font-size:.85rem; color:#334155; margin-bottom:4px; }
.field input{ width:100%; height:40px; border:1px solid #cbd5e1; border-radius:10px; outline:none; padding:0 10px; font-size:.95rem; }
.field input:focus{ border-color:#6ee7b7; box-shadow: 0 0 0 3px rgba(110,231,183,.2); }
.btns{ display:flex; justify-content:flex-end; gap:8px; margin-top: 10px; }
.btn{ height:40px; padding:0 14px; border-radius:10px; border:none; cursor:pointer; font-weight:700; }
.btn.secondary{ background:#e2e8f0; color:#0f172a; }
.btn.primary{ background:#10b981; color:#fff; }
.btn:disabled{ opacity:.7; cursor:not-allowed; }
.err{ color:#b00020; margin:6px 0; }
.ok{ color:#059669; margin:6px 0; }
</style>
