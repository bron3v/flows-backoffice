<template>
  <div class="layout">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main area -->
    <main class="main">
      <!-- TOPBAR: incollata in alto, a destra e sinistra -->
      <AppTopbar
        class="topbar-card"
        title="Dashboard"
        v-model="q"
        :session-user="sessionUser"
        :avatar-initial="avatarInitial"
        @search="onSearch"
        @profile="openProfile"
      />

      <!-- CONTENUTO: centrato e separato dalla topbar -->
      <section class="page-content">
        <!-- KPI -->
        <section class="kpi">
          <div class="kpi-card">
            <div class="kpi-title">Utenti totali</div>
            <div class="kpi-value">{{ kpi.usersTotal }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Online ora</div>
            <div class="kpi-value">{{ kpi.usersOnline }}</div>
          </div>
        </section>

        <!-- PENDING APPROVALS -->
        <section class="approvals">
          <div class="card approvals-card">
            <div class="card-head">
              <h3>Utenti da approvare</h3>
              <span class="muted" v-if="pending.length">{{ pending.length }} richieste</span>
            </div>

            <div v-if="pending.length">
              <ul class="pending-list">
                <li v-for="u in pending" :key="u.id" class="pending-item">
                  <img :src="u.avatar || defaultAvatar" alt="" />
                  <div class="meta">
                    <strong>{{ displayName(u) }}</strong>
                    <small>{{ u.email || '—' }}</small>
                  </div>
                  <div class="actions">
                    <button class="ok" @click="approve(u)" :disabled="loadingIds.has(u.id)">✓</button>
                    <button class="ko" @click="reject(u)" :disabled="loadingIds.has(u.id)">✕</button>
                  </div>
                </li>
              </ul>
            </div>
            <p v-else class="muted">Nessuna richiesta in attesa.</p>
          </div>
        </section>

        <!-- TEAM LIST -->
        <section class="team">
          <div class="card">
            <div class="card-head">
              <h3>Team</h3>
              <span class="muted">{{ filteredTeam.length }} risultati</span>
            </div>

            <ul class="team-grid">
              <li
                v-for="u in filteredTeam"
                :key="u.id"
                class="user-card"
                :class="{ me: isSelf(u) }"
              >
                <div class="uc-head">
                  <img :src="u.avatar || defaultAvatar" alt="" />
                  <div>
                    <div class="name">
                      {{ displayName(u) }}
                      <span v-if="isSelf(u)" class="badge">tu</span>
                    </div>
                    <div class="email">{{ u.email }}</div>
                  </div>
                </div>

                <div class="uc-footer">
                  <span class="dot" :class="u.active ? 'on' : 'off'"></span>
                  <span class="status">{{ u.active ? 'online' : 'offline' }}</span>
                </div>
              </li>
            </ul>
          </div>
        </section>
      </section>
      <!-- /page-content -->
    </main>
  </div>

  <button
    class="fab-new-user"
    @click="openModal"
    :disabled="loading"
    aria-label="Create new user"
  >
    <span v-if="!loading">New user</span>
    <span v-else>Invio…</span>
  </button>


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
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute, RouterLink  } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopBar.vue'   
import { api } from '@/utils/api'
import AvatarCard from '@/components/AvatarCard.vue'







// ---- stato base
const router = useRouter()
const defaultAvatar = 'https://i.pravatar.cc/40?img=1'

const avatarInitial = ref('A')
const systemName   = ref('Flows system')
const sessionUser  = ref(null)

const kpi     = ref({ usersTotal: 0, usersOnline: 0 })
const pending = ref([])
const team    = ref([])

const q = ref('')                 // filtro ricerca (v-model topbar)
const loading = ref(false)        // ✅ usato dal bottone "New user"
const loadingIds = ref(new Set()) // usato per pending

// ---- helper: è l'utente corrente?
function isSelf(u) {
  const me = sessionUser.value
  if (!me) return false
  if (me.id != null && u.id != null && String(u.id) === String(me.id)) return true
  if (me.username && u.username &&
      String(u.username).toLowerCase() === String(me.username).toLowerCase()) return true
  return false
}

// ---- override locale "email -> nome scelto nella card"
const NAME_OVR_KEY = 'flows_name_overrides'
function readNameOverrides() {
  try { return JSON.parse(localStorage.getItem(NAME_OVR_KEY) || '{}') } catch { return {} }
}
function saveNameOverrides(map) {
  try { localStorage.setItem(NAME_OVR_KEY, JSON.stringify(map)) } catch {}
}
function saveNameOverride(email, name) {
  if (!email || !name) return
  const map = readNameOverrides()
  map[email] = name
  saveNameOverrides(map)
}
function displayName(u) {
  const map = readNameOverrides()
  if (u?.email && map[u.email]) return map[u.email]
  if (u?.name && String(u.name).trim()) return u.name
  if (u?.email) return String(u.email).split('@')[0]
  return 'Utente'
}

// ---- caricamenti
async function loadMe() {
  try {
    const me = await api.me()
    sessionUser.value = me || null
    if (!me) {
      router.replace('/login')
      return
    }
    avatarInitial.value = (me.username || me.name || 'A').slice(0, 1).toUpperCase()
  } catch {
    router.replace('/login')
  }
}

async function loadKpi() {
  try {
    const s = await api.stats()
    if (s?.usersTotal != null) kpi.value.usersTotal = s.usersTotal
    if (s?.usersOnline != null) kpi.value.usersOnline = s.usersOnline
  } catch (e) {
    console.warn('[Usersview] stats error', e)
  }
}

async function loadTeam() {
  try {
    const res = await api.usersList()
    if (Array.isArray(res)) {
      team.value = res
    } else {
      if (Array.isArray(res?.team)) team.value = res.team
      if (Array.isArray(res?.pending)) pending.value = res.pending
    }
    if (!kpi.value.usersTotal) kpi.value.usersTotal = team.value.length
    kpi.value.usersOnline = team.value.filter(x => x.active).length
  } catch (e) {
    console.error('[Usersview] usersList error', e)
    alert('Impossibile caricare la lista utenti.')
  }
}

async function loadAll() {
  await loadMe()
  await Promise.all([loadKpi(), loadTeam()])
}

// ---- azioni approvazione / rifiuto
async function approve(u) {
  if (!u) return
  try {
    loadingIds.value.add(u.id)
    const suggestedUsername =
      (u.name && String(u.name).toLowerCase().replace(/\s+/g, '_')) ||
      (u.email && String(u.email).split('@')[0]) ||
      undefined

    const res = await api.approveUser({
      id: u.id,
      name: u.name,
      email: u.email,
      username: suggestedUsername
    })

    if (!res || res.ok === false) throw new Error(res?.message || 'Errore approvazione')

    if (u.email && u.name) saveNameOverride(u.email, u.name)
    pending.value = pending.value.filter(x => x.id !== u.id)
    await loadTeam()
  } catch (e) {
    console.error('[Usersview] approve error', e)
    alert('Impossibile approvare la richiesta.')
  } finally {
    loadingIds.value.delete(u.id)
  }
}

async function reject(u) {
  if (!u) return
  try {
    loadingIds.value.add(u.id)
    await api.deleteUser(u.id)   // o endpoint specifico per reject se disponibile
    pending.value = pending.value.filter(x => x.id !== u.id)
  } catch (e) {
    console.error('[Usersview] reject error', e)
    alert('Impossibile rifiutare la richiesta.')
  } finally {
    loadingIds.value.delete(u.id)
  }
}

// ---- ricerca (collegata alla topbar)
function onSearch(term) {
  // chiamato su Enter dalla search della topbar (già legata a v-model "q")
  // qui puoi fare fetch remoto o lasciare che "filteredTeam" faccia filtraggio locale
  // esempio: console.log('search:', term)
}

function openProfile() {
  // apri menù profilo o pagina impostazioni
  // esempio: router.push('/impostazioni')
}



// ---- filtro locale team
const filteredTeam = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return team.value
  return team.value.filter(u => {
    const name = displayName(u).toLowerCase()
    const email = (u.email || '').toLowerCase()
    return name.includes(term) || email.includes(term)
  })
})

// ---- polling leggero per KPI/online
let t = null
onMounted(async () => {
  await loadAll()
  t = setInterval(() => loadKpi(), 15_000)
})
onBeforeUnmount(() => { if (t) clearInterval(t) })


/* ──────────────────────────────────────────────
   Stato modale + campi form
   ────────────────────────────────────────────── */
const show = ref(false)
const name = ref('')
const email = ref('')
const role = ref('user')
const error = ref('')
const ok = ref(false)

/* evita doppi invii dal pulsante */
let inFlight = false

const ALLOWED_ROLES = new Set(['user','user_manager','logs_manager','admin'])

/* ──────────────────────────────────────────────
   Helpers locali
   ────────────────────────────────────────────── */
function isEmail (s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '')
}

/* username tecnico dal NOME (non dalla mail) */
function makeUsername (fullName) {
  return String(fullName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')          // spazi -> punti
    .replace(/[^a-z0-9_.-]/g, '')  // solo caratteri sicuri
    .slice(0, 32)
}

/* preferenze locali per rendering lista pending */
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

/* semplice chiave antidual per evitare doppie richieste */
function pendingKey(emailAddr) {
  return `flows_req_${String(emailAddr || '').toLowerCase()}`
}
function markPending(emailAddr) {
  try { sessionStorage.setItem(pendingKey(emailAddr), String(Date.now())) } catch {}
}
function wasJustSent(emailAddr) {
  try {
    const t = Number(sessionStorage.getItem(pendingKey(emailAddr)) || 0)
    return t && Date.now() - t < 5000 // 5s: evita doppio click
  } catch { return false }
}

/* reset e modale */
function resetState () {
  name.value = ''
  email.value = ''
  role.value = 'user'
  loading.value = false
  error.value = ''
  ok.value = false
  inFlight = false
}
function openModal () {
  error.value = ''
  ok.value = false
  show.value = true
  nextTick(() => document.querySelector('.modal input[type="text"]')?.focus())
}
function closeModal () {
  show.value = false
  resetState()
}

/* ──────────────────────────────────────────────
   ACTION: submit dal pulsante "Crea"
   ────────────────────────────────────────────── */
async function submit () {
  if (loading.value || inFlight || ok.value) return
  error.value = ''
  ok.value = false

  // validazioni base
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
  const normalizedEmail   = email.value.trim().toLowerCase()

  // username tecnico dal NOME (coerente con tuo helper)
  const suggestedUsername = makeUsername(desiredDisplayName)

  // antidual (evita doppio click entro 5s)
  if (wasJustSent(normalizedEmail)) return

  // salvataggi locali utili al rendering
  savePreferredName(normalizedEmail, desiredDisplayName)
  savePreferredRole(normalizedEmail, role.value)

  const payload = {
    name: desiredDisplayName,
    email: normalizedEmail,
    username: suggestedUsername,
    requested_role: role.value
  }

  loading.value = true
  inFlight = true
  markPending(normalizedEmail)

  try {
    // 🔑 APPROVA SUBITO (CREA UTENTE + INVIA EMAIL CREDENZIALI DAL BACKEND)
    // usa la funzione già presente in src/utils/api.js
    const res = await api.approvalsApprove(payload)

    if (!res?.ok) {
      throw Object.assign(new Error(res?.message || 'approve_failed'), { status: 500, data: res })
    }

    // ricarica team/KPI per riflettere il nuovo utente creato
    await loadTeam()

    ok.value = true
    // opzionale: messaggio più esplicito lato UI
    // ok.value = 'Utente creato. Le credenziali sono state inviate via email.'

    // chiudi dopo un attimo
    setTimeout(closeModal, 700)

  } catch (e) {
    const msg = e?.data?.message || e?.message || ''
    if (e?.status === 401) error.value = 'Sessione scaduta. Esegui di nuovo il login.'
    else if (e?.status === 409) error.value = 'Utente già esistente per questa email/username'
    else if (e?.status === 400) error.value = msg || 'Dati non validi'
    else                        error.value = msg || 'Errore durante la creazione e l’invio email'
  } finally {
    loading.value = false
    inFlight = false
  }
}



function onKey (e) {
  if (e.key === 'Escape' && show.value) closeModal()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

</script>


<style scoped>
/* layout */
.layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
}
.main {
  padding: 24px;
  background:  #eef2f7;          /* ✅ chiaro come HomeView */
  color: #0b0b0c;
}

/* (rimosso) topbar: gestita da AppTopbar.vue */

/* cards & sections */
.kpi {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.kpi-card,
.card {
  background: #ffffff;          /* ✅ card bianche */
  border: 1px solid #e6e8ef;    /* ✅ bordo chiaro */
  border-radius: 14px;
  padding: 16px;
}
.kpi-title { font-size: 12px; opacity: .7; margin-bottom: 6px; color:#495061; }
.kpi-value { font-size: 22px; font-weight: 700; color:#0b0b0c; }

.approvals { margin-top: 16px; }
.card-head {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
}
.muted { opacity: .7; font-size: 12px; color:#6b7280; }

/* pending list */
.pending-list { display: grid; gap: 8px; }
.pending-item {
  display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center;
  background: #ffffff;          /* ✅ item bianchi */
  border: 1px solid #e6e8ef;    /* ✅ bordo chiaro */
  padding: 8px 10px; border-radius: 10px;
}
.pending-item img { width: 36px; height: 36px; border-radius: 50%; }
.pending-item .meta { line-height: 1.1; }
.pending-item .meta strong { display: block; color:#0b0b0c; }
.pending-item .meta small { opacity: .7; color:#6b7280; }
.pending-item .actions { display: flex; gap: 6px; }
.pending-item .actions button {
  width: 32px; height: 28px; border: 0; border-radius: 8px; cursor: pointer; font-weight: 700;
}
.pending-item .actions .ok { background: #e9f7ee; color: #177245; border: 1px solid #cfe9d6; }
.pending-item .actions .ko { background: #fdecec; color: #8a1c1c; border: 1px solid #f6caca; }

/* team grid */
.team { margin-top: 16px; }
.team-grid {
  list-style: none; padding: 0; margin: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;
}
.user-card {
  background: #ffffff;          /* ✅ user card bianche */
  border: 1px solid #e6e8ef;
  border-radius: 12px;
  padding: 12px;
  display: grid; gap: 10px;
}
.user-card.me { border-color: #2b5cff; box-shadow: 0 0 0 1px #2b5cff1f inset; }
.uc-head { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; }
.uc-head img { width: 42px; height: 42px; border-radius: 50%; }
.name { font-weight: 700; display: flex; align-items: center; gap: 6px; color:#0b0b0c; }
.email { font-size: 12px; opacity: .75; color:#6b7280; }
.badge { font-size: 10px; padding: 2px 6px; border-radius: 999px; background: #e8eeff; color: #274690; }

.uc-footer { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: .9; color:#495061; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.on  { background: #10b981; }
.dot.off { background: #9aa3b2; }


/* 1) Grid senza gap e con larghezza sidebar coerente */
.layout{
  --sidebar-w: 240px;                 /* ⬅️ usa ESATTAMENTE la larghezza della tua AppSidebar */
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  gap: 0;
}

/* 2) La sidebar occupa tutta la sua colonna (no bordo/ombra) */
:deep(.sidebar){
  width: var(--sidebar-w) !important;
  min-width: var(--sidebar-w) !important;
  max-width: var(--sidebar-w) !important;
  border-right: 0 !important;
  box-shadow: none !important;
}

.main{
  padding: 0 24px 24px 0;   /* top 0 | right 24 | bottom 24 | left 0 */
}

.topbar-card{
  margin: 0;
  width: 100%;
  border-top-left-radius: 0;
}

/* elimina eventuali artefatti sub-pixel */
.layout, .main { overflow-x: clip; }


/* 🔧 anti-collasso: azzera il margine del primo titolo interno */
.topbar-card :where(h1, .title){ margin-top: 0; }

/* in caso di scoped CSS in Vue, usa deep selector: */
:deep(.topbar-card h1){ margin-top: 0; }

/* (opzionale) sticky come in home */
@supports (position: sticky){
  .topbar-card{ position: sticky; top: 0; z-index: 10; }
}


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

.fab-new-user{
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 56px;              /* ⬅️ tondo */
  height: 56px;
  padding: 0;
  border-radius: 50%;
  border: none;

  background: #10b981;      /* ⬅️ colore richiesto */
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0,0,0,.15);
  transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease, background .12s ease;
}

/* Se nel bottone c’è testo, lo nascondo visivamente e mostro un “+” via CSS */
.fab-new-user { font-size: 0; }
.fab-new-user::after{
  content: '+';
  font-size: 28px;
  line-height: 1;
}

/* Hover/active/focus */
.fab-new-user:hover{ box-shadow: 0 10px 24px rgba(0,0,0,.18); background: #0ea371; }
.fab-new-user:active{ box-shadow: 0 6px 16px rgba(0,0,0,.12); background: #0c8c6d; }
.fab-new-user:focus-visible{ outline: 3px solid rgba(16,185,129,.35); outline-offset: 2px; }

.fab-new-user:disabled{
  opacity: .6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 6px 16px rgba(0,0,0,.12);
  background: #10b981;
}



</style>

