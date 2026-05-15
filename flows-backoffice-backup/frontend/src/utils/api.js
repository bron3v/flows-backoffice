import router, { markLoggedOut } from '@/router'

// Richiesta HTTP con
export async function request(
  path,
  { method = 'GET', body, headers, skipAuthRedirect = false } = {}
) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) }
  }

  if (body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const res = await fetch(path, opts)

  const ct = res.headers.get('content-type') || ''
  const payload = ct.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => '')

  // Route corrente 
  const current = router.currentRoute?.value
  const onPublicRoute = Boolean(current && current.meta && current.meta.public)
  const shouldSkip = Boolean(skipAuthRedirect || onPublicRoute)

  // Guardia universale 401 (sessione scaduta / non loggato)
  if (res.status === 401) {
    const err = new Error(payload?.message || 'Unauthorized')
    err.status = 401
    err.data = payload

    if (!shouldSkip) {
      // invalida stato locale e porta al login con redirect
      markLoggedOut?.()
      const isLoginRoute = current?.path?.startsWith('/login')
      const where = location.pathname + location.search + location.hash
      if (!isLoginRoute) {
        router.replace(`/login?redirect=${encodeURIComponent(where)}`)
      }
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

// Wrapper di comodo per le API dell’app. Restituisce sempre l’oggetto payload del backend.
export const api = { 
  async login(username, password) {
    // /auth/login restituisce 200 anche per credenziali errate con { ok:false, message:'invalid_credentials' }
    return request('/auth/login', {
      method: 'POST',
      body: { username, password }
    })
  },

  logout() {
    return request('/auth/logout', { method: 'POST' })
  },

  me() {
    return request('/me')
  },

  //Cambio password per nuovi utenti
  async changePassword({ password, current_password, new_password } = {}) {
    const body =
      typeof current_password === 'string' && typeof new_password === 'string'
        ? { current_password, new_password }
        : { password }

    return request('/auth/change-password', {
      method: 'POST',
      body
    })
  },


  stats() {
    return request('/admin/api/stats')
  },

  usersList() {
    return request('/admin/api/users')
  },

  deleteUser(id) {
    return request(`/admin/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  },


  requestApproval({ name, email, username, role, requested_role }) {
    const r = role ?? requested_role
    return request('/auth/request-approval', {
      method: 'POST',
      body: { name, email, username, role: r, requested_role: r },
      skipAuthRedirect: true
    }).catch(err => {
      if (err && err.status === 404) {
        return request('/admin/api/approvals/request', {
          method: 'POST',
          body: { name, email, username, role: r, requested_role: r },
          skipAuthRedirect: true
        })
      }
      throw err
    })
  },

  approvalsList() {
    return request('/admin/api/approvals')
  },

  approvalsApprove({ id, name, email, username, role, requested_role }) {
    const r = role ?? requested_role
    return request('/admin/api/approvals/approve', {
      method: 'POST',
      body: { id, name, email, username, role: r, requested_role: r }
    })
  }
}
