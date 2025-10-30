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

       
        <!-- Utenti da approvare DOPO i KPI -->
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

                  <!-- 👇 RUOLO AL CENTRO -->
                  <div class="role-center">
                    <span class="badge-role">{{ u.roleLabel }}</span>
                  </div>

                  <div class="actions">
                    <button class="ok" @click="approve(u)">✓</button>
                    <button class="ko" @click="reject(u)">✕</button>
                  </div>
                </li>
              </ul>
            </div>
            <div v-else class="empty">Nessuna richiesta in sospeso.</div>
          </div>

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

                  <!-- stato -->
                  <span class="status" v-if="u.active">online</span>
                  <span class="status" v-else>offline</span>

                  <!-- ultimo accesso solo se offline -->
                  <span v-if="!u.active" class="chip offline">
                    Ultimo accesso: {{ timeAgo(u.lastSeenTs) }}
                  </span>
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
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
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

const PENDING_KEY    = 'flows_pending_v2'
const NAME_PREF_KEY  = 'flows_preferred_names'
const ROLE_PREF_KEY  = 'flows_preferred_roles'


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



// ---- caricamenti
async function loadMe() {
  try {
    const me = await api.me()
    sessionUser.value = me || null
    if (!me) {
      router.replace('/login')
      return
    }
    if (!me && router.currentRoute.value.path !== '/login') {
     router.replace('/login')
     return
   }
    avatarInitial.value = (me.username || me.name || 'A').slice(0, 1).toUpperCase()
  } catch {
    router.replace('/login')
    if (router.currentRoute.value.path !== '/login') router.replace('/login')
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


async function loadAll() {
  await loadMe()
  await Promise.all([loadKpi(), loadTeam()])
}

// ---- azioni approvazione / rifiuto



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

//Funzioni pending
/* ---------- Helpers ruolo & normalizzazione ---------- */


/* ---------- Preferenze locali: nome & ruolo ---------- */
function savePreferredName(email, displayName) {
  try {
    const key = NAME_PREF_KEY
    const map = JSON.parse(localStorage.getItem(key) || '{}')
    map[String(email || '').toLowerCase()] = String(displayName || '').trim()
    localStorage.setItem(key, JSON.stringify(map))
  } catch {}
}

function savePreferredRole(email, role) {
  try {
    const key = ROLE_PREF_KEY
    const map = JSON.parse(localStorage.getItem(key) || '{}')
    map[String(email || '').toLowerCase()] = String(role || 'user').toLowerCase()
    localStorage.setItem(key, JSON.stringify(map))
  } catch {}
}




/* ---------- Hook globali per pending ---------- */
onMounted(() => {
  window.addEventListener('flows:new-pending', onNewPending)
})
onBeforeUnmount(() => {
  window.removeEventListener('flows:new-pending', onNewPending)
})



// timer interno al componente
let heartbeatTimer = null

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    fetch('/me/ping', { method: 'POST', credentials: 'include' })
      .catch(() => {}) // ignora errori transitori
  }, 10_000) // ogni 10s
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

// avvia quando la view è montata, ferma quando esce
onMounted(startHeartbeat)
onBeforeUnmount(stopHeartbeat)

// opzionale: ping immediato quando la tab torna visibile
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetch('/me/ping', { method: 'POST', credentials: 'include' }).catch(() => {})
  }
})  



// filtro client-side
const filteredTeam = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return team.value
  return team.value.filter(m =>
    String(m.username || '').toLowerCase().includes(term) ||
    String(m.name || '').toLowerCase().includes(term)
  )
})

// --- helper persistenza pending (solo FE) ---
function savePendingLocally(list) {
  try { localStorage.setItem('flows_pending', JSON.stringify(normalizePendingList(list))) } catch {}
}

function loadPendingLocally() {
  try {
    const saved = localStorage.getItem('flows_pending')
    return saved ? JSON.parse(saved) : samplePending()
  } catch { return samplePending() }
}


function prettyRole(role) {
  const k = String(role || '').toLowerCase();
  return ({
    admin: 'Admin',
    user_manager: 'User Manager',
    logs_manager: 'Logs Manager',
    user: 'User',
  })[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'User');
}


function normalizePendingList(list) {
  return (list || []).map(p => {
    const raw = p.role ?? p.requested_role ?? p.requestedRole ?? null;
    const role = String(raw || 'user').toLowerCase();
    const roleLabel = p.roleLabel || prettyRole(role);
    return { ...p, role, roleLabel };
  });
}




function preferredNameFor(email) {
  try {
    const key = 'flows_preferred_names'
    const map = JSON.parse(localStorage.getItem(key) || '{}')
    return map[String(email || '').toLowerCase()] || ''
  } catch { return '' }
}

async function loadPendingFromBackend() {
  const data = await api.approvalsList().catch(() => ({}))
  const items = Array.isArray(data?.items) ? data.items
              : Array.isArray(data?.approvals) ? data.approvals
              : []
  return items.map(r => {
    const pref = preferredNameFor(r.email)
    const display = pref || r.display_name || r.name
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      username: r.username,
      requested_role: r.requested_role || r.role || 'user',
      roleLabel: prettyRole(r.requested_role || r.role || 'user'),
      avatar: r.avatar || 'https://i.pravatar.cc/40?img=54',
      display_name: display || (r.email ? String(r.email).split('@')[0] : 'Nuovo utente')
    }
  })
}



function mergePending(localList, serverList) {
  // evita duplicati per id/email
  const byKey = new Map()
  ;[...serverList, ...localList].forEach(x => {
    const key = x.id ?? x.email
    if (!byKey.has(key)) byKey.set(key, x)
  })
  return [...byKey.values()]
}


// --- bootstrap pagina ---
let intervalId = null

onMounted(() => {
  bootstrap()
  window.addEventListener('focus', onFocusRefresh)
  window.addEventListener('flows:new-pending', onNewPending)
  // auto refresh ogni 30s per aggiornare "online"
  intervalId = setInterval(refreshUsersAndKpi, 30_000)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', onFocusRefresh)
  window.removeEventListener('flows:new-pending', onNewPending)
  if (intervalId) clearInterval(intervalId)
})

// salva pending ad ogni modifica (solo FE)
watch(pending, v => savePendingLocally(v), { deep: true })

async function bootstrap() {
  // 1) verifica sessione
  try {
    const me = await api.me()
    if (!me?.ok || !me?.user) throw new Error('NOT_LOGGED_IN')
    sessionUser.value = me.user
    const seed = (me.user?.username || 'A').trim()
    avatarInitial.value = seed ? seed[0].toUpperCase() : 'A'
  } catch {
    const redirect = route.fullPath || '/'
    router.push({ path: '/login', query: { redirect } })
    return
  }

  // 2) stats KPI
  await loadStats()

  // 3) pending: usa backend se c'è, con fallback e merge col locale
  const serverPending = await loadPendingFromBackend()
  const localPending  = loadPendingLocally()
  pending.value = mergePending(localPending, serverPending)

  // 4) team dal backend
  await loadTeam()
}

async function onFocusRefresh() {
  await refreshUsersAndKpi()
}

async function refreshUsersAndKpi() {
  await Promise.all([loadTeam(), loadStats().catch(() => {})])
  // in ogni caso, riallinea KPI con ciò che vedi a schermo
  kpi.value.usersOnline = team.value.filter(x => x.active).length
  kpi.value.usersTotal  = team.value.length
}

async function loadStats() {
  try {
    const s = await api.stats()
    const st = s?.stats || s || {}
    kpi.value.usersTotal  = Number(st.usersTotal ?? st.totalUsers ?? kpi.value.usersTotal ?? 0)
    kpi.value.usersOnline = Number(st.usersOnline ?? st.onlineUsers ?? kpi.value.usersOnline ?? 0)
    if (st.systemName) systemName.value = String(st.systemName)
  } catch {
    // fallback: lascio ai dati di team
  }
}

const teamError = ref('')
async function loadTeam() {
  teamError.value = ''
  try {
    const data = await api.usersList() // { ok, items } o { users: [...] }
    // accetta entrambi i payload
    const items = Array.isArray(data?.items) ? data.items
                 : Array.isArray(data?.users) ? data.users
                 : [] 
team.value = items.map(u => {
  const override = getNameOverride(u.email)
  const rawRole = (u.role || u.user?.role || '').toString().toLowerCase()
  return {
    id: u.id ?? null,
    username: u.username ?? null,
    name: override || u.name || u.username || (u.email && String(u.email).split('@')[0]) || 'Utente',
    email: u.email || '',
    active: !!(u.online ?? u.active),
    role: rawRole || 'user',                 // valore tecnico
    roleLabel: prettyRole(rawRole || 'user'),// etichetta da mostrare
    avatar: u.avatar,
    lastSeenTs: Number(u.last_seen_ts || 0)
  }
})





    // riallinea KPI ai dati correnti
    kpi.value.usersOnline = team.value.filter(x => x.active).length
    kpi.value.usersTotal  = team.value.length
  } catch (e) {
    console.error('GET /admin/api/users failed:', e)
    team.value = []
    teamError.value = 'Impossibile caricare gli utenti'
  }
}

function onNewPending(e) {
  const item = e.detail
  if (!item || !item.id) return
  const norm = normalizePendingList([item])[0]
  if (!pending.value.some(p => p.id === norm.id)) {
    pending.value = [norm, ...pending.value]
  }
}


// --- dati di fallback ---
function samplePending() {
  return [
    { id: 1, name: 'John Doe',  email: 'john@example.com', avatar: 'https://i.pravatar.cc/40?img=11', role: 'user', roleLabel: prettyRole('user') },
    { id: 2, name: 'Jane Smith',email: 'jane@example.com', avatar: 'https://i.pravatar.cc/40?img=32', role: 'user', roleLabel: prettyRole('user') },
    { id: 3, name: 'Alex Brown',email: 'alex@example.com', avatar: 'https://i.pravatar.cc/40?img=5',  role: 'user', roleLabel: prettyRole('user') },
  ]
}


function saveNameOverride(email, name) {
  try {
    const m = JSON.parse(localStorage.getItem('flows_name_overrides') || '{}')
    m[email] = name
    localStorage.setItem('flows_name_overrides', JSON.stringify(m))
  } catch {}
}

function getNameOverride(email) {
  try {
    const m = JSON.parse(localStorage.getItem('flows_name_overrides') || '{}')
    return m[email]
  } catch { return undefined }
}

// utils time-ago minimale
function timeAgo(ms) {
  if (!ms || ms <= 0) return 'mai';
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'pochi secondi fa';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min fa`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h fa`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} g fa`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} mesi fa`;
  const y = Math.floor(m / 12);
  return `${y} anni fa`;
}

// helper: username pulito a partire dal "Nome" (spazi -> punti)
function makeUsernameFromName (s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')         // es: "A Maxia" -> "a.maxia"
    .replace(/[^a-z0-9_.-]/g, '') // caratteri sicuri
    .slice(0, 32)
}

// --- approvazioni: chiama backend e aggiorna lista locale ---
async function approve(u) {
  // --- helpers locali sicuri ---
  const emailLocalPart = s => String(s || '').toLowerCase().split('@')[0] || '';
  const preferredNameFor = (email) => {
    try {
      const map = JSON.parse(localStorage.getItem('flows_preferred_names') || '{}');
      return map[String(email || '').toLowerCase()] || '';
    } catch { return ''; }
  };
  const makeUsername = (fullName) =>
    String(fullName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '.')           // spazi -> punti
      .replace(/[^a-z0-9_.-]/g, '')   // solo caratteri sicuri
      .slice(0, 32);

  try {
    // 1) Scegliamo il display name con priorità: override locale > u.display_name > u.name > local-part email
    const display = preferredNameFor(u.email) || u.display_name || u.name || emailLocalPart(u.email);

    // 2) Username tecnico derivato dal display name (niente email tagliata)
    const suggestedUsername = makeUsername(display);

    // 3) Ruolo: preferisci quello richiesto nella card, poi eventuale role già presente
    const roleToApply = u.requested_role || u.role || 'user';

    // 4) Chiamata BE: inviamo name = display per fissare il nome scelto
    await api.approvalsApprove({
      id: u.id,
      name: display,
      email: u.email,
      username: suggestedUsername || undefined,
      role: roleToApply,
    });

    // 5) Rimuovi dalla lista pending
    pending.value = pending.value.filter(x => x.id !== u.id);

    // 6) Pulisci SOLO l'override del ruolo; manteniamo il nome preferito
    try {
      const key = 'flows_preferred_roles';
      const map = JSON.parse(localStorage.getItem(key) || '{}');
      delete map[String(u.email || '').toLowerCase()];
      localStorage.setItem(key, JSON.stringify(map));
    } catch {}

    // 7) Ricarica team e KPI
    await loadTeam();
    kpi.value.usersOnline = team.value.filter(x => x.active).length;
    kpi.value.usersTotal  = team.value.length;

  } catch (e) {
    console.error(e);
    alert('Impossibile approvare la richiesta. Riprova.');
  }
}


// --- overrides ruolo: email -> role ---
const ROLE_OVR_KEY = 'flows_role_overrides_v1';

function readRoleOverrides() {
  try { return JSON.parse(localStorage.getItem(ROLE_OVR_KEY) || '{}') } catch { return {} }
}
function saveRoleOverride(email, role) {
  if (!email) return;
  const map = readRoleOverrides();
  map[email.toLowerCase()] = String(role || 'user').toLowerCase();
  localStorage.setItem(ROLE_OVR_KEY, JSON.stringify(map));
}
function getRoleOverride(email) {
  if (!email) return null;
  const map = readRoleOverrides();
  return map[email.toLowerCase()] || null;
}
function clearRoleOverride(email) {
  if (!email) return;
  const map = readRoleOverrides();
  delete map[email.toLowerCase()];
  localStorage.setItem(ROLE_OVR_KEY, JSON.stringify(map));
}





async function reject(u) {
  pending.value = pending.value.filter(x => x.id !== u.id)
}

async function removeUser(u) {
  const ok = confirm(`Eliminare definitivamente l'utente ${u.username || u.email || u.id}?`)
  if (!ok) return

  if (isSelf(u)) {
    alert('Non puoi eliminare il tuo stesso account.')
    return
  }

  const id = u?.id
  if (id == null || String(id).trim() === '') {
    alert('Impossibile eliminare: id utente mancante.')
    return
  }

  try {
    const res = await fetch(`/admin/api/users/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    let payload = {}
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      payload = await res.json().catch(() => ({}))
    } else {
      payload = { message: await res.text().catch(() => '') }
    }

    if (!res.ok || payload?.ok !== true) {
      const msg = payload?.message || `HTTP ${res.status}`
      throw new Error(msg)
    }

    team.value = team.value.filter(x => x.id !== id)
    kpi.value.usersTotal = Math.max(0, kpi.value.usersTotal - 1)
    if (u.active) kpi.value.usersOnline = Math.max(0, kpi.value.usersOnline - 1)
  } catch (e) {
    console.error('DELETE user failed:', e)
    alert(`Impossibile eliminare l’utente: ${e.message}`)
  }
}

const PREFERRED_KEY = 'flows_preferred_names'
function loadPreferredNames () {
  try { return JSON.parse(localStorage.getItem(PREFERRED_KEY) || '{}') }
  catch { return {} }
}
const preferredNames = ref(loadPreferredNames())

function displayName(u) {
  // priorità: display_name > name > override locale > fallback email local-part
  const override = preferredNameFor(u?.email)
  return u?.display_name || u?.name || override || (u?.email?.split?.('@')[0]) || 'Nuovo utente'
}


// opzionale: utility per aggiornare e persistere quando approvi
function setPreferred(email, username) {
  const mail = String(email || '').toLowerCase()
  preferredNames.value = { ...preferredNames.value, [mail]: username }
  try { localStorage.setItem(PREFERRED_KEY, JSON.stringify(preferredNames.value)) } catch {}
}

// se ascolti l’evento del modal:
window.addEventListener('flows:new-pending', (e) => {
  const { email, username } = e.detail || {}
  if (email && username) setPreferred(email, username)
})
</script>


<style scoped>
/* ==================== TOKENS & LAYOUT BASE ==================== */

/* ==================== TOKENS & LAYOUT BASE ==================== */
:root { --gutter: 24px; }

.layout{
  --sidebar-w: 240px;                     /* allinea alla tua AppSidebar */
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  min-height: 100vh;
  background: #eef2f7;                    /* come Home */
  overflow-x: clip;                        /* evita banda nera a dx */
}

:deep(.sidebar){
  width: var(--sidebar-w) !important;
  min-width: var(--sidebar-w) !important;
  max-width: var(--sidebar-w) !important;
  border-right: 0 !important;
  box-shadow: none !important;
}

.main{
  display: flex;
  flex-direction: column;
  padding: 0 var(--gutter) var(--gutter) 0;  /* 0 | 24 | 24 | 0 come Home */
  color: #0f172a;
  background: transparent;                  /* layout porta già il bg */
  overflow-x: clip;
}

/* ==================== TOPBAR (AppTopbar.vue) ==================== */
.app-topbar{
  box-sizing: border-box;
  height: 64px;
  min-height: 64px;              /* anti-schiacciamento */
  padding: 14px var(--gutter);   /* ⬅️ stesso padding interno */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  background: #fff;
  color: #0b0b0c;
  border-bottom: 1px solid #e6e8ef;
  box-shadow: 0 1px 0 rgba(17,17,17,0.04);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-topbar.fullbleed{
  margin: 0 calc(-1 * var(--gutter)) 16px 0; /* “sborda” a dx di 24px */
  border-radius: 0;
}
.app-topbar > *{ flex-shrink: 0; }
.app-topbar .app-topbar-title{ font-size: 20px; font-weight: 700; margin: 0; }
.app-top-actions{ display:flex; align-items:center; gap:12px; min-width:0; }

/* search pill identica */
.app-search{
  display:flex; align-items:center; gap:8px;
  padding: 6px 10px;
  height: 36px;
  background:#f1f5f9;
  border:1px solid #e6e8ef;     /* bordo leggero come le card */
  border-radius: 10px;
  box-shadow:none;
  flex: 1 1 420px;               /* cresce senza schiacciare la barra */
  max-width: 560px;
  min-width: 210px;
}
.app-search svg{ width:18px; height:18px; color:#6b7280; }
.app-search input{
  border:0; outline:0; background:transparent; width:100%; min-width:0; color:inherit;
}


/* ==================== KPI ==================== */
.kpi {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.kpi-val {
  font-weight: 800;
  font-size: 1.25rem;
  color: #0f172a;
}

/* icone (facoltative, coerenti) */
.kpi-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #eef2ff;
  position: relative;
}.kpi-icon.users{ background:#eef2ff; }
.kpi-icon.orders{ background:#ecfeff; }
.kpi-icon.products { background: #f0fdf4; position: relative; }
.kpi-icon.products::after {
  content: '✓';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 18px;
  color: #16a34a;
  pointer-events: none;
}

/* ==================== CARDS & HEADERS ==================== */
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #e5e7eb;
}
.card-head h3 { margin: 0; font-size: 1rem; color: #6b7280;}
.muted{ color:#6b7280; }

/* ==================== LISTA PENDING ==================== */
.pending-list{ list-style:none; margin:0; padding:0; }
.pending-item{
  display:grid;
  grid-template-columns: 40px 1fr auto auto; /* avatar | meta | ruolo | azioni */
  align-items:center;
  gap:12px;
  padding:8px 12px;
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:12px;
}

.pending-item img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit:cover;
}

.pending-item .meta strong {
  display: block;
  font-size: .95rem;
  color: #111827;
}

.pending-item .meta small {
  color: #6b7280;
}
/* badge ruolo centrato geometricamente */
.pending-item .role-center{
  position: static !important;  /* annulla left/top precedenti */
  inset: auto !important;
  transform: none !important;
  justify-self: center;         /* centra nella colonna */
  pointer-events: auto;
  z-index: auto;
}

.badge-role{
  padding:4px 10px;
  border-radius:9999px;
  background:#eef2ff;
  color:#3b82f6;  
  font-weight:600;
  font-size:12px;
  line-height:1;
  white-space:nowrap;
  min-width:72px;
  text-align:center;
}
.pending-item .actions{
  justify-self: end;
  display: flex;
  gap: 8px;
}

.icon-btn {
  border: none;
  background: #f1f5f9;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  margin-left: 6px;
}
.icon-btn.green { color: #16a34a; }
.icon-btn.red   { color: #ef4444; }
.icon-btn:hover { filter: brightness(.96); }

.pending-item .ok,
.pending-item .ko{
  width:32px; height:32px;
  border-radius:10px; border:0;
  cursor:pointer; color:#fff; font-weight:800;
  display:grid; place-items:center;
  transition: transform .12s ease, filter .12s ease, box-shadow .12s ease;
}
.pending-item .ok{ background:#22c55e; }
.pending-item .ok:hover{ transform:translateY(-1px); filter:brightness(.97); }
.pending-item .ko{ background:#ef4444; }
.pending-item .ko:hover{ transform:translateY(-1px); filter:brightness(.97); }

/* stato vuoto */
.approvals-card .empty{
  color:#64748b; font-size:.9rem; padding:12px 14px 16px;
}

/* ==================== TEAM GRID (carte utenti) ==================== */
/* === Team: versione tabellare identica alla prima pagina === */
.team{ margin-top:16px; }

/* Card contenitore */
.card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:12px;
  overflow:hidden;
}

/* Intestazione card (titolo + “2 membri”) */
.card-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:12px 14px;
  border-bottom:1px solid #e5e7eb;
}
.card-head h3{ margin:0; font-size:1rem; color:#6b7280; }
.muted{ color:#6b7280; }

/* Tabella */
.table{ width:100%; border-collapse:separate; border-spacing:0; }
.table thead th{
  text-align:left;
  font-size:.9rem;
  color:#64748b;
  font-weight:600;
  padding:12px 14px;
  background:#f8fafc;
  border-bottom:1px solid #e5e7eb;
}
.table tbody td{
  padding:12px 14px;
  border-bottom:1px solid #f1f5f9;
  vertical-align:middle;
  background:#fff;
}
.table tbody tr:last-child td{ border-bottom:none; }

/* Cella “Utente” con avatar + nome */
.person{ display:flex; align-items:center; gap:10px; }
.person img{ width:34px; height:34px; border-radius:50%; object-fit:cover; }
.name{ font-weight:600; color:#0f172a; }   /* come in prima pagina */
.small{ font-size:.85rem; }
.t-right{ text-align:right; }

/* Badge di stato (Online/Offline) */
.badge{
  display:inline-block;
  padding:4px 8px;
  border-radius:999px;
  font-size:.75rem;
  font-weight:700;
}
.badge.success{ background:#ecfdf5; color:#16a34a; } /* Online */
.badge.danger { background:#fef2f2; color:#ef4444; } /* Offline */

/* Pulsante azione a destra (icona cestino ecc.) */
.icon-btn{
  border:none;
  background:#f1f5f9;
  padding:6px 8px;
  width:28px; height:28px;
  border-radius:8px;
  cursor:pointer;
  color:#ef4444;         /* icona rossa come nello shot */
  display:inline-grid; place-items:center;
}
.icon-btn:hover{ filter:brightness(.96); }


/* ==================== MODAL & BUTTONS (coerenti) ==================== */
.overlay{
  position:fixed; inset:0; background:rgba(2,6,23,.55);
  display:grid; place-items:center; padding:12px; z-index:9999;
}
.modal{
  width:min(520px,92vw);
  background:#f5f7fb; border-radius:20px; border:1px solid #e5e7eb;
  box-shadow:0 22px 60px rgba(15,23,42,.28);
  padding:28px 28px 22px; position:relative; z-index:1010; overflow:visible;
}
.modal h3{ margin:2px 0 16px; font-size:1.35rem; font-weight:800; text-align:center; color:#0f172a; letter-spacing:.3px; }

.field{ display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.field label{ color:#111; font-weight:600; }
.input, .select, .field input, .field select{
  box-sizing:border-box; width:100%;
  padding:10px 12px; border:1px solid #d5dbe1; border-radius:10px; background:#fff; font-size:14px; color:#111;
}
.field input::placeholder{ color:#6b7280; }
.field select{ margin-bottom:6px; }
.field input:-webkit-autofill{
  -webkit-box-shadow:0 0 0 1000px #e8eef6 inset !important;
  -webkit-text-fill-color:#0f172a !important; caret-color:#0f172a;
}
.hint{ color:#6b7280; font-size:12px; margin-top:4px; display:block; }
.err{ color:#dc2626; margin-top:4px; }
.ok{ color:#059669; margin-top:4px; }

.btns{ display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }
.btn{ height:44px; padding:0 18px; border-radius:12px; border:none; cursor:pointer; font-weight:800; }
.btn.secondary{ background:#e2e8f0; color:#0f172a; }
.btn.primary{ background:#10b981; color:#fff; box-shadow:0 8px 24px rgba(16,185,129,.22); }
.btn.primary:hover{ filter:brightness(1.03); }
.btn:disabled{ opacity:.7; cursor:not-allowed; }

.fab-new-user{
  position: fixed; right: 24px; bottom: 24px; z-index: 1000;
  display:inline-flex; align-items:center; justify-content:center;
  width:56px; height:56px; padding:0; border-radius:50%; border:none;
  background:#10b981; color:#fff; font-weight:700; cursor:pointer;
  box-shadow:0 6px 20px rgba(0,0,0,.15);
  transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease, background .12s ease;
  font-size:0;
}
.fab-new-user::after{ content:'+'; font-size:28px; line-height:1; }
.fab-new-user:hover{ box-shadow:0 10px 24px rgba(0,0,0,.18); background:#0ea371; }
.fab-new-user:active{ box-shadow:0 6px 16px rgba(0,0,0,.12); background:#0c8c6d; }
.fab-new-user:focus-visible{ outline:3px solid rgba(16,185,129,.35); outline-offset:2px; }
.fab-new-user:disabled{ opacity:.6; cursor:not-allowed; transform:none; box-shadow:0 6px 16px rgba(0,0,0,.12); background:#10b981; }

/* ==================== RESPONSIVE ==================== */
@media (max-width: 1100px){
  .kpi{ grid-template-columns: 1fr; }
}
@media (max-width: 768px){
  .app-search{ flex:1 1 220px; }
}
@media (max-width: 560px){
  .pending-item{ grid-template-columns: 36px 1fr auto; }
  .badge-role{ min-width:72px; font-weight:600; }
}

.user-row { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; background:#fff; }
.meta .name { color:#0f172a; }
.meta .role { color:#6b7280; }
.chip { font-size:12px; padding:4px 8px; border-radius:9999px; }
.chip.online { background:#e8f7ee; color:#1f9254; }
.chip.offline { background:#f3f4f6; color:#374151; }

</style>


