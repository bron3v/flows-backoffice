import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/index',
    name: 'home',
    component: () => import('../views/Homeview.vue')
  },

  {
  path: '/',
  name: 'auth',
  component: () => import('../views/Loginview.vue'),
  },

];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
