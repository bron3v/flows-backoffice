// src/utils/api.js

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

  if (!res.ok) {
    const err = new Error(payload?.message || `HTTP ${res.status}`);
    err.status = res.status;   // <<< attacco lo status
    err.data = payload;
    throw err;
  }
  return payload;
}

export const api = {
  async login(username, password) {
    try {
      return await request('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
    } catch (err) {
      if (err.status === 401) {
        // mappa il 401 in un risultato “non ok” così il tuo doLogin continua a funzionare
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
