<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="logo-dot">
        <img src="../assets/logo.png" alt="Logo Flows" />
      </span>
      <span class="brand-name">Flows Backoffice</span>
    </div>

    <nav class="menu">
      <RouterLink
        to="/"
        class="item"
        :class="{ active: $route.path === '/' }"
      >
        Dashboard
      </RouterLink>

      <RouterLink
        to="/utenti"
        class="item"
        :class="{ active: $route.path.startsWith('/utenti') }"
      >
        Utenti
      </RouterLink>

      <RouterLink
        to="/logs"
        class="item"
        :class="{ active: $route.path.startsWith('/logs') }"
      >
        Logs
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
/* =============== SIDEBAR =============== */
.sidebar {
  width: 240px;
  min-height: 100vh;
  background: linear-gradient(180deg, #111827 0%, #0b1730 100%);
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  left: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #6ee7b7;
  display: block;
  overflow: hidden;
  box-shadow: 0 0 0 3px rgba(110, 231, 183, 0.15);
}

.logo-dot img {
  width: 125%;
  height: 110%;
  object-fit: cover;
  display: block;
}

.brand-name {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.3px;
  color: #fff;
}

.menu {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  display: block;
  padding: 10px 12px;
  border-radius: 10px;
  color: #cbd5e1;
  text-decoration: none;
}

.item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.item.active {
  background: #1f2937;
  color: #fff;
}

@media (max-width: 960px) {
  .sidebar {
    display: none;
  }
}
</style>
