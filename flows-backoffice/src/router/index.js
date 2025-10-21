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
router.beforeEach((to, from, next) => {
  const logged = sessionStorage.getItem('flows_logged') === '1';

  // 1) Rotte protette: obbliga al login se non loggato
  if (to.meta?.requiresAuth && !logged) {
    const redirect = encodeURIComponent(to.fullPath || '/');
    return next(`/login?redirect=${redirect}`);
  }

  // 2) Se sei già loggato e provi ad andare su /login:
  if (to.path.startsWith('/login') && logged) {
    // se arrivavi da una pagina protetta (es. /app, /, ecc.) resta lì
    if (from?.matched?.some(r => r.meta?.requiresAuth)) {
      return next(false); // ❗ annulla la navigazione: rimani dove sei
    }
    // altrimenti manda alla home/app
    return next('/app'); // se non hai /app, usa '/'
  }

  return next();
});

export default router;
