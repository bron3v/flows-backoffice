<template>
  <main class="auth-shell">
    <section class="flows-card">
      <!-- Brand -->
      <div class="brand">
        <h2 id="brand-name">FLOWS BACKOFFICE</h2>
      </div>

      <!-- Banner/Notifica -->
      <div class="notice warn">
        <strong>Password richiesta:</strong>
        <span>Per proteggere il tuo account, imposta una nuova password.</span>
      </div>

      <!-- Card cambio password -->
      <div class="login-card">
        <h1 class="title">Cambia password</h1>

        <p class="muted" style="margin-top:-4px">
          La nuova password deve rispettare i requisiti minimi indicati.
        </p>

        <form @submit.prevent="submitChange">
          <!-- Nuova password -->
          <div class="form-group">
            <div class="field-with-action">
              <input
                v-model.trim="password"
                :type="showPass ? 'text' : 'password'"
                :class="['input', { invalid: password && !(passLenOk && passHasLetter && passHasDigit) }]"
                placeholder="Nuova password"
                required
                autocomplete="new-password"
                inputmode="text"
              />
              <button
                class="eye-btn"
                type="button"
                aria-label="Mostra/Nascondi password"
                @click="showPass = !showPass"
              >
                {{ showPass ? '🙈' : '👁️' }}
              </button>
            </div>

            <ul class="rules">
              <li :class="{ ok: passLenOk }">Minimo {{ MIN_LEN }} caratteri</li>
              <li :class="{ ok: passHasLetter }">Almeno una lettera</li>
              <li :class="{ ok: passHasDigit }">Almeno una cifra</li>
            </ul>
          </div>

          <!-- Conferma -->
          <div class="form-group">
            <div class="field-with-action">
              <input
                v-model.trim="confirm"
                :type="showConfirm ? 'text' : 'password'"
                :class="['input', { invalid: confirm && !match }]"
                placeholder="Conferma password"
                required
                autocomplete="new-password"
                inputmode="text"
              />
              <button
                class="eye-btn"
                type="button"
                aria-label="Mostra/Nascondi conferma password"
                @click="showConfirm = !showConfirm"
              >
                {{ showConfirm ? '🙈' : '👁️' }}
              </button>
            </div>

            <p v-if="confirm && !match" class="help error">Le password non coincidono.</p>
          </div>

          <!-- Azioni -->
          <!-- Azioni -->
          <div class="actions">
            <button class="btn primary" :disabled="!canSubmit || loading">
              {{ loading ? 'Salvataggio…' : 'Aggiorna password' }}
            </button>
          </div>

          <!-- Link login -->
          <p class="back-to-login">
            Torna al <RouterLink to="/login">login</RouterLink>
          </p>


          <!-- Esiti -->
          <p v-if="err" class="feedback error">{{ err }}</p>
          <p v-if="ok" class="feedback success">Password aggiornata con successo.</p>
        </form>
      </div>
    </section>
  </main>
</template>


<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/utils/api'

const router = useRouter()
const route = useRoute()

// Stato
const password = ref('')
const confirm = ref('')
const showPass = ref(false)
const showConfirm = ref(false)
const loading = ref(false)
const err = ref('')
const ok = ref(false)

// Policy minima
const MIN_LEN = 8
const passLenOk = computed(() => password.value.length >= MIN_LEN)
const passHasLetter = computed(() => /[A-Za-z]/.test(password.value))
const passHasDigit = computed(() => /\d/.test(password.value))
const match = computed(() => password.value && confirm.value && password.value === confirm.value)

const canSubmit = computed(() =>
  passLenOk.value && passHasLetter.value && passHasDigit.value && match.value && !loading.value
)

// Handlers
async function submitChange () {
  if (!canSubmit.value) return
  loading.value = true
  err.value = ''
  ok.value = false

  try {
    // 1) Preferisci l’SDK locale se esiste
    if (typeof api.changePassword === 'function') {
      const res = await api.changePassword({ password: password.value })
      if (!res?.ok) throw new Error(res?.error || 'Impossibile aggiornare la password')
    } else {
      // 2) Fallback REST
      const res = await fetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: password.value })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Errore di rete')
      }
    }

    ok.value = true
    //Redirect dopo breve pausa
    setTimeout(() => {
      const redirect = route.query.redirect || '/'
      router.push(String(redirect))
    }, 800)
  } catch (e) {
    err.value = e?.message || 'Errore sconosciuto'
  } finally {
    loading.value = false
  }
}

</script>

<style scoped>

/* ---------- Layout ---------- */
.auth-shell{
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #eef2f7;
  padding: 24px;
}
.flows-card{
  width: 100%;
  max-width: 520px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
}

/* Brand */
.brand{
  padding: 16px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}
#brand-name{
  margin: 0;
  letter-spacing: .08em;
  font-weight: 800;
  font-size: 14px;
  color: #111827;
}

/* Banner */
.notice{
  padding: 12px 16px;
  display: grid;
  gap: 4px;
  border-bottom: 1px solid #e5e7eb;
}
.notice.warn{ background:#fffbeb; color:#7c2d12; }

/* ---------- Card contenuto ---------- */
.login-card{
  padding: 18px;
  display: grid;
  gap: 14px;
  overflow: hidden;               
}
.login-card *{ box-sizing: border-box; } 

.title{ font-size: 22px; font-weight: 800; margin: 0; color:#0f172a; }
.muted{ color:#6b7280; }
.form-group{ display:grid; gap:8px; }

/* ---------- Campi ---------- */
.input, button.btn{ width:100%; display:block; }
.input{
  border: 1px solid #cbd5e1;       
  border-radius: 10px;
  padding: 10px 12px;
  background: #ffffff;
  outline: none;
  font-size: 14px;
  color: #0f172a;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.input::placeholder{ color:#94a3b8; }
.input:focus{
  border-color:#1cb5a9;            
  box-shadow: 0 0 0 3px rgba(28,181,169,.18);
}

/* Stato di errore (solo quando .invalid) */
.input.invalid{
  border-color:#ef4444;
  background:#fff5f5;
  color:#991b1b;
}
.input.invalid::placeholder{ color:#fca5a5; }
.input.invalid:focus{
  border-color:#dc2626;
  box-shadow: 0 0 0 3px rgba(220,38,38,.15);
}

/* Eye button */
.field-with-action{ position:relative; display:grid; }
.eye-btn{
  position: absolute; right:8px; top:50%;
  transform: translateY(-50%);
  border:none; background:transparent;
  cursor:pointer; font-size:16px;
}

/* Requisiti */
.rules{
  list-style:none; padding:0;
  display:grid; gap:4px;
  font-size:12px; color:#6b7280;
  margin: 0 0 12px 0;             
}
.rules li{ display:flex; align-items:center; gap:6px; }
.rules li::before{ content:'•'; transform:translateY(-1px); opacity:.6; margin-right:2px; }
.rules li.ok{ color:#166534; }
.rules li.ok::before{ content:'✓'; opacity:1; }

/* Azioni */
.actions{
  display:flex;
  justify-content:center;         
  margin-top:8px;
}
.btn{
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
}
.btn.primary{
  background:#1cb5a9; color:#fff; border-color:#1cb5a9;
  width:100%; max-width:280px;     
}
.btn.primary:hover{ filter:brightness(.98); }
.btn:disabled{
  opacity: .6;
  cursor: default;   
}


/* Feedback / link */
.feedback{ margin:6px 2px 0; font-size:14px; }
.feedback.success{ color:#166534; }
.feedback.error{ color:#b91c1c; }
.help.error{ color:#b91c1c; font-size:12px; margin-top:4px; }

.back-to-login{
  margin: 10px 0 0;
  text-align:center;
  font-size:13px;
  color:#374151;
}
.back-to-login a{
  color:#1cb5a9; font-weight:700;
  text-decoration:underline; text-underline-offset:2px;
}
.back-to-login a:hover{ color:#15978f; }
</style>


