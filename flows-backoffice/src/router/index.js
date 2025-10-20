import { createRouter, createWebHistory } from 'vue-router'

// Lazy routes (nomi file come sono sul disco)
const Home  = () => import('../views/Homeview.vue')
const Login = () => import('../views/Loginview.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' }, // avvio -> login
    { path: '/login', name: 'login', component: Login },
    { path: '/app',   name: 'home',  component: Home, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// --- mini helper cache
function safeSet(k, v) { try { sessionStorage.setItem(k, v) } catch {} }
// esportiamo per i componenti (es. logout/login)
export function markLoggedIn ()  { safeSet('flows_logged', '1'); safeSet('flows_logged_ts', String(Date.now())) }
export function markLoggedOut () { safeSet('flows_logged', '0'); safeSet('flows_logged_ts', String(Date.now())) }

// ping /me con timeout
async function meWithTimeout(ms = 2500) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort('timeout'), ms)
  try {
    const r = await fetch('/me', { credentials: 'include', cache: 'no-store', signal: ctrl.signal })
    if (!r.ok) return false
    const j = await r.json().catch(() => null)
    return j?.ok === true
  } catch { return false }
  finally { clearTimeout(t) }
}

// Guardie
router.beforeEach(async (to, from, next) => {
  // Solo le rotte protette richiedono /me
  if (to.meta.requiresAuth) {
    const ok = await meWithTimeout()
    if (ok) return next()
    const red = encodeURIComponent(to.fullPath)
    return next(`/login?redirect=${red}`)
  }
  // IMPORTANTISSIMO: nessun redirect automatico dalla /login → /app
  return next()
})

export default router
