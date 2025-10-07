// api/server.js
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const express = require('express')
const session = require('express-session')
const { Pool } = require('pg')
const nodemailer = require('nodemailer')

const app = express()

// ---------- Postgres ----------
const pool = new Pool({
  host: process.env.PGHOST || '172.19.16.1',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'FPW',
  database: process.env.PGDATABASE || 'flows-backoffice',
  port: Number(process.env.PGPORT || 5432)
})

// (facoltativo) search_path, ma usiamo comunque schema esplicito nelle query
pool.on('connect', (client) => {
  client.query('SET search_path TO auth, public')
})

// ---------- Parsers ----------
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ---------- Sessioni ----------
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' }
}))

// ---------- Heartbeat last_seen (max 1 update/min) ----------
app.use(async (req, _res, next) => {
  try {
    if (req.session?.loggedIn && req.session?.user?.id) {
      const now = Date.now()
      const last = req.session._lastSeenAt || 0
      if (now - last > 60_000) {
        req.session._lastSeenAt = now
        await pool.query(
          'UPDATE auth.users SET last_seen = now() WHERE id = $1',
          [req.session.user.id]
        )
      }
    }
  } catch (_) { /* no-op */ }
  next()
})

// ---------- Auth ----------
app.post('/auth', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'missing_fields' })
    }

    // TODO: passare ad hash (bcrypt/pgcrypto). Ora password in chiaro come da tua tabella.
    const sql = `
      SELECT id, email
      FROM auth.users
      WHERE lower(email) = lower($1)
        AND password = $2
      LIMIT 1
    `
    const { rows } = await pool.query(sql, [email, password])

    if (rows.length !== 1) {
      return res.status(401).json({ ok: false, message: 'invalid_credentials' })
    }

    req.session.loggedIn = true
    req.session.user = { id: rows[0].id, email: rows[0].email }

    await pool.query('UPDATE auth.users SET last_seen = now() WHERE id = $1', [rows[0].id])

    res.json({ ok: true, user: req.session.user })
  } catch (err) {
    console.error('[/auth] error:', err)
    res.status(500).json({ ok: false, message: 'server_error' })
  }
})

app.get('/me', (req, res) => {
  if (!req.session?.loggedIn || !req.session?.user)
    return res.status(401).json({ ok: false })
  res.json({ ok: true, user: req.session.user })
})



app.post('/auth/logout', (req, res) => {
  req.session?.destroy(err => {
    // cancella il cookie della sessione (nome default di express-session)
    res.clearCookie('connect.sid', { path: '/' });
    if (err) return res.status(500).json({ ok: false, message: 'logout_error' });
    res.json({ ok: true });
  });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  const user = await findUserByEmail(email)         // tua query
  const ok = user && await checkPassword(user, password)
  if (!ok) return res.status(401).json({ ok: false })

  req.session.loggedIn = true
  req.session.user = { id: user.id, email: user.email } // <-- serve per self-delete
  res.json({ ok: true, user: req.session.user })
})

// auth guard minimale
function requireLogin (req, res, next) {
  if (req.session?.loggedIn) return next()
  return res.status(401).json({ ok: false, message: 'not_logged_in' })
}

// DELETE utente per id – chiunque loggato, no self-delete
app.delete('/admin/api/users/:id', requireLogin, async (req, res) => {
  const targetId = String(req.params.id)
  const myId = String(req.session?.user?.id || '')

  if (targetId === myId) {
    return res.status(403).json({ ok: false, message: 'cannot_delete_self' })
  }

  try {
    const q = 'DELETE FROM auth.users WHERE id = $1 RETURNING id'
    const { rows } = await pool.query(q, [targetId])
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'user_not_found' })
    }
    return res.json({ ok: true, deletedId: rows[0].id })
  } catch (err) {
    console.error('DELETE /admin/api/users/:id error:', err)
    return res.status(500).json({ ok: false, message: 'delete_failed' })
  }
})

// DELETE by email (fallback)
app.delete('/admin/api/users/by-email/:email', requireLogin, async (req, res) => {
  const targetEmail = String(req.params.email).toLowerCase()
  const myEmail = String(req.session.user?.email || '').toLowerCase()
  if (targetEmail === myEmail) {
    return res.status(403).json({ ok: false, message: 'cannot_delete_self' })
  }

  try {
    const q = 'DELETE FROM auth.users WHERE lower(email) = $1 RETURNING id'
    const { rows } = await pool.query(q, [targetEmail])
    if (rows.length === 0) return res.status(404).json({ ok: false, message: 'user_not_found' })
    res.json({ ok: true, deletedId: rows[0].id })
  } catch (err) {
    console.error('DELETE by-email error:', err)
    res.status(500).json({ ok: false, message: 'delete_failed' })
  }
})


// ---------- Health-check ----------
app.get('/', (_req, res) => res.send('API up'))

// ---------- Guard ----------
function requireLogin (req, res, next) {
  if (req.session?.loggedIn) return next()
  res.status(401).json({ ok: false, message: 'not_logged_in' })
}

// ---------- Router admin protetto ----------
const adminApi = express.Router()

// Stats reali
adminApi.get('/stats', async (_req, res) => {
  try {
    const qTotal  = `SELECT COUNT(*)::int AS total FROM auth.users`
    const qOnline = `
      SELECT COUNT(*)::int AS online
      FROM auth.users
      WHERE now() - last_seen <= interval '2 minutes'
    `
    const [{ rows: t1 }, { rows: t2 }] = await Promise.all([
      pool.query(qTotal),
      pool.query(qOnline)
    ])

    res.json({
      ok: true,
      stats: {
        usersTotal: t1[0].total,
        usersOnline: t2[0].online,
        systemName: 'Flows system',
        uptime: process.uptime()
      }
    })
  } catch (e) {
    console.error('[/admin/api/stats] error:', e)
    res.status(500).json({ ok: false, message: 'server_error' })
  }
})

adminApi.get('/users/me', (req, res) => {
  res.json({ ok: true, user: req.session.user })
})

// Lista utenti + flag online
adminApi.get('/users', async (_req, res) => {
  try {
    const sql = `
      SELECT
        id,
        email,
        last_seen,
        (now() - last_seen <= interval '2 minutes') AS online
      FROM auth.users
      ORDER BY online DESC, email ASC
    `
    const { rows } = await pool.query(sql)
    res.json({ ok: true, items: rows })
  } catch (e) {
    console.error('[/admin/api/users] error:', e)
    res.status(500).json({ ok: false, message: 'server_error' })
  }
})

// Generazione password random (12–16 char, senza caratteri ambigui)
function genPassword (len = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

// Approva: crea utente + invia credenziali
adminApi.post('/approvals/approve', async (req, res) => {
  try {
    const { name, email } = req.body || {}
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRe.test(email)) {
      return res.status(400).json({ ok: false, message: 'invalid_email' })
    }

    const plainPwd = genPassword()

    const sql = `
      INSERT INTO auth.users (email, password)
      VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email
    `
    const { rows } = await pool.query(sql, [email.toLowerCase(), plainPwd])
    if (rows.length === 0) {
      return res.status(409).json({ ok: false, message: 'user_exists' })
    }

    const subject = 'Il tuo accesso a Flows Backoffice'
    const loginUrl = 'http://localhost:5173/login' // cambia in prod
    const safeName = name ? `<b>${name}</b>` : 'nuovo utente'
    const html = `
      <p>Ciao ${safeName},</p>
      <p>il tuo account è stato approvato.</p>
      <p><b>Credenziali</b><br/>
      Email: <code>${email}</code><br/>
      Password: <code>${plainPwd}</code></p>
      <p>Accedi qui: <a href="${loginUrl}">${loginUrl}</a></p>
      <p>Per sicurezza, modifica la password dopo il primo accesso.</p>
    `
    const text =
`Ciao ${name || 'utente'},
il tuo account è stato approvato.

Credenziali:
Email: ${email}
Password: ${plainPwd}

Accedi: ${loginUrl}
(Consiglio: modifica la password dopo il primo accesso)`

    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@localhost',
      to: email,
      subject,
      text,
      html
    })

    res.json({ ok: true, user: rows[0] })
  } catch (err) {
    console.error('[/admin/api/approvals/approve] error:', err)
    res.status(500).json({ ok: false, message: 'server_error' })
  }
})

// --- Diagnostica (DEV): info DB + conteggi ---
adminApi.get('/debug/db', async (_req, res) => {
  try {
    const info = await pool.query(`
      SELECT current_database() AS db, current_schema() AS schema
    `)
    const cnt  = await pool.query(`SELECT COUNT(*)::int AS users FROM auth.users`)
    res.json({ ok: true, info: info.rows[0], users: cnt.rows[0].users })
  } catch (e) {
    res.status(500).json({ ok:false, message:'debug_failed' })
  }
})

// Monta il router protetto (una sola volta)
app.use('/admin/api', requireLogin, adminApi)

// ---------- SMTP / Mail ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true solo se porta 465
  auth: (process.env.SMTP_USER && process.env.SMTP_PASS)
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
})

// Verifica facoltativa all’avvio (utile in dev)
transporter.verify()
  .then(() => console.log('[mail] SMTP ok'))
  .catch(err => console.warn('[mail] SMTP verify failed:', err?.message))

function isEmail (s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '')
}

/**
 * POST /api/mail/send
 * Body: { email, name? }
 * Invia un’email al destinatario; in dev puoi forzare con MAIL_TO_OVERRIDE
 */
app.post('/api/mail/send', async (req, res) => {
  try {
    const { email, name } = req.body || {}
    if (!email || !isEmail(email)) {
      return res.status(400).json({ message: 'Email non valida' })
    }

    const to = (process.env.MAIL_TO_OVERRIDE && process.env.MAIL_TO_OVERRIDE.trim())
      ? process.env.MAIL_TO_OVERRIDE.trim()
      : email

    const subject = 'Benvenuto su Flows'
    const html = `
      <p>Ciao ${name ? `<b>${name}</b>` : ''} 👋</p>
      <p>Abbiamo ricevuto la tua richiesta con indirizzo <b>${email}</b>.</p>
      <p>Ti ricontatteremo appena l'admin approverà l’accesso.</p>
    `
    const text = `Ciao ${name || ''}\nAbbiamo ricevuto la tua richiesta con indirizzo ${email}.`

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@localhost',
      to,
      subject,
      text,
      html
    })

    console.log('[mail] sent', info.messageId)
    res.json({ message: 'Email inviata con successo' })
  } catch (err) {
    console.error('[/api/mail/send] error:', err)
    res.status(500).json({ message: 'Errore durante l’invio' })
  }
})

// ---------- Avvio ----------
const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`API http://localhost:${PORT}`)

  // LOG diagnostico all'avvio (aiuta a capire DB/host/schema e count utenti)
  try {
    const info = await pool.query(`SELECT current_database() AS db, inet_server_addr()::text AS host`)
    const cnt  = await pool.query(`SELECT COUNT(*)::int AS users FROM auth.users`)
    console.log(`[db] connected to ${info.rows[0].db} @ ${info.rows[0].host}  users=${cnt.rows[0].users}`)
  } catch (e) {
    console.warn('[db] startup check failed:', e.message)
  }
})
