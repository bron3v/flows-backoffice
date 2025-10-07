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
              <path d="M21 21l-3.8-3.8M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" stroke="currentColor"
                stroke-width="2" fill="none" stroke-linecap="round" />
            </svg>
            <input placeholder="Search..." />
          </div>
          <AvatarCard
            :avatar-initial="avatarInitial"
            :user-name="sessionUser?.name || 'Utente'"
            :user-email="sessionUser?.email || 'name@example.com'"
          />
        </div>
      </header>

      <!-- Content grid: left = approvazioni, right = dashboard -->
      <section class="content">
        <!-- NIENTE aside separato -->

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

          <!-- ✅ Utenti da approvare DOPO i KPI -->
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
                    <strong>{{ u.name }}</strong>
                    <small>{{ u.email }}</small>
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
              <span class="muted">{{ team.length }} membri</span>
            </div>
            
            
            <p v-if="teamError" class="err" style="margin: 6px 12px 0;">
              {{ teamError }}
            </p>
            <table class="table" v-if="!teamError">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Ultimo accesso</th>
                  <th>Status</th>
                  <th>Ruolo</th>
                  <th class="t-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in team" :key="m.id">
                  <td class="person">
                    <img :src="m.avatar || defaultAvatar" alt="" />
                    <div>
                      <div class="name">{{ m.name }}</div>
                      <div class="small muted">{{ m.email }}</div>
                    </div>
                  </td>
                  <td>
                    <div class="name">{{ m.title }}</div>
                    <div class="small muted">{{ m.track }}</div>
                  </td>
                  <td>
                    <span class="badge success" v-if="m.active">Online</span>
                    <span class="badge danger" v-else>Offline</span>
                  </td>
                  <td>{{ m.role }}</td>
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
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from '../components/AppSidebar.vue'
import { api } from '@/utils/api' // tienilo se usi /me e /stats
import AvatarCard from '@/components/AvatarCard.vue'


// stato base
const router = useRouter()
const route = useRoute()
const defaultAvatar = 'https://i.pravatar.cc/40?img=1'

const avatarInitial = ref('A')
const systemName = ref('Flows system')
const sessionUser = ref(null)


const kpi = ref({
  usersTotal: 0,
  usersOnline: 0,
})

const pending = ref([])
const team = ref([])

function isSelf(u) {
  const me = sessionUser.value
  if (!me) return false
  // confronti stringificati per sicurezza su tipi diversi
  if (me.id != null && u.id != null && String(u.id) === String(me.id)) return true
  if (me.email && u.email && String(u.email).toLowerCase() === String(me.email).toLowerCase()) return true
  return false
}

// --- helper persistenza pending ---
function savePendingLocally(list) {
  localStorage.setItem('flows_pending', JSON.stringify(list))
}
function loadPendingLocally() {
  const saved = localStorage.getItem('flows_pending')
  return saved ? JSON.parse(saved) : samplePending()
}

// --- bootstrap pagina ---
onMounted(() => {
  bootstrap()
  // ascolta nuove richieste solo FE dalla sidebar
  window.addEventListener('flows:new-pending', onNewPending)
})
onBeforeUnmount(() => {
  window.removeEventListener('flows:new-pending', onNewPending)
})

// salva pending ad ogni modifica (solo FE)
watch(pending, v => savePendingLocally(v), { deep: true })

async function bootstrap() {
  // 1) verifica sessione per avatar (se usi auth); altrimenti commenta questo blocco
  try {
    const me = await api.me().catch(() => api.meAdmin?.())
    if (!me?.user && !me?.ok) throw new Error('NOT_LOGGED_IN')
    sessionUser.value = me.user || null 
    const seed = (me.user?.email || me.user?.name || 'A').trim()
    avatarInitial.value = seed ? seed[0].toUpperCase() : 'A'
  } catch (e) {
    const redirect = route.fullPath || '/'
    router.push({ path: '/login', query: { redirect } })
    return
  }

  // 2) stats KPI (se hai endpoint; altrimenti fallback)
  await loadStats()

  // 3) pending solo da localStorage (NO backend)
  pending.value = loadPendingLocally()

  // 4) team (se hai endpoint usa api, altrimenti mock)
  await loadTeam()
}

async function loadStats() {
  try {
    const s = await api.stats()
    const st = s?.stats || s || {}
    kpi.value.usersTotal = Number(st.usersTotal ?? st.totalUsers ?? 50)
    kpi.value.usersOnline = Number(st.usersOnline ?? st.onlineUsers ?? 20)
    if (st.systemName) systemName.value = String(st.systemName)
  } catch {
    kpi.value = { usersTotal: 50, usersOnline: 20 }
    systemName.value = 'Flows system'
  }
}

const teamError = ref('')
async function loadTeam() {
  teamError.value = ''
  try {
    const res = await fetch('/admin/api/users', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
      console.error('GET /admin/api/users failed:', res.status, data)
      throw new Error(data?.message || `HTTP ${res.status}`)
    }

    team.value = data.items.map(u => ({
      id: u.id ?? u.user_id ?? u._id ?? null,   // <-- aggiunto
      name: u.email,
      email: u.email,
      title: u.online ? 'Online' : 'Offline',
      track: u.last_seen ? new Date(u.last_seen).toLocaleString() : '',
      active: !!u.online,
      role: 'Member',
      avatar: undefined
    }))


    kpi.value.usersOnline = data.items.filter(x => x.online).length
    kpi.value.usersTotal  = data.items.length
  } catch (e) {
    team.value = []                                // niente mock
    teamError.value = 'Impossibile caricare gli utenti'
  }
}



// --- handler evento da sidebar: aggiunge subito il nuovo pending ---
function onNewPending(e) {
  const item = e.detail
  if (!item || !item.id) return
  // Evita duplicati per id
  if (!pending.value.some(p => p.id === item.id)) {
    pending.value = [item, ...pending.value]
  }
}

// --- dati di fallback ---
function samplePending() {
  return [
    { id: 1, name: 'John Doe', email: 'john@example.com', avatar: 'https://i.pravatar.cc/40?img=11' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', avatar: 'https://i.pravatar.cc/40?img=32' },
    { id: 3, name: 'Alex Brown', email: 'alex@example.com', avatar: 'https://i.pravatar.cc/40?img=5' },
  ]
}


// --- approvazioni SOLO FE: aggiornano la lista + localStorage ---
async function approve(u) {
  try {
    const res = await fetch('/admin/api/approvals/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: u.name, email: u.email })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) {
      if (data?.message === 'user_exists') {
        alert('Utente già presente. Rimuovo la richiesta.')
        pending.value = pending.value.filter(x => x.id !== u.id)
        return
      }
      throw new Error(data?.message || 'Errore approvazione')
    }
    pending.value = pending.value.filter(x => x.id !== u.id)
    alert(`Utente creato e email inviata a ${u.email}`)
  } catch (e) {
    console.error(e)
    alert('Impossibile approvare la richiesta. Riprova.')
  }
}

async function reject(u) {
  pending.value = pending.value.filter(x => x.id !== u.id)
}

async function removeUser(u) {
  const ok = confirm(`Eliminare definitivamente l'utente ${u.email}?`)
  if (!ok) return

  if (sessionUser?.value?.id && String(u.id) === String(sessionUser.value.id)) {
    alert('Non puoi eliminare il tuo stesso account.')
    return
  }
  if (sessionUser?.value?.email && String(u.email).toLowerCase() === String(sessionUser.value.email).toLowerCase()) {
    alert('Non puoi eliminare il tuo stesso account.')
    return
  }

  // Scegli identificatore: prima id, altrimenti email
  const hasId = u.id != null && String(u.id).trim() !== ''
  const url = hasId
    ? `/admin/api/users/${encodeURIComponent(String(u.id))}`                   // DELETE by id
    : `/admin/api/users/by-email/${encodeURIComponent(String(u.email))}`       // DELETE by email (fallback)

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'include'
    })

    // prova a leggere JSON, altrimenti testo
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

    // ok → rimuovi dalla tabella e aggiorna KPI
    team.value = team.value.filter(x => x.id !== u.id && x.email !== u.email)
    kpi.value.usersTotal = Math.max(0, kpi.value.usersTotal - 1)
    if (u.active) kpi.value.usersOnline = Math.max(0, kpi.value.usersOnline - 1)
  } catch (e) {
    console.error('DELETE user failed:', e)
    alert(`Impossibile eliminare l’utente: ${e.message}`)
  }
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
  display: flex;
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

.pending-item .meta {
  flex: 1;
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

.ok {
  background: #22c55e;
}

.ok:hover {
  filter: brightness(.95);
}

.ko {
  background: #ef4444;
}

.ko:hover {
  filter: brightness(.95);
}

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

/* KPI cards */
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
  background: #eef2ff;
  position: relative;
}

.kpi-icon.users {
  background: #eef2ff;
}

.kpi-icon.orders {
  background: #ecfeff;
}

.kpi-val {
  font-weight: 800;
  font-size: 1.25rem;
  color: #0f172a;
}

.kpi-label {
  color: #64748b;
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

.card-head h3 {
  margin: 0;
  font-size: 1rem;
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

.person img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
}

.name {
  font-weight: 600;
}

.small {
  font-size: .85rem;
}

.t-right {
  text-align: right;
}

.badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: .75rem;
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

.icon-btn {
  border: none;
  background: #f1f5f9;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  margin-left: 6px;
}

.icon-btn.green {
  color: #16a34a;
}

.icon-btn.red {
  color: #ef4444;
}

.icon-btn:hover {
  filter: brightness(.96);
}

/* Responsive */
@media (max-width: 1100px) {
  .content {
    grid-template-columns: 1fr;
  }

  .approvals {
    position: static;
  }
}

@media (max-width: 720px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }
}
</style>
