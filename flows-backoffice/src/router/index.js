// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    // Cambia il nome del file se serve: HomeView.vue (V maiuscola) è il default dei template
    component: () => import('../views/Homeview.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Loginview.vue')
  },
  // opzionale: cattura rotte sconosciute
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// Helper: controlla lo stato login dal server e sincronizza sessionStorage
async function ensureAuthSynced () {
  // usa cache locale prima
  const cached = sessionStorage.getItem('flows_logged')
  if (cached === '1') return true
  if (cached === '0') return false

  // non sappiamo: chiedi al server
  try {
    const res = await fetch('/me', { credentials: 'include' })
    const ok = res.ok
    let data = null
    if (ok && (res.headers.get('content-type') || '').includes('application/json')) {
      data = await res.json()
    }
    const logged = ok && data?.ok === true
    sessionStorage.setItem('flows_logged', logged ? '1' : '0')
    return logged
  } catch {
    sessionStorage.setItem('flows_logged', '0')
    return false
  }
}

// Guard asincrono
router.beforeEach(async (to, from, next) => {
  const requiresAuth = !!to.meta.requiresAuth

  const logged = await ensureAuthSynced()

  if (requiresAuth && !logged) {
    return next('/login')
  }
  if (to.path === '/login' && logged) {
    return next('/')               // se già loggato, niente login
  }
  next()
})

export default router
