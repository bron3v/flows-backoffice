<template>
  <div class="layout">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main area -->
    <main class="main">
      <!-- Topbar -->
       <AppTopbar
          title="Dashboard"
          v-model="q"
          :session-user="sessionUser"
          :avatar-initial="avatarInitial"
          @search="onSearch"
          @profile="openProfile"
        >

        </AppTopbar>


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
            <li v-for="u in filteredTeam" :key="u.id" class="user-card" :class="{ me: isSelf(u) }">
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
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopbar.vue'   // ✅ importa la topbar
import { api } from '@/utils/api'

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

function openModal() {
  // apri il modal "New user" (gestisci loading se serve)
  // loading.value = true; ...; loading.value = false
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
  background: #f5f7fb;          /* ✅ chiaro come HomeView */
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

/* (opzionale) se hai ancora questa classe nella pagina, rendila chiara per coerenza */
.search {
  display: flex; align-items: center; gap: 8px;
  background: #f5f7fb; border: 1px solid #e6e8ef;
  padding: 6px 10px; border-radius: 10px;
}
.search svg { width: 18px; height: 18px; opacity: .6; }
.search input {
  background: transparent; border: 0; color: #0b0b0c; outline: none; min-width: 240px;
}

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

/* 3) La main non aggiunge margini a sinistra */
.main{ margin-left: 0; }
</style>

