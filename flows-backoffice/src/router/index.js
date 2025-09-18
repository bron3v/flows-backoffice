import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
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
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

//controllo per utente loggato o meno
router.beforeEach((to, from, next) => {
  const logged = sessionStorage.getItem('flows_logged') === '1';
  if (to.meta.requiresAuth && !logged) return next('/login');
  if (to.path === '/login' && logged) return next('/');
  next();
});

export default router;
