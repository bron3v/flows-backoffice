// src/utils/api.js
import router from '@/router'
import { markLoggedOut } from '@/router'   // ⬅️ importa gli helper del router

export async function request(path, { method = 'GET', body, headers } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  };
  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(path, opts);
  const ct = res.headers.get('content-type') || '';
  const payload = ct.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => '');

  // --- Guardia universale 401 per /admin/api/* e co. ---
  if (res.status === 401) {
    // invalida lo stato locale
    markLoggedOut?.();

    // evita redirect mentre stai già facendo login
    const isLoginRoute = router.currentRoute?.value?.path?.startsWith('/login');

    // costruisci "redirect" verso la pagina in cui eri
    const where = location.pathname + location.search + location.hash;

    if (!isLoginRoute) {
      router.replace(`/login?redirect=${encodeURIComponent(where)}`);
    }

    // uniforma l'errore per i caller
    const err = new Error(payload?.message || 'Unauthorized');
    err.status = 401;
    err.data = payload;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(payload?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = payload;
    throw err;
  }
  return payload;
}

// --- API convenience (lascia invariato il resto) ---
export const api = {
  async login(username, password) {
    try {
      return await request('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
    } catch (err) {
      if (err.status === 401) {
        return { ok: false, message: 'invalid_credentials' };
      }
      throw err;
    }
  },

  logout() { return request('/auth/logout', { method: 'POST' }); },
  me() { return request('/me'); },
  stats() { return request('/admin/api/stats'); },
  usersList() { return request('/admin/api/users'); },
  deleteUser(id) { return request(`/admin/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  approveUser(payload) { return request('/admin/api/approvals/approve', { method: 'POST', body: payload }); },
  sendMail({ email, name }) { return request('/api/mail/send', { method: 'POST', body: { email, name } }); },
};
