// src/utils/api.js
async function request(path, { method = 'GET', body, headers } = {}) {
  const opts = {
    method,
    credentials: 'include',            // <-- manda i cookie di sessione
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  };
  if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);

  const res = await fetch(path, opts);
  if (res.status === 401) {
    // opzionale: lascia traccia che non sei loggato
    throw new Error('NOT_LOGGED_IN');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  // prova JSON, altrimenti restituisci Response grezzo
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res;
}

// --- wrapper comodi ---
// src/utils/api.js
export const api = {
  async login(email, password) {
    const res = await fetch('/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',             // serve per la sessione
      body: JSON.stringify({ email, password })
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  },

  async me() {
    const res = await fetch('/me', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, ...data }
  },

  async stats() {
    const res = await fetch('/admin/api/stats', { credentials: 'include' })
    return res.json()
  }
}

