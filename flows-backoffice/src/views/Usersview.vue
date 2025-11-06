<template>
  <div class="layout">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main area -->
    <main class="main">
      <!-- Topbar identica alla prima pagina -->
      <AppTopbar
        class="topbar-card full-bleed"
        title="Utenti"
        v-model="q"
        :session-user="sessionUser"
        :avatar-initial="avatarInitial"
        :full-bleed="true"
        @search="onSearch"
        @profile="openProfile"
      />

      <!-- Content grid -->
      <section class="content">
        <section class="dashboard">

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

            <!--Utenti da approvare -->
            <div class="kpi">
              <div class="kpi-icon pending" :style="iconStyle(pendingUsersIcon)"></div>
              <div>
                <div class="kpi-val">{{ pending.length }}</div>
                <div class="kpi-label">Utenti da approvare</div>
              </div>
            </div>
          </div>
          <!-- Utenti da approvare -->
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

          <!-- Tabella utenti (Team) identica alla prima pagina -->
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in filteredTeam" :key="m.id">
                  <td class="person">
                    <img :src="m.avatar || defaultAvatar" alt="" />
                    <div>
                      <div class="name">{{ m.name }}</div>
                      <div class="email">{{ m.email }}</div>
                    </div>
                  </td>

                  <td>
                    <span class="badge success" v-if="m.active">Online</span>
                    <span class="badge danger" v-else>Offline</span>
                  </td>

                  <td class="role">{{ prettyRole(m.role) }}</td>

                  <td>
                    <span v-if="m.active" class="chip online">Online ora</span>
                    <span v-else class="chip offline">
                      {{ timeAgo(m.lastSeenTs) }}
                    </span>
                  </td>

                  <td class="t-right">
                    <div class="actions">
                      <button
                        v-if="!isSelf(m)"
                        class="icon-btn blue sm"
                        title="Modifica"
                        @click="editUser(m)"
                      >
                        <span class="ico">✏︎</span>
                      </button>

                      <button
                        v-if="!isSelf(m)"
                        class="icon-btn red sm"
                        title="Delete"
                        @click="removeUser(m)"
                      >
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

    <!-- FAB New user (unica differenza visibile aggiuntiva) -->
    <button
      class="fab-new-user"
      @click="openModal"
      :disabled="loading"
      aria-label="Create new user"
    >
      <!-- icona centrata -->
      <span
        v-if="!loading"
        class="fab-icon"
        :style="iconStyleFab(addUserIcon)"
      ></span>

      <!-- testo solo in stato loading -->
      <span v-else class="fab-label">Invio…</span>
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
                <option value="admin">Admin</option>
              </select>
              <small class="hint">
                L’amministratore può confermare o modificare il ruolo richiesto.
              </small>
            </div>

            <p v-if="error" class="err">{{ error }}</p>
            <p v-if="ok" class="ok">Richiesta inviata! Controlla la casella di posta.</p>

            <div class="btns">
              <button
                type="button"
                class="btn secondary"
                @click="closeModal"
                :disabled="loading"
              >
                Annulla
              </button>
              <button class="btn primary" :disabled="loading || ok">
                {{ loading ? 'Creazione…' : 'Crea Utente' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopBar.vue'
import { api } from '@/utils/api'
import usersIcon from '@/assets/users.png'
import onlineUsersIcon from '@/assets/onlineUsers.png'
import addUserIcon from '@/assets/addUser.png'
import pendingUsersIcon from '@/assets/pendingUser.png'

const router = useRouter()
const route = useRoute()
const defaultAvatar = 'https://i.pravatar.cc/40?img=1'

const avatarInitial = ref('A')
const sessionUser = ref(null)

const kpi = ref({ usersTotal: 0, usersOnline: 0 })
const pending = ref([])
const team = ref([])

const q = ref('')
const loading = ref(false)

const show = ref(false)
const name = ref('')
const email = ref('')
const role = ref('user')
const error = ref('')
const ok = ref(false)

const ALLOWED_ROLES = new Set(['user', 'user_manager', 'logs_manager', 'admin'])

const iconStyle = (src) => ({
  backgroundImage: `url(${src})`
})


const iconStyleFab = (src) => ({
  backgroundImage: `url(${src})`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: '80% 80%',      // dimensione icona
  filter: 'brightness(0) invert(1)' // rende l'icona bianca
})

function isSelf(u) {
  const me = sessionUser.value
  if (!me) return false
  if (me.id != null && u.id != null && String(u.id) === String(me.id)) return true
  if (me.username && u.username &&
    String(u.username).toLowerCase() === String(me.username).toLowerCase()
  ) return true
  return false
}

/* ---------------- Heartbeat ---------------- */
let heartbeatTimer = null
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    fetch('/me/ping', { method: 'POST', credentials: 'include' }).catch(() => {})
  }, 10_000)
}
function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetch('/me/ping', { method: 'POST', credentials: 'include' }).catch(() => {})
  }
})

/* ---------------- Helpers ---------------- */
function prettyRole(role) {
  const k = String(role || '').toLowerCase()
  return ({
    admin: 'Admin',
    user_manager: 'User Manager',
    logs_manager: 'Logs Manager',
    user: 'User'
  })[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'User')
}

function normalizePendingList(list) {
  return (list || []).map(p => {
    const raw = p.role ?? p.requested_role ?? p.requestedRole ?? null
    const role = String(raw || 'user').toLowerCase()
    const roleLabel = p.roleLabel || prettyRole(role)
    return { ...p, role, roleLabel }
  })
}

function savePendingLocally(list) {
  try {
    localStorage.setItem('flows_pending', JSON.stringify(normalizePendingList(list)))
  } catch {}
}

function loadPendingLocally() {
  try {
    const saved = localStorage.getItem('flows_pending')
    return saved ? JSON.parse(saved) : samplePending()
  } catch {
    return samplePending()
  }
}

function preferredNameFor(email) {
  try {
    const key = 'flows_preferred_names'
    const map = JSON.parse(localStorage.getItem(key) || '{}')
    return map[String(email || '').toLowerCase()] || ''
  } catch {
    return ''
  }
}

async function loadPendingFromBackend() {
  const data = await api.approvalsList().catch(() => ({}))
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.approvals)
      ? data.approvals
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
  const byKey = new Map()
  ;[...serverList, ...localList].forEach(x => {
    const key = x.id ?? x.email
    if (!byKey.has(key)) byKey.set(key, x)
  })
  return [...byKey.values()]
}

function toTs(v) {
  if (v == null || v === '' || v === 0 || v === '0') return null
  const n = Number(v)
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    if (n <= 0) return null
    return n < 1e12 ? n * 1000 : n
  }
  const parsed = Date.parse(String(v))
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : null
}

function timeAgo(ms) {
  if (!ms || ms <= 0) return 'mai'
  const diff = Date.now() - ms
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

function displayName(u) {
  const override = preferredNameFor(u?.email)
  return u?.display_name || u?.name || override || (u?.email?.split?.('@')[0]) || 'Nuovo utente'
}

/* ---------------- Team & KPI ---------------- */
const teamError = ref('')

async function loadStats() {
  try {
    const s = await api.stats()
    const st = s?.stats || s || {}
    kpi.value.usersTotal = Number(st.usersTotal ?? st.totalUsers ?? kpi.value.usersTotal ?? 0)
    kpi.value.usersOnline = Number(
      st.usersOnline ?? st.onlineUsers ?? kpi.value.usersOnline ?? 0
    )
  } catch {
    // usa i dati del team se fallisce
  }
}

async function loadTeam() {
  teamError.value = ''
  try {
    const data = await api.usersList()
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.users)
        ? data.users
        : []

    team.value = items.map(u => {
      const override = preferredNameFor(u.email)
      const rawRole = (u.role || u.user?.role || '').toString().toLowerCase()

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
        null

      return {
        id: u.id ?? null,
        username: u.username ?? null,
        name:
          override ||
          u.name ||
          u.username ||
          (u.email && String(u.email).split('@')[0]) ||
          'Utente',
        email: u.email || '',
        active: !!(u.online ?? u.active),
        role: rawRole || 'user',
        roleLabel: prettyRole(rawRole || 'user'),
        avatar: u.avatar,
        lastSeenTs
      }
    })

    kpi.value.usersOnline = team.value.filter(x => x.active).length
    kpi.value.usersTotal = team.value.length
  } catch (e) {
    console.error('GET /admin/api/users failed:', e)
    team.value = []
    teamError.value = 'Impossibile caricare gli utenti'
  }
}

const filteredTeam = computed(() => {
  const term = q.value.trim().toLowerCase()

  const me = sessionUser.value
  const meId = me?.id != null ? String(me.id) : null
  const meUser = team.value.find(
    u =>
      (meId && String(u.id) === meId) ||
      (!!me?.username &&
        String(u.username || '').toLowerCase() ===
          String(me.username).toLowerCase())
  )

  let others = team.value.filter(u => {
    const isMe =
      (meId && String(u.id) === meId) ||
      (!!me?.username &&
        String(u.username || '').toLowerCase() ===
          String(me.username).toLowerCase())
    if (isMe) return false

    if (!term) return true
    return (
      String(u.username || '').toLowerCase().includes(term) ||
      String(u.name || '').toLowerCase().includes(term)
    )
  })

  others.sort((a, b) => {
    const ta = a.lastSeenTs ?? -1
    const tb = b.lastSeenTs ?? -1
    return tb - ta
  })

  const result = []
  if (meUser) result.push(meUser)
  result.push(...others)

  return result.slice(0, 5)
})

/* ---------------- Approvals actions ---------------- */
async function approve(u) {
  const emailLocalPart = s => String(s || '').toLowerCase().split('@')[0] || ''
  const makeUsername = fullName =>
    String(fullName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 32)

  try {
    const display =
      preferredNameFor(u.email) || u.display_name || u.name || emailLocalPart(u.email)

    const suggestedUsername = makeUsername(display)
    const roleToApply = u.requested_role || u.role || 'user'

    await api.approvalsApprove({
      id: u.id,
      name: display,
      email: u.email,
      username: suggestedUsername || undefined,
      role: roleToApply
    })

    pending.value = pending.value.filter(x => x.id !== u.id)

    await loadTeam()
    kpi.value.usersOnline = team.value.filter(x => x.active).length
    kpi.value.usersTotal = team.value.length
  } catch (e) {
    console.error(e)
    alert('Impossibile approvare la richiesta. Riprova.')
  }
}

async function reject(u) {
  pending.value = pending.value.filter(x => x.id !== u.id)
}

async function removeUser(u) {
  const okC = confirm(
    `Eliminare definitivamente l'utente ${u.username || u.email || u.id}?`
  )
  if (!okC) return

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
    if (u.active) {
      kpi.value.usersOnline = Math.max(0, kpi.value.usersOnline - 1)
    }
  } catch (e) {
    console.error('DELETE user failed:', e)
    alert(`Impossibile eliminare l’utente: ${e.message}`)
  }
}

/* ---------------- Bootstrap ---------------- */
async function bootstrap() {
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

  await loadStats()

  const serverPending = await loadPendingFromBackend()
  const localPending = loadPendingLocally()
  pending.value = mergePending(localPending, serverPending)

  await loadTeam()
}

async function onFocusRefresh() {
  await refreshUsersAndKpi()
}

async function refreshUsersAndKpi() {
  await Promise.all([loadTeam(), loadStats().catch(() => {})])
  kpi.value.usersOnline = team.value.filter(x => x.active).length
  kpi.value.usersTotal = team.value.length
}

function onNewPending(e) {
  const item = e.detail
  if (!item || !item.id) return
  const norm = normalizePendingList([item])[0]
  if (!pending.value.some(p => p.id === norm.id)) {
    pending.value = [norm, ...pending.value]
  }
}

/* ---------------- Search & profile ---------------- */
function onSearch(term) {
  q.value = term
}
function openProfile() {
  // router.push('/profile') se serve
}

/* ---------------- Modal New User ---------------- */
function resetModal() {
  name.value = ''
  email.value = ''
  role.value = 'user'
  loading.value = false
  error.value = ''
  ok.value = false
}

function openModal() {
  resetModal()
  show.value = true
  nextTick(() => {
    document
      .querySelector('.modal input[type="text"]')
      ?.focus()
  })
}

function closeModal() {
  show.value = false
  resetModal()
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '')
}

function makeUsername(fullName) {
  return String(fullName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 32)
}

async function submit() {
  if (loading.value || ok.value) return
  error.value = ''

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

  const payload = {
    name: desiredDisplayName,
    email: normalizedEmail,
    username: suggestedUsername,
    requested_role: role.value
  }

  loading.value = true

  try {
    const res = await api.approvalsApprove(payload)
    if (!res?.ok) {
      throw Object.assign(new Error(res?.message || 'approve_failed'), {
        status: res?.status || 500,
        data: res
      })
    }

    await loadTeam()
    ok.value = true
    setTimeout(closeModal, 700)
  } catch (e) {
    const msg = e?.data?.message || e?.message || ''
    if (e?.status === 401) error.value = 'Sessione scaduta. Esegui di nuovo il login.'
    else if (e?.status === 409)
      error.value = 'Utente già esistente per questa email/username'
    else if (e?.status === 400) error.value = msg || 'Dati non validi'
    else error.value = msg || 'Errore durante la creazione e l’invio email'
  } finally {
    loading.value = false
  }
}

/* ---------------- Lifecycle ---------------- */
let intervalId = null

onMounted(() => {
  bootstrap()
  startHeartbeat()
  window.addEventListener('focus', onFocusRefresh)
  window.addEventListener('flows:new-pending', onNewPending)
  intervalId = setInterval(refreshUsersAndKpi, 30_000)
})

onBeforeUnmount(() => {
  stopHeartbeat()
  window.removeEventListener('focus', onFocusRefresh)
  window.removeEventListener('flows:new-pending', onNewPending)
  if (intervalId) clearInterval(intervalId)
})

watch(pending, v => savePendingLocally(v), { deep: true })

/* ---------------- Fallback pending ---------------- */
function samplePending() {
  return [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      avatar: 'https://i.pravatar.cc/40?img=11',
      role: 'user',
      roleLabel: prettyRole('user')
    }
  ]
}

/* placeholder per editUser se serve altrove */
function editUser(u) {
  console.log('edit user', u)
}
</script>

<style scoped>
/* Layout & topbar identici alla prima pagina */
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

:root {
  --gutter: 24px;
}

.main {
  padding: 0 var(--gutter) var(--gutter) 0;
  overflow-x: clip;
}

.app-topbar {
  box-sizing: border-box;
  height: 64px;
  min-height: 64px;
  padding: 14px var(--gutter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fff;
  color: #0b0b0c;
  border-bottom: 1px solid #e6e8ef;
  box-shadow: 0 1px 0 rgba(17, 17, 17, 0.04);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-topbar.full-bleed {
  margin: 0 calc(-1 * var(--gutter)) 16px 0;
  border-radius: 0;
}

.app-topbar > * {
  flex-shrink: 0;
}

.app-topbar-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.app-top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.app-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  height: 36px;
  background: #f1f5f9;
  border: 1px solid #e6e8ef;
  border-radius: 10px;
  box-shadow: none;
  flex: 1 1 420px;
  max-width: 560px;
  min-width: 210px;
}

.app-search svg {
  width: 18px;
  height: 18px;
  color: #6b7280;
}

.app-search input {
  border: 0;
  outline: 0;
  background: transparent;
  width: 100%;
  min-width: 0;
  color: inherit;
}

/* Content grid */
.content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  padding: 18px;
}

/* Dashboard column */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* KPI row (come prima pagina, ma solo 2 card) */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.kpi-icon.pending {
  background-color: #fff7ed;      
  background-image: none;         
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
  position: relative;
  background-color: #f1f5f9;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 70% 70%;
}
.kpi-icon.users {
  background-color: #eef2ff;
}
.kpi-icon.orders {
  background-color: #ecfeff;
}

.kpi-val {
  font-weight: 800;
  font-size: 1.25rem;
  color: #0f172a;
}
.kpi-label {
  color: #64748b;
}

/* Cards & table identici */
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
.card-head h3 {
  margin: 0;
  font-size: 1rem;
  color: #6b7280;
}
.muted {
  color: #6b7280;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.table thead th {
  text-align: left;
  font-size: 0.9rem;
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
.person img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
}
.name {
  font-weight: 600;
  color: #64748b;
}
.t-right {
  text-align: right;
}

.badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}
.badge.success {
  background: #ecfdf5;
  color: #16a34a;
}
.badge.danger {
  background: #fef2f2;
  color: #ef4444;
}

.chip {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}
.chip.online {
  background: #ecfdf5;
  color: #16a34a;
}
.chip.offline {
  background: #f3f4f6;
  color: #374151;
}

/* Pending list come prima pagina */
.pending-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  gap: 0; 
}
.pending-item {
  position: relative;
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  border-radius: 0;       /* niente card separate */
  border: 0;              /* reset */
  border-top: 1px solid #e5e7eb;   /* separatore sottile tra righe */
}

/* niente bordo sopra la prima riga */
.pending-item:first-child {
  border-top: none;
}
.pending-item img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.pending-item .meta strong {
  display: block;
  font-size: 0.95rem;
  color: #111827;
}
.pending-item .meta small {
  color: #6b7280;
}

.pending-item .role-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
}


.pending-item .actions {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
}

/* Pulsanti approva / rifiuta SOLO nella lista pending */
.pending-item .actions .ok,
.pending-item .actions .ko {
  width: 27px;
  height: 28px;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0; /* niente testo vero */

  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.16);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    filter 0.12s ease;
}

/* Check verde */
.pending-item .actions .ok {
  background: #22c55e;
}
.pending-item .actions .ok::before {
  content: '✓';
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  color: #ffffff;
}

/* X rossa */
.pending-item .actions .ko {
  background: #ef4444;
}
.pending-item .actions .ko::before {
  content: '✕';
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  color: #ffffff;
}

/* Hover / active leggeri */
.pending-item .actions .ok:hover,
.pending-item .actions .ko:hover {
  filter: brightness(1.02);
}

.pending-item .actions .ok:active,
.pending-item .actions .ko:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18);
}





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
.icon-btn:hover {
  filter: brightness(0.96);
}
.icon-btn.red {
  color: #ef4444;
}
.icon-btn.blue {
  color: #2563eb;
}
.icon-btn.sm {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn .ico {
  display: block;
  font-size: 16px;
  line-height: 1;
}

/* Empty state */
.empty {
  color: #64748b;
  font-size: 0.9rem;
  padding: 8px;
}

/* Responsive */
@media (max-width: 1100px) {
  .content {
    grid-template-columns: 1fr;
  }
  .kpi-row {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }
}


/* Modal */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  display: grid;
  place-items: center;
  padding: 12px;
  z-index: 9999;
}
.modal {
  width: min(520px, 92vw);
  background: #f5f7fb;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.28);
  padding: 28px 28px 22px;
  position: relative;
  z-index: 1010;
}
.modal h3 {
  margin: 2px 0 16px;
  font-size: 1.35rem;
  font-weight: 800;
  text-align: center;
  color: #0f172a;
  letter-spacing: 0.3px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.field label {
  color: #111;
  font-weight: 600;
}
.field input,
.field select {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d5dbe1;
  border-radius: 10px;
  background: #fff;
  font-size: 14px;
  color: #111;
}
.field input::placeholder {
  color: #6b7280;
}
.hint {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
}
.err {
  color: #dc2626;
  margin-top: 4px;
}

.modal p.ok {
  color: #059669;
  margin-top: 4px;
}

.btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
.btn {
  height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 800;
}
.btn.secondary {
  background: #e2e8f0;
  color: #0f172a;
}
.btn.primary {
  background: #10b981;
  color: #fff;
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.22);
}
.btn.primary:hover {
  filter: brightness(1.03);
}
.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.fab-new-user {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1000;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: #14db99;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  padding: 0;
}

/* span che contiene il png come background */
.fab-icon {
  width: 34px;
  height: 34px;
  display: block;
}

/* testo solo quando loading */
.fab-label {
  font-size: 12px;
  color: #ffffff;
}

</style>
