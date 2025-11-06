<template>
  <div class="layout">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main area -->
    <main class="main">
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in filteredTeam" :key="m.id">
                  <!-- Utente -->
                  <td class="person">
                    <img :src="m.avatar || defaultAvatar" alt="" />
                    <div>
                      <div class="name">{{ m.name }}</div>
                      <div class="email">{{ m.email }}</div>
                    </div>
                  </td>

                  <!-- Online -->
                  <td>
                    <span class="badge success" v-if="m.active">Online</span>
                    <span class="badge danger" v-else>Offline</span>
                  </td>

                  <!-- Ruolo -->
                  <td class="role">{{ prettyRole(m.role) }}</td>

                  <!-- Ultimo accesso -->
                  <td>
                    <span v-if="m.active" class="chip online">Online ora</span>
                    <span v-else class="chip offline">
                      {{ timeAgo(m.lastSeenTs) }}
                    </span>
                  </td>

                  <!-- Azioni -->
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopBar.vue'
import { api } from '@/utils/api'
import usersIcon from '@/assets/users.png'
import onlineUsersIcon from '@/assets/onlineUsers.png'

const router = useRouter()
const route = useRoute()

const defaultAvatar = 'https://i.pravatar.cc/40?img=1'

const avatarInitial = ref('A')
const systemName = ref('Flows system')
const sessionUser = ref(null)

const kpi = ref({ usersTotal: 0, usersOnline: 0 })
const team = ref([])
const teamError = ref('')

const q = ref('')

const iconStyle = (src) => ({
  backgroundImage: `url(${src})`
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

function getNameOverride(email) {
  try {
    const m = JSON.parse(localStorage.getItem('flows_name_overrides') || '{}')
    return m[email]
  } catch {
    return undefined
  }
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

/* ---------------- Team & KPI ---------------- */
async function loadStats() {
  try {
    const s = await api.stats()
    const st = s?.stats || s || {}
    kpi.value.usersTotal = Number(st.usersTotal ?? st.totalUsers ?? kpi.value.usersTotal ?? 0)
    kpi.value.usersOnline = Number(
      st.usersOnline ?? st.onlineUsers ?? kpi.value.usersOnline ?? 0
    )
    if (st.systemName) systemName.value = String(st.systemName)
  } catch {
    // fallback sui dati team
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
      const override = getNameOverride(u.email)
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

/* ---------------- Filter: me in alto ---------------- */
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

  return result
})

/* ---------------- Azioni tabella ---------------- */
function editUser(u) {
  console.log('edit user', u)
}

async function removeUser(u) {
  const ok = confirm(
    `Eliminare definitivamente l'utente ${u.username || u.email || u.id}?`
  )
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
    if (u.active) {
      kpi.value.usersOnline = Math.max(0, kpi.value.usersOnline - 1)
    }
  } catch (e) {
    console.error('DELETE user failed:', e)
    alert(`Impossibile eliminare l’utente: ${e.message}`)
  }
}

/* ---------------- Search & Profile ---------------- */
function onSearch(term) {
  q.value = term
}
function openProfile() {
  // router.push('/profile') se/quando servirà
}

/* ---------------- Bootstrap & lifecycle ---------------- */
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
  await loadTeam()
}

async function refreshUsersAndKpi() {
  await Promise.all([loadTeam(), loadStats().catch(() => {})])
  kpi.value.usersOnline = team.value.filter(x => x.active).length
  kpi.value.usersTotal = team.value.length
}

function onFocusRefresh() {
  refreshUsersAndKpi()
}

let intervalId = null

onMounted(() => {
  bootstrap()
  startHeartbeat()
  window.addEventListener('focus', onFocusRefresh)
  intervalId = setInterval(refreshUsersAndKpi, 30_000)
})

onBeforeUnmount(() => {
  stopHeartbeat()
  window.removeEventListener('focus', onFocusRefresh)
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
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

/* Topbar (coerente con AppTopbar) */
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

.app-topbar.fullbleed {
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

/* Content */
.content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  padding: 18px;
}

.dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* KPI */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
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
.kpi-icon.products {
  background: #f0fdf4;
  position: relative;
}
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

.kpi-val {
  font-weight: 800;
  font-size: 1.25rem;
  color: #0f172a;
}
.kpi-label {
  color: #64748b;
}

/* Card & tabella */
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

.role {
  color: #64748b;
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

/* Icon buttons */
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

/* Responsive */
@media (max-width: 1100px) {
  .content {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }
}
</style>
