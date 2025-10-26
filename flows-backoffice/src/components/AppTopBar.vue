<template>
  <header
    class="app-topbar"
    :class="{ fullbleed: fullBleed }"
    :style="{
      background: '#ffffff',
      color: '#0b0b0c',
      borderBottom: '1px solid #e6e8ef',
      boxShadow: '0 1px 0 rgba(17,17,17,0.04)'
    }"
  >
    <h1 class="app-topbar-title">{{ title }}</h1>

    <div class="app-top-actions">
      <div
        class="app-search"
        :style="{
          background: '#f5f7fb',
          border: '1px solid #e6e8ef'
        }"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 21l-3.8-3.8M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </svg>
        <input
          class="topbar-search"
          :placeholder="searchPlaceholder"
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="$emit('search', modelValue)"
        />
      </div>

      <slot name="actions"></slot>

      <AvatarCard
        class="avatarButton"
        :avatar-initial="avatarInitial"
        :user-name="sessionUser?.username || 'Utente'"
        :user-email="sessionUser?.username || 'username'"
        @click="$emit('profile')"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import AvatarCard from '@/components/AvatarCard.vue'

interface SessionUser { id?: string|number; username?: string; email?: string; [k:string]: unknown }

const props = withDefaults(defineProps<{
  title?: string
  modelValue?: string
  searchPlaceholder?: string
  sessionUser?: SessionUser | null
  avatarInitial?: string
  fullBleed?: boolean        
}>(), {
  title: 'Dashboard',
  modelValue: '',
  searchPlaceholder: 'Search…',
  sessionUser: null,
  avatarInitial: 'A',
  fullBleed: false
})
</script>

<style scoped>
.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #ffffff;
  color: #0b0b0c;
  border-bottom: 1px solid #e6e8ef;
  box-shadow: 0 1px 0 rgba(17,17,17,0.04);
}

/* 👉 versione “attaccata”: compensa il padding 24px di .main */
.app-topbar.fullbleed {
  margin: -24px -24px 16px;   /* sborda a sx/dx e su */
  padding: 14px 24px;         /* riallinea il contenuto */
  border-radius: 0;           /* niente angoli */
}

.app-topbar-title { font-size: 20px; font-weight: 700; margin: 0;}
.app-top-actions { display: flex; gap: 12px; align-items: center; }
.app-search {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border: none;
  box-shadow: none;
  background:  #eef2f7;
}
.app-search svg { width: 18px; height: 18px; }
.app-search input {
  background: transparent; border: none; outline: none;
  color: #0b0b0c; min-width: 220px;
}
.app-search input::placeholder { color:  #eef2f7; }

.topbar-search{
  padding: 0
}
.avatarButton{
  padding:0
}
</style>