<template>
  <div class="layout">
    <!-- Sidebar -->
    <AppSidebar />

    <main class="main">
      <!-- Topbar -->
      <AppTopBar
        class="topbar-card full-bleed"
        title="Logs"
        v-model="q"
        :session-user="sessionUser"
        :avatar-initial="avatarInitial"
        :full-bleed="true"
        @search="onSearch"
        @profile="openProfile"
      />

      <!-- Content -->
      <section class="content">
        <!-- KPI -->
        <div class="kpi-row">
          <div class="kpi">
            <div class="kpi-icon errors"></div>
            <div>
              <div class="kpi-val">{{ kpi.errors }}</div>
              <div class="kpi-label">Errori</div>
            </div>
          </div>
          <div class="kpi">
          <div
            class="kpi-icon warnings"
            :style="{'--warn-icon': `url(${warningIcon})`}"
          ></div>
          <div>
            <div class="kpi-val">{{ kpi.warnings }}</div>
            <div class="kpi-label">Warning</div>
          </div>
        </div>
          <div class="kpi">
            <div class="kpi-icon reqs" :style="{'--reqs-icon': `url(${reqsIcon})`}"></div>
            <div>
              <div class="kpi-val">{{ kpi.rps }}</div>
              <div class="kpi-label">Req/min ({{ minutesInRange }}m)</div>
            </div>
          </div>
        </div>

        <!-- Filtri -->
        <div class="card">
          <div class="card-head">
            <h3>Filtri</h3>
            <div class="filters-actions">
              <label class="switch">
                <input type="checkbox" v-model="autoRefresh" />
                <span>Auto-refresh ({{ refreshSec }}s)</span>
              </label>
              <button class="icon-btn" @click="refreshNow" :disabled="loading">↻</button>
            </div>
          </div>

          <div class="filters">
            <div class="field">
              <label>Selezione</label>
              <select v-model="level">
                <option value="">Tutti</option>
                <option value="error">error</option>
                <option value="warn">warn</option>
                <option value="info">info</option>
                <option value="debug">debug</option>
              </select>
            </div>

            <div class="field">
              <label>Da</label>
              <input type="datetime-local" v-model="fromIso" />
            </div>

            <div class="field">
              <label>A</label>
              <input type="datetime-local" v-model="toIso" />
            </div>

            <div class="field grow">
              <label>Cerca</label>
              <input
                class="search-input"
                placeholder="message, user, requestId, route…"
                v-model="q"
              />
            </div>
          </div>
        </div>

        <!-- Tabella Logs -->
        <div class="card">
          <div class="card-head">
            <h3>Logs</h3>
            <span class="muted">{{ filteredLogs.length }} risultati</span>
          </div>

          <p v-if="err" class="err">{{ err }}</p>

          <table class="table" v-if="!err">
            <thead>
              <tr>
                <th style="width: 170px;">Timestamp</th>
                <th style="width: 90px;">Livello</th>
                <th>Messaggio</th>
                <th style="width: 160px;">User</th>
                <th style="width: 160px;">Origine</th>
                <th style="width: 160px;" class="t-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in paginated" :key="row.id">
                <tr :class="{ expanded: isExpanded(row.id) }">
                  <td class="mono">
                    <div>{{ fmtTime(row.ts) }}</div>
                    <small class="muted">{{ timeAgo(row.ts) }}</small>
                  </td>
                  <td>
                    <span :class="['badge', levelClass(row.level)]">{{ row.level }}</span>
                  </td>
                  <td>
                    <div class="msg">{{ row.message }}</div>
                    <small v-if="row.tags?.length" class="tags">
                      <span v-for="t in row.tags" :key="t" class="tag">#{{ t }}</span>
                    </small>
                  </td>
                  <td class="mono small">
                    <div>{{ row.user || '—' }}</div>
                    <small class="muted">{{ row.ip || '' }}</small>
                  </td>
                  <td class="mono small">
                    <div>{{ row.route || row.source || '—' }}</div>
                    <small class="muted">{{ row.requestId || '—' }}</small>
                  </td>
                  <td class="t-right">
                    <div class="actions">
                      <button class="icon-btn" @click="toggleExpand(row.id)">
                        {{ isExpanded(row.id) ? '▲' : '▼' }}
                      </button>
                      <button class="icon-btn" @click="copy(row.requestId)" :disabled="!row.requestId">⧉</button>
                    </div>
                  </td>
                </tr>

                <tr v-if="isExpanded(row.id)" :key="row.id + ':details'">
                  <td colspan="6" class="details">
                    <div class="grid">
                      <div>
                        <h4>Context</h4>
                        <pre class="pre">{{ pretty(row.context) }}</pre>
                      </div>
                      <div v-if="row.error">
                        <h4>Error</h4>
                        <pre class="pre">{{ pretty(row.error) }}</pre>
                      </div>
                      <div v-if="row.meta">
                        <h4>Meta</h4>
                        <pre class="pre">{{ pretty(row.meta) }}</pre>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>

              <tr v-if="!paginated.length">
                <td colspan="6" class="empty">Nessun log per i filtri selezionati.</td>
              </tr>
            </tbody>
          </table>

          <!-- Paginazione -->
          <div class="pager" v-if="!err && filteredLogs.length">
            <button class="icon-btn" @click="prevPage" :disabled="page===1">‹</button>
            <span class="muted">Pagina {{ page }} / {{ pages }}</span>
            <button class="icon-btn" @click="nextPage" :disabled="page===pages">›</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopBar from '@/components/AppTopBar.vue'
import { api } from '@/utils/api'
import warningIcon from '@/assets/warning.png'
import reqsIcon from '@/assets/reqs.png'


const router = useRouter()
const route = useRoute()
const sessionUser = ref(null)
const avatarInitial = ref('A')



/* KPI */
const kpi = ref({ errors: 0, warnings: 0, rps: 0 })

/* Filtri */
const q = ref('')
const level = ref('')
const fromIso = ref(defaultFromIso(1)) // -1 giorno
const toIso = ref(nowIso())
const autoRefresh = ref(true)
const refreshSec = 15


const loading = ref(false)
const err = ref('')
const logs = ref([])

const page = ref(1)
const pageSize = ref(20)

const expanded = ref(new Set())


const range = computed(() => {
  const from = toEpoch(fromIso.value)
  const to = toEpoch(toIso.value)
  return { from, to }
})
const minutesInRange = computed(() => Math.max(1, Math.round((range.value.to - range.value.from) / 60000)))
const rangeLabel = computed(() => `${fmtTimeShort(range.value.from)} → ${fmtTimeShort(range.value.to)}`)

/* Lifecycle */
let timer = null
onMounted(async () => {
  await ensureSession()
  await refreshNow()
  timer = setInterval(() => { if (autoRefresh.value) refreshNow() }, refreshSec * 1000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

/* Watch filtri: reset pagina + ricalcolo KPI */
watch([q, level], () => { page.value = 1 })
watch([fromIso, toIso], () => { page.value = 1; updateKpi() })

/* Helpers sessione */
async function ensureSession () {
  try {
    const me = await api.me()
    if (!me?.ok || !me?.user) throw new Error('NOT_LOGGED_IN')
    sessionUser.value = me.user
    const seed = (me.user?.username || 'A').trim()
    avatarInitial.value = seed ? seed[0].toUpperCase() : 'A'
  } catch {
    const redirect = route.fullPath || '/logs'
    router.push({ path: '/login', query: { redirect } })
  }
}

/* Caricamento logs  */
async function refreshNow () {
  loading.value = true
  err.value = ''
  try {
    const params = {
      from: range.value.from,
      to: range.value.to,
      level: level.value || undefined,
      q: q.value || undefined,
      page: 1,
      pageSize: 500 // carico “tanto”, pagino in FE
    }
    const data = await (api.logsList ? api.logsList(params) : fetchFallback(params))
    const items = Array.isArray(data?.items) ? data.items
                : Array.isArray(data?.logs) ? data.logs
                : []
    logs.value = normalizeLogs(items)
    updateKpi()
  } catch (e) {
    console.warn('[Logs] using local sample. Cause:', e?.message || e)
    logs.value = normalizeLogs(sampleLogs())
    updateKpi()
    err.value = '' 
  } finally {
    loading.value = false
  }
}

async function fetchFallback (params) {
  const qs = new URLSearchParams()
  for (const [k,v] of Object.entries(params)) if (v != null && v !== '') qs.set(k, v)
  const res = await fetch(`/admin/api/logs?${qs.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json().catch(()=> ({}))
}

/* Filtri e viste */
const filteredLogs = computed(() => {
  const term = q.value.trim().toLowerCase()
  const L = level.value
  const from = range.value.from
  const to = range.value.to

  return logs.value.filter(r => {
    if (L && r.level !== L) return false
    if (r.ts < from || r.ts > to) return false
    if (!term) return true
    const hay =
      `${r.message} ${r.user||''} ${r.route||r.source||''} ${r.requestId||''} ${JSON.stringify(r.context||{})}`.toLowerCase()
    return hay.includes(term)
  })
})

const pages = computed(() => Math.max(1, Math.ceil(filteredLogs.value.length / pageSize.value)))
const paginated = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredLogs.value.slice(start, start + pageSize.value)
})

function prevPage(){ if (page.value > 1) page.value-- }
function nextPage(){ if (page.value < pages.value) page.value++ }

/* UI handlers */
function onSearch(t){ q.value = t ?? q.value }
function openProfile(){ router.push('/impostazioni') }
function toggleExpand(id){
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  expanded.value = s
}
function isExpanded(id){ return expanded.value.has(id) }
async function copy(s){
  if (!s) return
  try { await navigator.clipboard.writeText(s) } catch {}
}

/* KPI helpers — allineati al range Da/A */
function updateKpi(){
  const from = range.value.from
  const to = range.value.to
  const inRange = logs.value.filter(r => r.ts >= from && r.ts <= to)
  kpi.value.errors   = inRange.filter(r => r.level === 'error').length
  kpi.value.warnings = inRange.filter(r => r.level === 'warn').length

  // Media richieste per minuto sul range selezionato
  const minutes = minutesInRange.value
  const reqs = inRange.filter(r => ['info','debug'].includes(r.level)).length
  kpi.value.rps = Math.round((reqs / minutes) * 10) / 10
}

/* Normalizzazione — fix s→ms */
function normalizeLogs(list){
  return (list||[]).map((r,i) => {
    let ts = Number(r.ts ?? r.timestamp ?? Date.now())
    // Se arriva in secondi (es. 1699000000), converti in ms
    if (ts > 0 && ts < 1e12) ts *= 1000

    return {
      id: r.id ?? `${r.requestId||'noid'}:${i}`,
      ts,
      level: String(r.level || 'info').toLowerCase(),
      message: r.message || '',
      user: r.user || r.username || '',
      ip: r.ip || r.remoteAddr || '',
      route: r.route || r.path || r.endpoint || '',
      source: r.source || r.service || '',
      requestId: r.requestId || r.reqId || '',
      tags: r.tags || [],
      context: r.context || r.ctx || null,
      error: r.error || r.err || null,
      meta: r.meta || null
    }
  })
}

/* Utils tempo */
function timeAgo(ms){
  const d = Date.now() - ms
  const s = Math.floor(d/1000)
  if (s < 60) return `${s}s fa`
  const m = Math.floor(s/60)
  if (m < 60) return `${m}m fa`
  const h = Math.floor(m/60)
  if (h < 24) return `${h}h fa`
  const dd = Math.floor(h/24)
  return `${dd}g fa`
}
function fmtTime(ms){
  const dt = new Date(ms)
  const pad = (n)=> String(n).padStart(2,'0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}
function fmtTimeShort(ms){
  const dt = new Date(ms)
  const pad = (n)=> String(n).padStart(2,'0')
  return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
function nowIso(){
  const d = new Date()
  d.setMilliseconds(0)
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16)
}
function defaultFromIso(daysBack=1){
  const d = new Date(Date.now() - daysBack*24*60*60*1000)
  d.setMilliseconds(0)
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16)
}
function toEpoch(iso){
  if (!iso) return 0
  const d = new Date(iso)
  return d.getTime()
}
function pretty(obj){
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj ?? '') }
}

/* Dati fittizi se BE mancante */
function sampleLogs(){
  const now = Date.now()
  const rand = (a,b)=> Math.floor(a + Math.random()*(b-a+1))
  const lv = ['info','warn','error','debug']
  const routes = ['/auth/login','/admin/api/users','/admin/api/approvals/approve','/me/ping','/']
  const out = []
  for (let i=0;i<80;i++){
    const level = lv[rand(0,3)]
    const ts = now - rand(0, 36*60*60*1000)
    const reqId = Math.random().toString(36).slice(2,10)
    out.push({
      id: `${reqId}:${i}`,
      ts,
      level,
      message: level === 'error'
        ? 'Unhandled exception while processing request'
        : level === 'warn'
          ? 'Slow query detected on /admin/api/users'
          : level === 'info'
            ? 'Request completed'
            : 'Cache miss for key users:list',
      user: i%5===0 ? 'admin' : (i%7===0 ? 'a' : ''),
      ip: `172.19.16.${rand(2,250)}`,
      route: routes[rand(0, routes.length-1)],
      source: 'flows-api',
      requestId: reqId,
      tags: i%6===0 ? ['sql','perf'] : (i%9===0 ? ['security'] : []),
      context: { duration_ms: rand(10, 1800), rows: rand(0,150) },
      error: level==='error' ? { name:'TypeError', message:'Cannot read properties of undefined', stack:'...' } : null,
      meta: { node:'api-1', env:'dev' }
    })
  }
  return out
}

/* Classi livello */
function levelClass(l){
  switch(l){
    case 'error': return 'danger'
    case 'warn': return 'warning'
    case 'info': return 'success'
    default: return 'muted-chip'
  }
}
</script>

<style scoped>
/* Layout base */
.layout{ display:flex; background:#eef2f7; min-height:100vh; }
.main{ flex:1; display:flex; flex-direction:column; }
:root{ --gutter:24px; }
.main{ padding:0 var(--gutter) var(--gutter) 0; overflow-x:clip; }

/* Topbar full-bleed  */
.topbar-card.full-bleed{ margin:0 calc(-1 * var(--gutter)) 16px 0; border-radius:0; }

/* Grid contenuti */
.content{ display:grid; grid-template-columns:1fr; gap:18px; padding:18px; }

/* Card & head */
.card{ background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
.card-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid #e5e7eb; }
.card-head h3{ margin:0; font-size:1rem; color:#6b7280; }
.muted{ color:#6b7280; }
.err{ color:#ef4444; padding:10px 14px; }

/* KPI */
.kpi-row{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.kpi{ background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; }
.kpi-val{ font-weight:800; font-size:1.25rem; color:#0f172a; }
.kpi-label{ color:#64748b; }
.kpi-icon{ width:42px; height:42px; border-radius:12px; }
.kpi-icon.errors{ background:#fef2f2; }


.kpi-icon{
  position: relative;
  display: grid;
  place-items: center;
}

/* REQ/MIN: box + icona con spessore regolabile */
.kpi-icon.reqs{
  --reqs-size: 20px;       
  --reqs-weight: 1.08;    
  --reqs-color: #06b6d4;   
  background:#ecfeff;     
  border-radius:12px;
  position:relative;
}

/* layer “stroke” per dare spessore */
.kpi-icon.reqs::before{
  content:'';
  position:absolute; top:50%; left:50%;
  width:calc(var(--reqs-size) * var(--reqs-weight));
  height:calc(var(--reqs-size) * var(--reqs-weight));
  transform:translate(-50%, -50%);
  background-color:var(--reqs-color);
  -webkit-mask: var(--reqs-icon) center/contain no-repeat;
  mask: var(--reqs-icon) center/contain no-repeat;
  pointer-events:none;
  z-index:0;
}

/* layer icona “normale” sopra */
.kpi-icon.reqs::after{
  content:'';
  position:absolute; top:50%; left:50%;
  width:var(--reqs-size);
  height:var(--reqs-size);
  transform:translate(-50%, -50%);
  background-color:var(--reqs-color);
  -webkit-mask: var(--reqs-icon) center/contain no-repeat;
  mask: var(--reqs-icon) center/contain no-repeat;
  pointer-events:none;
  z-index:1;
}

.kpi-icon.errors::before{
  content: 'X';           
  font-size: 20px;       
  font-weight: 800;
  line-height: 1;
  color: #ef4444;        
}

.kpi-icon.warnings{
  --warn-size: 20px;   
  --warn-weight: 1.08; 

  background:#fff0d2;
  border-radius:12px;
  position:relative;
}

.kpi-icon.warnings::before{
  content:'';
  position:absolute; top:50%; left:50%;
  width:calc(var(--warn-size) * var(--warn-weight));
  height:calc(var(--warn-size) * var(--warn-weight));
  transform:translate(-50%, -50%);
  background-color:#f4b909;
  -webkit-mask: var(--warn-icon) center/contain no-repeat;
  mask: var(--warn-icon) center/contain no-repeat;
  pointer-events:none;
  z-index:0;
}

.kpi-icon.warnings::after{
  content:'';
  position:absolute; top:50%; left:50%;
  width:var(--warn-size);
  height:var(--warn-size);
  transform:translate(-50%, -50%);
  background-color:#f4b909;
  -webkit-mask: var(--warn-icon) center/contain no-repeat;
  mask: var(--warn-icon) center/contain no-repeat;
  pointer-events:none;
  z-index:1;
}


/* Filtri */
.filters{ display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap:12px; padding:12px 14px; }
.field{ display:flex; flex-direction:column; gap:6px; }
.field.grow{ grid-column: span 2; }
.filters label{ font-size:.8rem; color:#6b7280; }
.filters input, .filters select, .search-input{
  border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; background:#f8fafc; outline:none;
}
.filters-actions{ display:flex; gap:10px; align-items:center; }
.switch{ display:flex; align-items:center; gap:6px; font-size:.9rem; color:#374151; }

/* Tabella */
.table{ width:100%; border-collapse:separate; border-spacing:0; }
.table thead th{ text-align:left; font-size:.9rem; color:#64748b; font-weight:600; padding:12px 14px; background:#f8fafc; border-bottom:1px solid #e5e7eb; }
.table tbody td{ padding:12px 14px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
.t-right{ text-align:right; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
.small{ font-size:.85rem; color:#334155; }
.msg{ color:#0f172a; }
.tags{ display:flex; gap:6px; margin-top:4px; }
.tag{ background:#eef2ff; color:#4338ca; border-radius:9999px; padding:2px 8px; font-size:.75rem; }

/* Badge livelli */
.badge{ padding:4px 8px; border-radius:999px; font-size:.75rem; font-weight:700; }
.success{ background:#ecfdf5; color:#16a34a; }
.warning{ background:#fffbeb; color:#d97706; }
.danger{ background:#fef2f2; color:#ef4444; }
.muted-chip{ background:#f1f5f9; color:#475569; }

/* Azioni */
.icon-btn{ border:none; background:#f1f5f9; padding:6px 8px; border-radius:8px; cursor:pointer; color:#475569;}
.icon-btn:hover{ filter:brightness(.96); }
.actions{ display:flex; gap:8px; justify-content:flex-end; }

/* Dettagli */
.details{ background:#fcfcfd; color:#475569;}
.details .grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:14px; color:#475569;}
.pre{ margin:0; max-height:280px; overflow:auto; background:#0b1020; color:#e5e7eb; padding:10px; border-radius:8px; }

/* Pager */
.pager{ display:flex; align-items:center; justify-content:center; gap:12px; padding:12px; }


@media (max-width: 1024px){
  .filters{ grid-template-columns: repeat(2, minmax(0,1fr)); }
  .field.grow{ grid-column: span 2; }
  .details .grid{ grid-template-columns:1fr; }
}
@media (max-width: 720px){
  .kpi-row{ grid-template-columns:1fr; }
}


.filters input,
.filters select,
.search-input{
  color:#475569; 
}


.filters input::placeholder,
.search-input::placeholder{
  color:#475569;
  opacity:1; 
}


.filters select option{
  color:#475569;
}


.checkbox,
.switch input[type="checkbox"]{
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid #94a3b8;
  border-radius: 4px;
  background: #fff;
  display: inline-grid;
  place-content: center;
  cursor: pointer;
  vertical-align: middle;
  transition: border-color .12s ease, background-color .12s ease;
}

/* Stato selezionato: fondo verde */
.checkbox:checked,
.switch input[type="checkbox"]:checked{
  background: #22c55e;
  border-color: #22c55e;
}


.checkbox::after,
.switch input[type="checkbox"]::after{
  content: "";
  width: 8px;
  height: 4px;
  border: 2px solid transparent;
  border-top: none;
  border-right: none;
  transform: rotate(-45deg) scale(0);
  transition: transform .12s ease;
}

/* Mostra la spunta quando selezionato */
.checkbox:checked::after,
.switch input[type="checkbox"]:checked::after{
  border-left-color: #fff;   /* spunta bianca */
  border-bottom-color: #fff; /* spunta bianca */
  transform: rotate(-45deg) scale(1);
}



</style>
