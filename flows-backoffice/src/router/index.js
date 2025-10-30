import { createRouter, createWebHistory } from 'vue-router'

// Lazy routes (nomi file come sono sul disco)
const Home  = () => import('../views/Homeview.vue')
const Login = () => import('../views/Loginview.vue')
const Users = () => import('../views/Usersview.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: Login },
    { path: '/utenti', name: 'utenti', component: Users, meta: { requiresAuth: true } }, // 👈
    // opzionale: compat per vecchi link /users
    { path: '/users', redirect: '/utenti' },
    { path: '/logs', name: 'logs', component: () => import('@/views/Logsview.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
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
// helper mini-cache
const AUTH_CACHE_KEY = 'flows_logged'
function isLogged() {
  try { return sessionStorage.getItem(AUTH_CACHE_KEY) === '1' } catch { return false }
}
function getRole() {
  try { return (sessionStorage.getItem('flows_role') || '').toLowerCase() } catch { return '' }
}
const ALLOWED = new Set(['admin','user_manager','logs_manager'])

router.beforeEach(async (to, from, next) => {
  const logged = isLogged()
  const role = getRole()

  // Rotte protette
  if (to.meta?.requiresAuth) {
    if (!logged) {
      const redirect = encodeURIComponent(to.fullPath || '/')
      return next(`/login?redirect=${redirect}`)
    }
    if (!ALLOWED.has(role)) {
      // ruolo non sufficiente → torna al login con messaggio
      return next({ path: '/login', query: { denied: 'role' } })
    }
  }

  // Se già loggato e provi ad andare su /login, resta in app
  if (to.path.startsWith('/login') && logged && ALLOWED.has(role)) {
    return next('/app')
  }

  return next()
})


export default router;
