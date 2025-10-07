<template>
  <!-- Wrapper che mostra l'avatar e gestisce l'apertura -->
  <div class="avatar-wrapper" ref="triggerRef" @click="open = true">
    <div class="avatar">{{ avatarInitial }}</div>
  </div>

  <!-- Overlay + Card (teletrasportata nel body per z-index pulito) -->
  <teleport to="body">
    <transition name="fade">
      <div v-if="open" class="overlay" @click.self="close" aria-hidden="true"></div>
    </transition>

    <transition name="pop">
      <section
        v-if="open"
        class="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-card-title"
        ref="cardRef"
      >
        <header class="card-header">
          <h3 id="avatar-card-title">Account</h3>
        </header>

        <div class="card-body">
          <div class="user-row">
            <div class="avatar big">{{ avatarInitial }}</div>
            <div class="u-info">
              <strong class="u-name">{{ userName }}</strong>
              <span class="u-mail">{{ userEmail }}</span>
            </div>
          </div>
        </div>

        <footer class="card-footer">
          <button type="button" class="btn btn-ghost" @click="close">Annulla</button>
          <button type="button" class="btn btn-primary" @click="logout">Logout</button>
        </footer>
      </section>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { markLoggedOut } from '@/router' 

const props = defineProps({
  avatarInitial: { type: String, default: 'A' },
  userName: { type: String, default: 'Utente' },
  userEmail: { type: String, default: 'name@example.com' },
  // opzionale: endpoint per logout server-side (se esiste)
  logoutUrl: { type: String, default: '/auth/logout' },
})

const router = useRouter()
const open = ref(false)
const triggerRef = ref(null)
const cardRef = ref(null)

function close () { open.value = false }

async function logout () {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {})
  } finally {
    // Disattiva il guard client
    markLoggedOut()    
    sessionStorage.setItem('flows_logged', '0')
    sessionStorage.removeItem('flows_user')
    localStorage.removeItem('flows_user')

    // vai al login e “taglia” lo storico
    router.replace('/login')

    // fallback hard (se il guard o la cache ti riportano indietro)
    // setTimeout(() => location.href = '/login', 50)
  }
}


function onKey (e) { if (e.key === 'Escape') close() }

onMounted(() => {
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
/* Avatar nella topbar */
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg,#34d399 0%, #10b981 100%); /* verde/teal come in figura */
  color: #082f1f;
  display: grid;
  place-items: center;
  font-weight: 700;
  letter-spacing: .5px;
  user-select: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(16,185,129,.35);
}
.avatar.big{
  width: 44px; height: 44px; font-size: 1.05rem; color:#053c2a;
}
.avatar:not(.big) {
  cursor: pointer;
}
.card .avatar.big {
  cursor: default;          
  pointer-events: none;    
}

/* Overlay */
.overlay{
  position: fixed; inset: 0;
  background: rgba(2,6,23,.35);
  backdrop-filter: blur(2px);
  z-index: 50;
}

/* Card stile modale come nello screenshot */
.card{
  position: fixed;
  top: 64px;       /* cadenzato per apparire vicino alla topbar */
  right: 24px;
  width: 380px;
  max-width: calc(100vw - 32px);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 14px 45px rgba(2,6,23,.30), 0 3px 12px rgba(2,6,23,.18);
  z-index: 60;
  overflow: hidden;
}

.card-header{
  padding: 18px 20px 12px;
  border-bottom: 1px solid rgba(2,6,23,.06);
}
.card-header h3{
  margin:0; font-size: 1.05rem; color:#0b1730; font-weight: 800;
}

.card-body{ padding: 16px 20px; }
.user-row{ display:flex; align-items:center; gap:12px; }
.u-info{ display:flex; flex-direction:column; }
.u-name{ color:#0b1730; font-weight:700; }
.u-mail{ color:#64748b; font-size:.92rem; }

/* Footer con i due bottoni come in figura */
.card-footer{
  display:flex; justify-content:flex-end; gap:10px;
  padding: 14px 16px 16px;
  background: #f8fafc;
  border-top: 1px solid rgba(2,6,23,.06);
}
.btn{
  appearance: none; border:0; outline:0; cursor:pointer;
  padding: 10px 16px; border-radius: 12px; font-weight: 700;
  transition: transform .06s ease, box-shadow .2s ease, background .2s ease;
}
.btn:active{ transform: translateY(1px); }

/* Annulla grigio */
.btn-ghost{
  background: #e5e7eb; color:#0f172a;
}
.btn-ghost:hover{ background:#e2e8f0; }

/* Logout verde/teal come "Invia richiesta" */
.btn-primary{
  background: linear-gradient(135deg,#34d399 0%, #10b981 100%);
  color:#052e22;
  box-shadow: 0 6px 18px rgba(16,185,129,.35);
}
.btn-primary:hover{ filter: brightness(1.02); }

/* Animazioni */
.fade-enter-active,.fade-leave-active{ transition: opacity .15s ease; }
.fade-enter-from,.fade-leave-to{ opacity: 0; }

.pop-enter-active{ transition: transform .16s ease, opacity .16s ease; }
.pop-leave-active{ transition: transform .12s ease, opacity .12s ease; }
.pop-enter-from,.pop-leave-to{ transform: translateY(-6px) scale(.98); opacity: 0; }
</style>
