<template>
  <div class="layout">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main area -->
    <main class="main">
      <!-- Topbar -->
      <!-- Topbar -->
      <AppTopbar
        class="topbar-card full-bleed"
        title="Dashboard"
        v-model="q"
        :session-user="sessionUser"
        :avatar-initial="avatarInitial"
        :full-bleed="true"
        @search="onSearch"
        @profile="openProfile"
      />    


      <!-- Content grid -->
      <section class="content">
        <!-- Colonna dashboard -->
        <section class="dashboard">
          <!-- KPI -->
          <div class="kpi-row">
            <div class="kpi">
              <div class="kpi-icon users" :style="iconStyle(usersIcon)"></div>
              <div>
                <div class="kpi-val">{{ kpi.usersTotal }}</div>
                <div class="kpi-label">Utenti totali</div>
              </div>
            </div>

            <div class="kpi">
              <div class="kpi-icon orders" :style="iconStyle(onlineUsersIcon)"></div>
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
                  <th>Ultimo accesso</th>
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

                  <td class="role">{{ prettyRole(m.role) }}</td>

                  <td class="t-right">
                    <div class="actions">
                      <button v-if="!isSelf(m)" class="icon-btn blue sm" title="Modifica" @click="editUser(m)">
                        <span class="ico">✏︎</span>
                      </button>

                      <button v-if="!isSelf(m)" class="icon-btn red sm" title="Delete" @click="removeUser(m)">
                        <span class="ico">🗑</span>
                      </button>
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
import AppTopbar from '@/components/AppTopBar.vue'   
import usersIcon from '@/assets/users.png'
import onlineUsersIcon from '@/assets/onlineUsers.png'

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

const iconStyle = (src) => ({
  backgroundImage: `url(${src})`
})

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
  const term = q.value.trim().toLowerCase();

  // id/username dell'utente di sessione
  const me = sessionUser.value;
  const meId = me?.id != null ? String(me.id) : null;
  const meUser = team.value.find(u =>
    (meId && String(u.id) === meId) ||
    (!!me?.username && String(u.username || '').toLowerCase() === String(me.username).toLowerCase())
  );

  // 1) filtra per ricerca (escludendo me: lo aggiungiamo sopra)
  let others = team.value.filter(u => {
    const isMe =
      (meId && String(u.id) === meId) ||
      (!!me?.username && String(u.username || '').toLowerCase() === String(me.username).toLowerCase());
    if (isMe) return false;

    if (!term) return true;
    return (
      String(u.username || '').toLowerCase().includes(term) ||
      String(u.name || '').toLowerCase().includes(term)
    );
  });

  // 2) ordina per ultimo accesso (null in fondo)
  others.sort((a, b) => {
    const ta = a.lastSeenTs ?? -1;
    const tb = b.lastSeenTs ?? -1;
    return tb - ta; // desc
  });

  // 3) costruisci la lista finale: me sempre primo (se presente), poi gli altri
  const result = [];
  if (meUser) result.push(meUser);
  result.push(...others);

  // 4) limita a 5 mantenendo "me" in testa
  return result.slice(0, 5);
});



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

function displayRole(u) {
  // fallback robusto: label → pretty(role) → 'User'
  return u?.roleLabel || prettyRole(u?.role) || 'User'
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

function toTs(v) {
  if (v == null) return null;
  // accetta number (epoch ms/s) o stringhe ISO
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  const n = Date.parse(String(v));
  return Number.isNaN(n) ? null : n;
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

  // prendi il timestamp dal primo campo disponibile tra quelli comuni
  const lastSeenTs =
    toTs(u.lastSeenTs) ??
    toTs(u.last_seen_ts) ??
    toTs(u.lastSeen) ??
    toTs(u.last_seen) ??
    toTs(u.lastLoginAt) ??
    toTs(u.last_login_at) ??
    toTs(u.last_login) ??
    toTs(u.lastActiveAt) ??
    toTs(u.last_active_at) ??
    toTs(u.heartbeat) ??
    toTs(u.updated_at) ?? null;

  return {
    id: u.id ?? null,
    username: u.username ?? null,
    name: override || u.name || u.username || (u.email && String(u.email).split('@')[0]) || 'Utente',
    email: u.email || '',
    active: !!(u.online ?? u.active),
    role: rawRole || 'user',
    roleLabel: prettyRole(rawRole || 'user'),
    avatar: u.avatar,
    lastSeenTs, 
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

/* ──────────────────────────────────────────────
   LAST SEEN — helpers robusti
   ────────────────────────────────────────────── */

// Normalizza vari formati di timestamp (ms, sec, ISO)
function toMs(t) {
  if (t == null || t === '' || t === false) return 0
  // numerico?
  const n = Number(t)
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    // euristica: se < 1e12 lo considero secondi, altrimenti millisecondi
    return n < 1e12 ? n * 1000 : n
  }
  // stringa ISO o data
  const d = new Date(String(t))
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : 0
}

// Estrae il lastSeen in ms da vari possibili campi BE
function deriveLastSeenMs(obj) {
  // ordine di priorità su diversi nomi comuni
  const candidates = [
    obj?.last_seen_ts, obj?.lastSeenTs,
    obj?.last_seen, obj?.lastSeen,
    obj?.last_seen_at, obj?.lastSeenAt, obj?.lastSeenISO,
    obj?.user?.last_seen_ts, obj?.user?.last_seen, obj?.user?.lastSeenAt
  ]
  for (const c of candidates) {
    const ms = toMs(c)
    if (ms > 0) return ms
  }
  return 0
}

// Formatta "tempo fa" in italiano
function timeAgo(ms) {
  if (!ms || ms <= 0) return 'mai'
  const diff = Date.now() - ms
  if (diff < 0) return 'adesso'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'pochi secondi fa'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min fa`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} h fa`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d} g fa`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m} mesi fa`
  const y = Math.floor(m / 12)
  return `${y} anni fa`
}

// Ritorna la label pronta per la UI (“Ultimo accesso: …” / “Online”)
function lastSeenText(u) {
  // se il backend espone già "online"/"active" lo usiamo come verità di stato
  const online = !!(u.online ?? u.active)
  if (online) return 'online'
  const ms = u.lastSeenMs || 0
  const label = timeAgo(ms)
  // se non abbiamo info → “mai”
  return label === 'mai' ? 'ultimo accesso: mai' : `ultimo accesso: ${label}`
}

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

.kpi-icon{
  width: 42px;
  height: 42px;
  border-radius: 12px;
  position: relative;
  background-color: #f1f5f9;      /* base neutra */
  background-repeat: no-repeat;
  background-position: center;
  background-size: 70% 70%;       /* scala l’icona dentro il quadrato */
}

/* opzionale: tinte di sfondo coerenti come prima */
.kpi-icon.users  { background-color: #eef2ff; }
.kpi-icon.orders { background-color: #ecfeff; }

/* lasciamo invariato il products con il ✓ */


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

.card-head h3 { margin: 0; font-size: 1rem; color: #6b7280;}
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

/* Riga grid: avatar | meta | centro | azioni */
/* Riga: avatar | meta | azioni ; il badge sarà assoluto, quindi non serve una colonna dedicata */
.pending-item{
  position: relative;                 /* 👈 necessaria per l'assoluto del badge */
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 12px;
}

/* Azioni allineate a destra */
.pending-item .actions{
  justify-self: end;
  display: flex;
  gap: 8px;
}

/* Contenitore del badge assoluto, al centro geometrico della riga */
.pending-item .role-center{
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);   
  pointer-events: none;               /* evita di "coprire" i bottoni */
  z-index: 1;                         /* sopra il contenuto, ma non cliccabile */
}

/* Stile badge (il tuo) */
.badge-role{
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

:root { --gutter: 24px; }

/* Colonna principale: stesso gutter dei componenti */
.main{
  padding: 0 var(--gutter) var(--gutter) 0; /* top 0 | right 24 | bottom 24 | left 0 */
  overflow-x: clip; /* niente scroll orizzontale per sbordi full-bleed */
}

/* Topbar: stessa altezza e padding interno dei componenti */
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

/* Full-bleed: attacca la topbar ai bordi della pagina come in Home */
.app-topbar.fullbleed{
  margin: 0 calc(-1 * var(--gutter)) 16px 0; /* “sborda” a dx di 24px */
  border-radius: 0;
}

/* Evita che i figli comprimano la barra */
.app-topbar > * { flex-shrink: 0; }
.app-topbar-title { font-size: 20px; font-weight: 700; margin: 0; }

/* Azioni + search: stessi spazi dei componenti */
.app-top-actions{ display:flex; align-items:center; gap:12px; min-width:0; }

/* Search pill coerente con il sistema */
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

/* Titoli interni: no collasso margini */
.app-topbar :where(h1,.title){ margin-top:0; }

/* Responsive */
@media (max-width: 768px){
  .app-search{ flex:1 1 220px; }
}

.icon-btn { border: none; background: #f1f5f9; padding: 6px 8px; border-radius: 8px; cursor: pointer; margin-left: 6px; }
.icon-btn:hover { filter: brightness(.96); }
.icon-btn.green { color: #16a34a; }
.icon-btn.red   { color: #ef4444; }
.icon-btn.blue  { color: #2563eb; } 

/* versione “stretta” uguale per tutti i bottoni icona */
.icon-btn.sm{
  width: 32px;
  height: 32px;
  padding: 0;                 /* niente padding, così è quadrato */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

/* normalizza la resa del glifo/emoji */
.icon-btn .ico{
  display: block;
  font-size: 16px;            /* riduci se serve: 14–16px */
  line-height: 1;
}

</style>
