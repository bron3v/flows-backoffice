// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

// --- Views lazy ---
const Home = () => import('../views/Homeview.vue')
const Login = () => import('../views/Loginview.vue')

// --- Routes ---
const routes = [
  { path: '/', name: 'home', component: Home, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: Login },
  { path: '/:pathMatch(.*)*', redirect: '/' } // catch-all
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// --- Mini cache auth ---
const AUTH_CACHE_KEY = 'flows_logged'
const AUTH_CACHE_TS_KEY = 'flows_logged_ts'
const AUTH_CACHE_TTL_MS = 15_000 // 15s: reattivo ma evita spam di /me

let inFlightAuthPromise = null

function safeSetSession(k, v) {
  try { sessionStorage.setItem(k, v) } catch {}
}
function safeGetSession(k) {
  try { return sessionStorage.getItem(k) } catch { return null }
}

function getRedirectQuery(to) {
  // evita redirect ricorsivi o malevoli
  const q = to?.query?.redirect
  if (typeof q !== 'string') return null
  if (q.startsWith('http://') || q.startsWith('https://')) return '/' // no open-redirect
  return q || null
}

async function ensureAuthSynced () {
  // cache
  const cached = safeGetSession(AUTH_CACHE_KEY)
  const ts = Number(safeGetSession(AUTH_CACHE_TS_KEY) || 0)
  const fresh = Date.now() - ts < AUTH_CACHE_TTL_MS
  if ((cached === '1' || cached === '0') && fresh) {
    return cached === '1'
  }

  // evita richieste parallele
  if (inFlightAuthPromise) {
    try { return await inFlightAuthPromise } catch { /* retry below */ }
  }

  inFlightAuthPromise = (async () => {
    try {
      const res = await fetch('/me', { credentials: 'include' })
      let data = null
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        data = await res.json()
      } else {
        await res.text().catch(() => {})
      }
      const logged = res.ok && data?.ok === true
      safeSetSession(AUTH_CACHE_KEY, logged ? '1' : '0')
      safeSetSession(AUTH_CACHE_TS_KEY, String(Date.now()))
      return logged
    } catch {
      // offline / errore generico → considera non loggato per poco
      safeSetSession(AUTH_CACHE_KEY, '0')
      safeSetSession(AUTH_CACHE_TS_KEY, String(Date.now()))
      return false
    } finally {
      inFlightAuthPromise = null
    }
  })()

  return await inFlightAuthPromise
}

// src/router/index.js
async function meWithTimeout(ms = 3000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), ms);
  try {
    const res = await fetch('/me', { credentials: 'include', cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return false;
    const j = await res.json().catch(() => null);
    return j?.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

router.beforeEach(async (to, from, next) => {
  if (!to.meta.requiresAuth) return next();
  const ok = await meWithTimeout(3000); // mai attendere all’infinito
  if (ok) return next();
  return next({ path: '/login', query: { redirect: to.fullPath } });
});

// --- helpers usati dal Login view ---
export function markLoggedOut () {
  safeSetSession(AUTH_CACHE_KEY, '0')
  safeSetSession(AUTH_CACHE_TS_KEY, String(Date.now()))
}
export function markLoggedIn () {
  safeSetSession(AUTH_CACHE_KEY, '1')
  safeSetSession(AUTH_CACHE_TS_KEY, String(Date.now()))
}

export default router
