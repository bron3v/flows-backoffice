import { createRouter, createWebHistory } from 'vue-router'

// Lazy routes (nomi file come sono sul disco)
const Home  = () => import('../views/Homeview.vue')
const Login = () => import('../views/Loginview.vue')
const Users = () => import('../views/Usersview.vue')
const AccountRequest = () => import('../views/AccountRequestview.vue')
const Logs = () => import('../views/Logsview.vue')
const ChangePassword = () => import("../views/ChangePasswordview.vue")

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home, meta: { requiresAuth: true } },

    // PUBBLICHE
    { path: '/login', name: 'login', component: Login, meta: { public: true } },
    { path: '/account-request', name: 'account-request', component: AccountRequest, meta: { public: true } },

    // PROTETTE
    { path: '/utenti', name: 'utenti', component: Users, meta: { requiresAuth: true } },
    { path: '/users', redirect: '/utenti' },
    { path: '/logs', name: 'logs', component: Logs, meta: { requiresAuth: true } },
    { path: '/change-password', name: 'change-password', component: ChangePassword, meta: {requiresAuth: true} },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// --- mini helper cache
function safeSet(k, v) { try { sessionStorage.setItem(k, v) } catch {} }
// esportiamo per i componenti (es. logout/login)
export function markLoggedIn ()  { safeSet('flows_logged', '1'); safeSet('flows_logged_ts', String(Date.now())) }
export function markLoggedOut () { safeSet('flows_logged', '0'); safeSet('flows_logged_ts', String(Date.now())) }

// ping /me con timeout (non usato nel guard, ma lo lasciamo pronto)
async function meWithTimeout(ms = 2500) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort('timeout'), ms)
  try {
    const r = await fetch('/me', { credentials: 'include', cache: 'no-store', signal: ctrl.signal })
    if (!r.ok) return false
    const j = await r.json().catch(() => null)
    return j && j.ok === true
  } catch { return false }
  finally { clearTimeout(t) }
}

// Guardie
const AUTH_CACHE_KEY = 'flows_logged'
function isLogged() {
  try { return sessionStorage.getItem(AUTH_CACHE_KEY) === '1' } catch { return false }
}
function getRole() {
  try { return (sessionStorage.getItem('flows_role') || '').toLowerCase() } catch { return '' }
}
const ALLOWED = new Set(['admin','user_manager','logs_manager']) // 'user' fuori dalle pagine protette

router.beforeEach(async (to, _from, next) => {
  if (to.meta && to.meta.public) return next()

  const logged = isLogged()
  const role = getRole()

  if (to.meta && to.meta.requiresAuth) {
    if (!logged) {
      const redirect = encodeURIComponent(to.fullPath || '/')
      return next(`/login?redirect=${redirect}`)
    }
    // ⬇️ SKIP controllo ruolo solo per change-password
    if (to.name !== 'change-password' && !ALLOWED.has(role)) {
      return next({ path: '/login', query: { denied: 'role' } })
    }
  }

  if (to.path.startsWith('/login') && logged && ALLOWED.has(role)) {
    return next('/')
  }

  return next()
})


export default router
