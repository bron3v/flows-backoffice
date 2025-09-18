<template>
  <main class="auth-shell">
    <section class="flows-card">
      <div class="brand">
        <h2 id="brand-name">FLOWS BACKOFFICE</h2>
      </div>

      <div class="login-card">
        <h1 class="title">Login</h1>

        <form @submit.prevent="goHome">
          <div class="form-group">
            <input
              v-model.trim="form.username"
              type="email"
              placeholder="E-mail"
              required
              class="input"
            />
          </div>

          <div class="form-group">
            <input
              v-model="form.password"
              type="password"
              placeholder="Password"
              required
              class="input"
            />
          </div>

          <div>
            <button class="btn">Login</button>
          </div>
        </form>
      </div>
    </section>
  </main>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'

const form = reactive({ username: '', password: '' })
const router = useRouter()
function goHome () {
  sessionStorage.setItem('flows_logged', '1'); // segna “loggato” per la sessione corrente
  router.push('/');                            // vai alla home (root)
}

</script>

<style scoped>
/* Sfondo esterno */
.auth-shell {
  min-height: 100vh;
  background: #bfc5c8;
  display: grid;
  place-items: center;
  padding: 18px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}


.flows-card {
  width: min(850px, 96vw);
  min-height: 600px;
  background: #17aba2;
  border-radius: 28px;
  box-shadow: 0 12px 30px rgba(0,0,0,.18);
  position: relative;
  padding: 40px 28px 28px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;     /* centra i figli orizzontalmente */
  align-content: start;     
}


.brand {
  width: 100%;
  text-align: center;        
  margin: 6px 0 24px;
}
#brand-name {
  margin: 0;
  font-size: clamp(28px, 6vw, 64px);
  font-weight: 800;
  letter-spacing: .5px;
  color: #ececef;
}


.login-card {
  width: min(380px, 90vw);
  height:min(380px, 90vw) ;   
  background: #ececef;
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(0,0,0,.16);
  padding: 14px 16px 18px;   
  text-align: center;        /* centra tutti i testi interni */
}

.title {
  margin: 6px 0 12px;
  font-size: 24px;
  font-weight: 700;
  color: #1cb5a9;
}

/* Campi input */
.form-group { margin-bottom: 10px; }

.input {
  width: 100%;
  height: 40px;
  padding: 0;
  font-size: 14px;
  color: #111827;
  background: #fff;
  border: 1px solid #1cb5a9;
  border-radius: 8px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.input::placeholder { color: #8fa3a9; }
.input:focus {
  border-color: #15978f;
  box-shadow: 0 0 0 3px rgba(28,181,169,.18);
}

.btn {
  width: 100%;
  height: 42px;
  border: none;
  background: #1cb5a9;
  color: #fff;
  border-radius: 12px;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  transition: transform .06s ease, filter .15s ease;
}
.btn:hover { filter: brightness(0.96); }
.btn:active { transform: translateY(1px); }

/* Responsive */
@media (max-width: 720px) {
  #brand-name { font-size: clamp(28px, 8vw, 48px); }
}
</style>
