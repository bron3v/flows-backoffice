// src/utils/api.js
import router, { markLoggedOut } from '@/router'   // importa anche markLoggedOut dallo stesso modulo

export async function request(path, { method = 'GET', body, headers, skipAuthRedirect = false } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  }
  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const res = await fetch(path, opts)
  const ct = res.headers.get('content-type') || ''
  const payload = ct.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => '')

  // Determina se evitare il redirect (pagina pubblica o chiamata marcata come "skip")
  const current = router.currentRoute?.value
  const onPublicRoute = Boolean(current && current.meta && current.meta.public)
  const shouldSkip = Boolean(skipAuthRedirect || onPublicRoute)

  // --- Guardia universale 401 ---
  if (res.status === 401) {
    // Uniforma l'errore per i caller
    const err = new Error(payload?.message || 'Unauthorized')
    err.status = 401
    err.data = payload

    if (shouldSkip) {
      // Niente logout e NIENTE redirect: lascia gestire al chiamante
      throw err
    }

    // Caso normale: invalida stato locale e vai al login
    markLoggedOut?.()

    const isLoginRoute = current?.path?.startsWith('/login')
    const where = location.pathname + location.search + location.hash

    if (!isLoginRoute) {
      router.replace(`/login?redirect=${encodeURIComponent(where)}`)
    }

    throw err
  }

  if (!res.ok) {
    const err = new Error(payload?.message || `HTTP ${res.status}`)
    err.status = res.status
    err.data = payload
    throw err
  }

  return payload
}

// --- API convenience ---
export const api = {
  // Auth
  async login(username, password) {
    try {
      return await request('/auth/login', {
        method: 'POST',
        body: { username, password },
        // siamo su pagina pubblica (login), lo skip avverrà già automaticamente dal guard,
        // ma lasciamo che questo resti false per coerenza
      })
    } catch (err) {
      if (err.status === 401) {
        return { ok: false, message: 'invalid_credentials' }
      }
      throw err
    }
  },
  logout() { return request('/auth/logout', { method: 'POST' }) },
  me() { return request('/me') },

  // KPI / Utenti
  stats() { return request('/admin/api/stats') },
  usersList() { return request('/admin/api/users') },
  deleteUser(id) {
    return request(`/admin/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // 🔹 Richiesta approvazione (NO redirect al login sui 401)
  // 🔹 Richiesta approvazione (NO redirect al login sui 401)
  requestApproval({ name, email, username, role, requested_role }) {
    const r = role ?? requested_role
    // tenta l'endpoint pubblico moderno
    return request('/auth/request-approval', {
      method: 'POST',
      body: { name, email, username, role: r, requested_role: r },
      skipAuthRedirect: true,
    }).catch(err => {
      // fallback legacy se l'endpoint pubblico non esiste
      if (err && err.status === 404) {
        return request('/admin/api/approvals/request', {
          method: 'POST',
          body: { name, email, username, role: r, requested_role: r },
          skipAuthRedirect: true,
        })
      }
      throw err
    })
  },


  // Lista richieste pendenti (protetta)
  approvalsList() {
    return request('/admin/api/approvals')
  },

  // Approva richiesta (protetta)
  approvalsApprove({ id, name, email, username, role, requested_role }) {
    const r = role ?? requested_role
    return request('/admin/api/approvals/approve', {
      method: 'POST',
      body: { id, name, email, username, role: r, requested_role: r },
    })
  },
}
