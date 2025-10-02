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
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 21l-3.8-3.8M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
            <input placeholder="Search..." />
          </div>
          <div class="avatar">{{ avatarInitial }}</div>
        </div>
      </header>

      <!-- Content grid: left = approvazioni, right = dashboard -->
      <section class="content">
        <!-- Colonna approvazioni -->
        <aside class="approvals">
          <h2>Utenti da approvare</h2>

          <ul class="pending-list" v-if="pending.length">
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

          <div v-else class="empty">
            Nessuna richiesta in sospeso.
          </div>
        </aside>

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

          <!-- Tabella utenti -->
          <div class="card">
            <div class="card-head">
              <h3>Team</h3>
              <span class="muted">{{ team.length }} membri</span>
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Titolo</th>
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
                    <span class="badge success" v-if="m.active">Active</span>
                    <span class="badge danger" v-else>Disabled</span>
                  </td>
                  <td>{{ m.role }}</td>
                  <td class="t-right">
                    <button class="icon-btn green" title="Edit">✎</button>
                    <button class="icon-btn red" title="Delete">🗑</button>
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
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from '../components/AppSidebar.vue'
import { api } from '@/utils/api'

// stato base
const router = useRouter()
const route = useRoute()
const defaultAvatar = 'https://i.pravatar.cc/40?img=1'

const avatarInitial = ref('A')
const systemName = ref('Flows system')

const kpi = ref({
  usersTotal: 0,
  usersOnline: 0,
})

const pending = ref([])
const team = ref([])

// persistenza semplice in localStorage come fallback
onMounted(() => {
  // carica tutto
  bootstrap()
})

// salva pending localmente (solo come fallback UX)
watch(pending, v => {
  localStorage.setItem('flows_pending', JSON.stringify(v))
}, { deep: true })

async function bootstrap () {
  // 1) verifica sessione/me per avatar + gestione redirect se non loggato
  try {
    const me = await api.me().catch(() => api.meAdmin?.())
    if (!me?.user && !me?.ok) throw new Error('NOT_LOGGED_IN')

    const seed = (me.user?.email || me.user?.name || 'A').trim()
    avatarInitial.value = seed ? seed[0].toUpperCase() : 'A'
  } catch (e) {
    // non loggato → manda al login con redirect back
    const redirect = route.fullPath || '/'
    router.push({ path: '/login', query: { redirect } })
    return
  }

  // 2) stats KPI
  await loadStats()

  // 3) pending approvazioni
  await loadPending()

  // 4) team (se esiste endpoint), altrimenti mock
  await loadTeam()
}

async function loadStats () {
  try {
    const s = await api.stats() // { ok:true, stats:{...} } nel nostro esempio
    // accetta diverse forme per robustezza
    const st = s?.stats || s || {}
    kpi.value.usersTotal = Number(st.usersTotal ?? st.totalUsers ?? 50)
    kpi.value.usersOnline = Number(st.usersOnline ?? st.onlineUsers ?? 20)
    if (st.systemName) systemName.value = String(st.systemName)
  } catch {
    // fallback statico
    kpi.value = { usersTotal: 50, usersOnline: 20 }
    systemName.value = 'Flows system'
  }
}

async function loadPending () {
  try {
    // se hai un endpoint reale, es: GET /admin/api/pending
    const r = await api.get('/admin/api/pending')
    const items = r?.items || r || []
    if (Array.isArray(items) && items.length) {
      pending.value = items
      return
    }
    // se vuoto, prova fallback locale
    const saved = localStorage.getItem('flows_pending')
    if (saved) pending.value = JSON.parse(saved)
    else pending.value = samplePending()
  } catch {
    // fallback locale
    const saved = localStorage.getItem('flows_pending')
    if (saved) pending.value = JSON.parse(saved)
    else pending.value = samplePending()
  }
}

async function loadTeam () {
  try {
    // se esiste un endpoint, es: GET /admin/api/team
    const r = await api.get?.('/admin/api/team')
    const items = r?.items || r
    if (Array.isArray(items) && items.length) {
      team.value = items
      return
    }
    team.value = sampleTeam()
  } catch {
    team.value = sampleTeam()
  }
}

function samplePending () {
  return [
    { id: 1, name: 'John Doe', email: 'john@example.com', avatar: 'https://i.pravatar.cc/40?img=11' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', avatar: 'https://i.pravatar.cc/40?img=32' },
    { id: 3, name: 'Alex Brown', email: 'alex@example.com', avatar: 'https://i.pravatar.cc/40?img=5' },
  ]
}

function sampleTeam () {
  return [
    { id: 10, name:'John Doe',  email:'john@sample.com',  title:'Software Engineer', track:'Web dev',  active:true,  role:'Owner',  avatar:'https://i.pravatar.cc/40?img=15' },
    { id: 11, name:'Sara Lee',  email:'sara@sample.com',  title:'Designer',          track:'UI/UX',    active:true,  role:'Editor', avatar:'https://i.pravatar.cc/40?img=48' },
    { id: 12, name:'David Kim', email:'david@sample.com', title:'DevOps',            track:'Infra',    active:true,  role:'Admin',  avatar:'https://i.pravatar.cc/40?img=22' },
    { id: 13, name:'Marta G.',  email:'marta@sample.com', title:'QA Engineer',       track:'Testing',  active:true,  role:'Member', avatar:'https://i.pravatar.cc/40?img=3' },
  ]
}

// azioni approvazioni (optimistic UI + chiamata API se disponibile)
async function approve (u) {
  const prev = [...pending.value]
  pending.value = pending.value.filter(x => x.id !== u.id)
  try {
    await api.post?.(`/admin/api/approvals/${u.id}/approve`, {})
  } catch {
    // ripristina se fallisce server
    pending.value = prev
  }
}

async function reject (u) {
  const prev = [...pending.value]
  pending.value = pending.value.filter(x => x.id !== u.id)
  try {
    await api.post?.(`/admin/api/approvals/${u.id}/reject`, {})
  } catch {
    pending.value = prev
  }
}
</script>

<style scoped>
/* Layout base */
.layout{ display:flex; background:#eef2f7; min-height:100vh; }
.main{ flex:1; display:flex; flex-direction:column; }

/* Topbar */
.topbar{
  height:64px; background:#fff; border-bottom:1px solid #e5e7eb;
  display:flex; align-items:center; justify-content:space-between;
  padding:0 18px; position:sticky; top:0; z-index:5;
}
.topbar h1{ font-size:1.1rem; font-weight:700; color:#0f172a; }
.top-actions{ display:flex; align-items:center; gap:12px; }
.search{ display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:6px 10px; border-radius:10px; }
.search svg{ width:18px; height:18px; color:#6b7280; }
.search input{ border:none; outline:none; background:transparent; min-width:210px; }
.avatar{
  width:34px; height:34px; border-radius:50%; background:#22c55e; color:#fff;
  display:grid; place-items:center; font-weight:700;
}

/* Content grid */
.content{
  display:grid;
  grid-template-columns: 320px 1fr; /* sinistra: approvazioni | destra: dashboard */
  gap:18px; padding:18px;
}

/* Approvals column */
.approvals{
  background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:14px;
  position:sticky; top:82px; height:fit-content;
}
.approvals h2{ margin:0 0 10px; font-size:1rem; color:#0f172a; }
.pending-list{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
.pending-item{
  display:flex; align-items:center; gap:10px; padding:8px; border:1px solid #e5e7eb; border-radius:10px;
}
.pending-item img{ width:36px; height:36px; border-radius:50%; }
.pending-item .meta{ flex:1; }
.pending-item .meta strong{ display:block; font-size:.95rem; color:#111827; }
.pending-item .meta small{ color:#6b7280; }
.pending-item .actions{ display:flex; gap:6px; }
.ok,.ko{
  width:28px; height:28px; border-radius:8px; border:none; cursor:pointer; color:#fff; font-weight:700;
}
.ok{ background:#22c55e; } .ok:hover{ filter:brightness(.95); }
.ko{ background:#ef4444; } .ko:hover{ filter:brightness(.95); }
.empty{ color:#64748b; font-size:.9rem; padding:8px; }

/* Dashboard column */
.dashboard{ display:flex; flex-direction:column; gap:18px; }

/* KPI cards */
.kpi-row{ display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; }
.kpi{
  background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:14px;
  display:flex; align-items:center; gap:12px;
}
.kpi-icon{
  width:42px; height:42px; border-radius:12px; background:#eef2ff; position:relative;
}
.kpi-icon.users{ background:#eef2ff; }
.kpi-icon.orders{ background:#ecfeff; }
.kpi-val{ font-weight:800; font-size:1.25rem; color:#0f172a; }
.kpi-label{ color:#64748b; }

.kpi-icon.products {
  background:#f0fdf4;
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
.card{ background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
.card-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 14px; border-bottom:1px solid #e5e7eb;
}
.card-head h3{ margin:0; font-size:1rem; }
.muted{ color:#6b7280; }
.table{ width:100%; border-collapse:separate; border-spacing:0; }
.table thead th{
  text-align:left; font-size:.9rem; color:#64748b; font-weight:600; padding:12px 14px; background:#f8fafc;
  border-bottom:1px solid #e5e7eb;
}
.table tbody td{ padding:12px 14px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.person{ display:flex; align-items:center; gap:10px; }
.person img{ width:34px; height:34px; border-radius:50%; }
.name{ font-weight:600; }
.small{ font-size:.85rem; }
.t-right{ text-align:right; }
.badge{ padding:4px 8px; border-radius:999px; font-size:.75rem; font-weight:700; }
.badge.success{ background:#ecfdf5; color:#16a34a; }
.badge.danger{ background:#fef2f2; color:#ef4444; }
.icon-btn{
  border:none; background:#f1f5f9; padding:6px 8px; border-radius:8px; cursor:pointer; margin-left:6px;
}
.icon-btn.green{ color:#16a34a; }
.icon-btn.red{ color:#ef4444; }
.icon-btn:hover{ filter:brightness(.96); }

/* Responsive */
@media (max-width: 1100px){
  .content{ grid-template-columns: 1fr; }
  .approvals{ position:static; }
}
@media (max-width: 720px){
  .kpi-row{ grid-template-columns: 1fr; }
}
</style>
