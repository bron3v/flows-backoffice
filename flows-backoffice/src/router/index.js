import { createRouter, createWebHistory } from 'vue-router'

 //Definizione delle route dell'app.
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Homeview.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Loginview.vue'),
  },
  // Catch-all: qualsiasi rotta sconosciuta rimanda alla home o a una 404
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

/**
 * History "HTML5" con base URL presa dalla configurazione di Vite.
 * scrollBehavior: resetta lo scroll in alto su ogni navigazione.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * Mini cache (sessionStorage) per lo stato di login:
 * - '1' = loggato, '0' = non loggato
 * - timestamp per invalidare la cache dopo TTL (per evitare /me continui)
 */
const AUTH_CACHE_KEY = 'flows_logged'
const AUTH_CACHE_TS_KEY = 'flows_logged_ts'
const AUTH_CACHE_TTL_MS = 30_000 // 30s: abbastanza breve per restare coerenti

let inFlightAuthPromise = null // evita richieste /me parallele

/**
 * ensureAuthSynced()
 * - Ritorna true/false se l'utente è loggato.
 * - Usa prima la cache locale; se scaduta o assente, chiama /me (con cookie).
 * - Gestisce sia risposte JSON che testo semplice.
 */
async function ensureAuthSynced () {
  //Prova cache se non scaduta
  try {
    const cached = sessionStorage.getItem(AUTH_CACHE_KEY)
    const ts = Number(sessionStorage.getItem(AUTH_CACHE_TS_KEY) || 0)
    const fresh = Date.now() - ts < AUTH_CACHE_TTL_MS

    if ((cached === '1' || cached === '0') && fresh) {
      return cached === '1'
    }
  } catch {
    // Ignora errori su sessionStorage
  }

  //Evita richieste parallele: riusa la stessa promise se esiste
  if (inFlightAuthPromise) {
    try {
      return await inFlightAuthPromise
    } catch {
      // Se fallisce, continua con una nuova richiesta
    }
  }

  inFlightAuthPromise = (async () => {
    try {
      const res = await fetch('/me', { credentials: 'include' })
      const ct = res.headers.get('content-type') || ''
      let data = null
      if (ct.includes('application/json')) {
        data = await res.json()
      } else {
        await res.text().catch(() => {})
      }

      const logged = res.ok && data?.ok === true
      try {
        sessionStorage.setItem(AUTH_CACHE_KEY, logged ? '1' : '0')
        sessionStorage.setItem(AUTH_CACHE_TS_KEY, String(Date.now()))
      } catch {}

      return logged
    } catch {
      // In caso di rete offline o errore generico: considera non loggato e cache brevemente
      try {
        sessionStorage.setItem(AUTH_CACHE_KEY, '0')
        sessionStorage.setItem(AUTH_CACHE_TS_KEY, String(Date.now()))
      } catch {}
      return false
    } finally {
      inFlightAuthPromise = null
    }
  })()

  return await inFlightAuthPromise
}

/**
 * beforeEach:
 * - Se la rotta richiede auth e non sei loggato → vai a /login
 *   (passando ?redirect=<rotta-desiderata> per tornare dopo il login)
 * - Se vai su /login ma sei già loggato → rimanda a '/'
 */
router.beforeEach(async (to, from, next) => {
  const requiresAuth = Boolean(to.meta.requiresAuth)

  // Sincronizza lo stato di login con il server (cache + /me)
  const logged = await ensureAuthSynced()

  if (requiresAuth && !logged) {
    // Conserva la rotta che volevi visitare per il redirect post-login
    const redirect = to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {}
    return next({ path: '/login', query: redirect })
  }

  if (to.path === '/login' && logged) {
    // Già loggato: torna alla home (o a redirect se presente)
    const back = from && from.fullPath ? from.fullPath : '/'
    return next(back === '/login' ? '/' : back)
  }

  return next()
})

export default router
