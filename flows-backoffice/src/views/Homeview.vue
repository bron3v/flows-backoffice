<template>
  <div class="layout">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main area -->
    <main class="main">
      <!-- Topbar -->
      <header class="topbar">
        <h1>Dashboard</h1>
        <div class="top-actions">
          <div class="search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21 21l-3.8-3.8M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
            </svg>
            <input placeholder="Search..." v-model="q" />
          </div>

          <!-- Avatar: usa username -->
          <AvatarCard
            :avatar-initial="avatarInitial"
            :user-name="sessionUser?.username || 'Utente'"
            :user-email="sessionUser?.username || 'username'"
          />
        </div>
      </header>

      <!-- Content grid -->
      <section class="content">
        <!-- Colonna dashboard -->
        <section class="dashboard">
          <!-- KPI -->
          <div class="kpi-row">
            <div class="kpi">
              <div class="kpi-icon users"></div>
              <div>
                <div class="kpi-val">{{ kpi.usersTotal }}</div>
                <div class="kpi-label">Utenti totali</div>
              </div>
            </div>
            <div class="kpi">
              <div class="kpi-icon orders"></div>
              <div>
                <div class="kpi-val">{{ kpi.usersOnline }}</div>
                <div class="kpi-label">Utenti online</div>
              </div>
            </div>
            <div class="kpi">
              <div class="kpi-icon products"></div>
              <div>
                <div class="kpi-label">{{ systemName }}</div>
              </div>
            </div>
          </div>

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

          <!-- Tabella utenti (Team) -->
          <div class="card">
            <div class="card-head">
              <h3>Team</h3>
              <span class="muted">{{ filteredTeam.length }} membri</span>
            </div>

            <p v-if="teamError" class="err" style="margin: 6px 12px 0;">
              {{ teamError }}
            </p>

            <table class="table" v-if="!teamError">
              <thead>
                <tr>
                  <th>Utente</th>
                  <th>Online</th>
                  <th>Ruolo</th>
                  <th class="t-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in filteredTeam" :key="m.id">
                  <td class="person">
                    <img :src="m.avatar || defaultAvatar" alt="" />
                    <div>
                      <div class="name">{{ m.name }}</div>

                    </div>
                  </td>

                  <td>
                    <span class="badge success" v-if="m.active">Online</span>
                    <span class="badge danger"  v-else>Offline</span>
                  </td>

                  <td class="role">{{ m.role }}</td>

                  <td class="t-right">
                    <div class="actions">
                      <button
                        v-if="!isSelf(m)"
                        class="icon-btn red"
                        title="Delete"
                        @click="removeUser(m)"
                      >🗑</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from '../components/AppSidebar.vue'
import { api } from '@/utils/api'
import AvatarCard from '@/components/AvatarCard.vue'

// stato base
const router = useRouter()
const route = useRoute()
const defaultAvatar = 'https://i.pravatar.cc/40?img=1'

const avatarInitial = ref('A')
const systemName   = ref('Flows system')
const sessionUser  = ref(null)

const kpi = ref({ usersTotal: 0, usersOnline: 0 })

const pending = ref([])
const team    = ref([])

const q = ref('') // filtro ricerca

function isSelf(u) {
  const me = sessionUser.value
  if (!me) return false
  if (me.id != null && u.id != null && String(u.id) === String(me.id)) return true
  if (me.username && u.username && String(u.username).toLowerCase() === String(me.username).toLowerCase()) return true
  return false
}

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


function prettyRole(r) {
  const m = {
    admin: 'Admin',
    user: 'User',
    user_manager: 'User Manager',
    logs_manager: 'Logs Manager'
  }
  return m[(r || '').toLowerCase()] || 'User'
}

function displayRole(u) {
  // fallback robusto: label → pretty(role) → 'User'
  return u?.roleLabel || prettyRole(u?.role) || 'User'
}

function normalizePendingList(list) {
  return (list || []).map(p => {
    const role = p.role || 'user'
    const roleLabel = p.roleLabel || prettyRole(role)
    return { ...p, role, roleLabel }
  })
}




async function loadPendingFromBackend() {
  try {
    const data = await api.approvalsList() // es: { ok:true, items:[...] } o { approvals:[...] }
    const items = Array.isArray(data?.items) ? data.items
               : Array.isArray(data?.approvals) ? data.approvals
               : []
    // normalizza struttura
    return items.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      avatar: r.avatar || 'https://i.pravatar.cc/40?img=54',
      role: r.role || 'user',
      roleLabel: prettyRole(r.role || 'user')
    }))
  } catch {
    // se l’endpoint non esiste ancora o fallisce, usa il locale
    return loadPendingLocally()
  }
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
  try {
    // ✅ priorità: u.username (se già presente) -> derivato da u.name -> local-part email
    const desiredUsername =
      (u.username && String(u.username).trim()) ||
      makeUsernameFromName(u.name) ||
      (u.email && String(u.email).split('@')[0]) ||
      ''

    const res = await api.approvalsApprove({
      id: u.id,
      name: u.name,                 // mantiene il nome della card
      email: u.email,
      username: desiredUsername || undefined
    })

    if (!res?.ok) throw new Error(res?.message || 'Errore approvazione')

    // 🔹 salva override locale: email -> username desiderato (NON il local-part)
    saveNameOverride(u.email, desiredUsername)

    // rimuovi dalla lista pending
    pending.value = pending.value.filter(x => x.id !== u.id)

    // ricarica il team dal backend...
    await loadTeam()

    // ...e forza comunque l'username in UI per coerenza immediata
    const mail = String(u.email || '').toLowerCase()
    team.value = team.value.map(m =>
      String(m.email || '').toLowerCase() === mail
        ? { ...m, username: desiredUsername }
        : m
    )

    // KPI
    kpi.value.usersOnline = team.value.filter(x => x.active).length
    kpi.value.usersTotal  = team.value.length
  } catch (e) {
    console.error(e)
    alert('Impossibile approvare la richiesta. Riprova.')
  }
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
  const mail = String(u?.email || '').toLowerCase()
  const preferred = preferredNames.value[mail]
  // priorità: preferito FE → username DB → name → local-part
  return preferred || u?.username || u?.name || (mail && mail.split('@')[0]) || 'Nuovo utente'
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
/* Layout base */
.layout {
  display: flex;
  background: #eef2f7;
  min-height: 100vh;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Topbar */
.topbar {
  height: 64px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  position: sticky;
  top: 0;
  z-index: 5;
}

.topbar h1 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f1f5f9;
  padding: 6px 10px;
  border-radius: 10px;
}

.search svg {
  width: 18px;
  height: 18px;
  color: #6b7280;
}

.search input {
  border: none;
  outline: none;
  background: transparent;
  min-width: 210px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #22c55e;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
}

/* Content grid */
.content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  padding: 18px;
}

.pending-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pending-item {
  display: grid;
  grid-template-columns: 40px 1fr auto auto; /* avatar | meta | ruolo | azioni */
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.pending-item img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}


.pending-item .meta strong {
  display: block;
  font-size: .95rem;
  color: #111827;
}

.pending-item .meta small {
  color: #6b7280;
}

.pending-item .actions {
  display: flex;
  gap: 6px;
}

.ok,
.ko {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  color: #fff;
  font-weight: 700;
}

.ok { background: #22c55e; }
.ok:hover { filter: brightness(.95); }

.ko { background: #ef4444; }
.ko:hover { filter: brightness(.95); }

.empty {
  color: #64748b;
  font-size: .9rem;
  padding: 8px;
}

/* Dashboard column */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.role{
  color: #64748b;
}

/* KPI cards */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.role-center {
  justify-self: center;      /* vero centro della riga */
}

.pending-item .actions {
  justify-self: end;         /* bottoni a destra */
}

.kpi {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.kpi-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #eef2ff;
  position: relative;
}

.kpi-icon.users { background: #eef2ff; }
.kpi-icon.orders { background: #ecfeff; }

.kpi-val {
  font-weight: 800;
  font-size: 1.25rem;
  color: #0f172a;
}
.kpi-label { color: #64748b; }

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

/* Table card */
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

.card-head h3 { margin: 0; font-size: 1rem; }
.muted { color: #6b7280; }

.table { width: 100%; border-collapse: separate; border-spacing: 0; }

.table thead th {
  text-align: left;
  font-size: .9rem;
  color: #64748b;
  font-weight: 600;
  padding: 12px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.table tbody td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.person {
  display: flex;
  align-items: center;
  gap: 10px;
}
.person img { width: 34px; height: 34px; border-radius: 50%; }

.name { font-weight: 600; color: #64748b}
.small { font-size: .85rem; }
.t-right { text-align: right; }

.badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 700;
}
.badge.success { background: #ecfdf5; color: #16a34a; }
.badge.danger  { background: #fef2f2; color: #ef4444; }

.badge-role {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 9999px;
  background: #eef2ff;
  color: #3b82f6;
  font-weight: 600;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;        
  min-width: 72px;            
  text-align: center;
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

/* Responsive */
@media (max-width: 1100px) {
  .content { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .kpi-row { grid-template-columns: 1fr; }
}
</style>
