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
export const api = {
  get:  (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),

  // --- AUTH ---
  login: (email, password) => request('/auth', { method: 'POST', body: { email, password } }),
  me:    () => request('/me'),

  // --- ADMIN API protette ---
  stats: () => request('/admin/api/stats'),
  meAdmin: () => request('/admin/api/users/me'),
};
