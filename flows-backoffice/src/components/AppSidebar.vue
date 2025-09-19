<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="logo-dot"></span>
      <span class="brand-name">Flows Backoffice</span>
    </div>

    <nav class="menu">
      <RouterLink to="/" class="item active">Dashboard</RouterLink>
      <RouterLink to="/" class="item">Utenti</RouterLink>
      <RouterLink to="/" class="item">Tabelle</RouterLink>
      <RouterLink to="/" class="item">Moduli</RouterLink>
      <RouterLink to="/" class="item">Impostazioni</RouterLink>
      <a class="item" href="https://github.com" target="_blank" rel="noreferrer">Github</a>
    </nav>
  </aside>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.sidebar{
  width: 240px;
  min-height: 100vh;
  background: linear-gradient(180deg,#111827 0%, #0b1730 100%);
  color:#cbd5e1;
  display:flex;
  flex-direction:column;
  position:sticky; top:0; left:0;
}
.brand{
  display:flex; align-items:center; gap:10px;
  padding:18px 18px 14px; border-bottom:1px solid rgba(255,255,255,.06);
}
.logo-dot{
  width:22px; height:22px; border-radius:50%;
  background:#6ee7b7; display:inline-block;
  box-shadow:0 0 0 3px rgba(110,231,183,.15);
}
.brand-name{ font-weight:700; font-size:1.1rem; letter-spacing:.3px; color:#fff; }

.menu{ padding:8px; display:flex; flex-direction:column; gap:4px; }
.item{
  display:block; padding:10px 12px; border-radius:10px; color:#cbd5e1; text-decoration:none;
}
.item:hover{ background:rgba(255,255,255,.06); color:#fff; }
.item.active{ background:#1f2937; color:#fff; }
@media (max-width: 960px){ .sidebar{ display:none; } }
</style>
