// api/server.js
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const express = require('express')
const session = require('express-session')
const { Pool } = require('pg')
const pgSession = require('connect-pg-simple')(session)
const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')

const app = express()

// ---------- Postgres ----------
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false, // metti true solo se usi SSL
      max: 10,
      idleTimeoutMillis: 30000
    })
  : new Pool({
      host: process.env.PGHOST || '172.19.16.1',   // allineato
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',    // allineato
      password: process.env.PGPASSWORD || 'postgres', // allineato
      database: process.env.PGDATABASE || 'FLOWS',    // allineato
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    })

pool.on('connect', (client) => {
  client.query('SET search_path TO public')
})

module.exports = { pool }

// helper DB
async function findUserByUsername (username) {
  const sql = `
    SELECT id, username, password_hash
    FROM public.users
    WHERE lower(username) = lower($1)
    LIMIT 1
  `
  const { rows } = await pool.query(sql, [username])
  return rows[0] || null
}

async function createUser (username, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10) // cost adeguato (dump ha cost 6)
  const sql = `
    INSERT INTO public.users (username, password_hash)
    VALUES ($1, $2)
    ON CONFLICT (username) DO NOTHING
    RETURNING id, username
  `
  const { rows } = await pool.query(sql, [username, hash])
  return rows[0] || null
}

async function deleteUserById (id) {
  const sql = `DELETE FROM public.users WHERE id = $1 RETURNING id`
  const { rows } = await pool.query(sql, [id])
  return rows[0] || null
}

function checkPassword (user, plain) {
  return bcrypt.compare(plain, user.password_hash)
}

// ---------- Parsers ----------
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ---------- Sessioni (condivise su Postgres) ----------
app.use(session({
  store: new pgSession({
    pool,
    schemaName: 'public',
    tableName: 'session',
    createTableIfMissing: true,           // <<< AGGIUNGI QUESTO IN DEV
  }),
  secret: process.env.SESSION_SECRET || 'change-me-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,                        // <<< in dev forzalo a false
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
}))


// LOG semplice di tutte le richieste (prima delle route)
app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.url}`)
  next()
})

// ---------- Auth ----------
app.post('/auth/login', async (req, res) => {
  try {
    console.log('[auth/login] hit', req.body)
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'missing_fields' })
    }

    const user = await findUserByUsername(username)
    const ok = user && await checkPassword(user, password)
    if (!ok) return res.status(401).json({ ok: false, message: 'invalid_credentials' })

    req.session.loggedIn = true
    req.session.user = { id: user.id, username: user.username }
    req.session.userId = user.id  
    return res.json({ ok: true, user: req.session.user })
  } catch (err) {
    console.error('[/auth/login] error:', err)
    return res.status(500).json({ ok: false, message: 'server_error' })
  }
})

app.post('/auth/logout', (req, res) => {
  req.session?.destroy(err => {
    res.clearCookie('connect.sid', { path: '/' })
    if (err) return res.status(500).json({ ok: false, message: 'logout_error' })
    res.json({ ok: true })
  })
})

app.get('/auth/ping', (req, res) => {
  req.session.ping = (req.session.ping || 0) + 1
  res.json({
    ok: true,
    sid: req.sessionID,
    hasUser: !!req.session.user,
    ping: req.session.ping,
  })
})


app.get('/me', (req, res) => {
  if (!req.session?.loggedIn || !req.session?.user) {
    return res.status(401).json({ ok: false })
  }
  res.json({ ok: true, user: req.session.user })
})

// ---------- Guard ----------
function requireLogin (req, res, next) {
  if (req.session?.loggedIn) return next()
  return res.status(401).json({ ok: false, message: 'not_logged_in' })
}

// ---------- Router admin protetto ----------
const adminApi = express.Router()

// Stats da DB condiviso: numero utenti + online via sessioni attive
adminApi.get('/stats', async (_req, res) => {
  try {
    const qTotal = `SELECT COUNT(*)::int AS total FROM public.users`
    const qOnline = `
      SELECT COUNT(DISTINCT (sess->>'userId'))::int AS online
      FROM public.session
      WHERE expire > now() AND (sess->>'userId') IS NOT NULL
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

// Lista utenti + flag online basato su sessioni
adminApi.get('/users', async (_req, res) => {
  try {
    const sql = `
      SELECT
        u.id,
        u.username,
        EXISTS (
          SELECT 1
          FROM public.session s
          WHERE s.expire > now()
            AND (s.sess->>'userId')::int = u.id
        ) AS online
      FROM public.users u
      ORDER BY online DESC, username ASC
    `
    const { rows } = await pool.query(sql)
    res.json({ ok: true, items: rows })
  } catch (e) {
    console.error('[/admin/api/users] error:', e)
    res.status(500).json({ ok: false, message: 'server_error' })
  }
})

// DELETE utente per id – no self-delete
adminApi.delete('/users/:id', requireLogin, async (req, res) => {
  const targetId = String(req.params.id)
  const myId = String(req.session?.user?.id || '')
  if (targetId === myId) {
    return res.status(403).json({ ok: false, message: 'cannot_delete_self' })
  }

  try {
    const deleted = await deleteUserById(targetId)
    if (!deleted) return res.status(404).json({ ok: false, message: 'user_not_found' })
    res.json({ ok: true, deletedId: deleted.id })
  } catch (err) {
    console.error('DELETE /admin/api/users/:id error:', err)
    res.status(500).json({ ok: false, message: 'delete_failed' })
  }
})

// Approva: crea utente (username = email o name sanificato) + invia credenziali
function genPassword (len = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

adminApi.post('/approvals/approve', async (req, res) => {
  try {
    const { name, email, username } = req.body || {}
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!username && !email) {
      return res.status(400).json({ ok: false, message: 'missing_username_or_email' })
    }
    if (email && !emailRe.test(email)) {
      return res.status(400).json({ ok: false, message: 'invalid_email' })
    }

    // decidi username: priorità al campo username, altrimenti usa email come username
    const finalUsername = (username || email).toLowerCase()
    const plainPwd = genPassword()
    const user = await createUser(finalUsername, plainPwd)
    if (!user) {
      return res.status(409).json({ ok: false, message: 'user_exists' })
    }

    // invio mail se presente email
    if (email) {
      const subject = 'Il tuo accesso a Flows Backoffice'
      const loginUrl = process.env.LOGIN_URL || 'http://localhost:5173/login'
      const safeName = name ? `<b>${name}</b>` : 'nuovo utente'
      const html = `
        <p>Ciao ${safeName},</p>
        <p>il tuo account è stato approvato.</p>
        <p><b>Credenziali</b><br/>
        Username: <code>${finalUsername}</code><br/>
        Password: <code>${plainPwd}</code></p>
        <p>Accedi qui: <a href="${loginUrl}">${loginUrl}</a></p>
        <p>Per sicurezza, modifica la password dopo il primo accesso.</p>
      `
      const text =
`Ciao ${name || 'utente'},
il tuo account è stato approvato.

Credenziali:
Username: ${finalUsername}
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
    }

    res.json({ ok: true, user })
  } catch (err) {
    console.error('[/admin/api/approvals/approve] error:', err)
    res.status(500).json({ ok: false, message: 'server_error' })
  }
})

// --- Diagnostica (DEV)
adminApi.get('/debug/db', async (_req, res) => {
  try {
    const info = await pool.query(`SELECT current_database() AS db, current_schema() AS schema`)
    const cnt = await pool.query(`SELECT COUNT(*)::int AS users FROM public.users`)
    res.json({ ok: true, info: info.rows[0], users: cnt.rows[0].users })
  } catch (e) {
    res.status(500).json({ ok:false, message:'debug_failed' })
  }
})

// monta il router protetto
app.use('/admin/api', requireLogin, adminApi)

// ---------- SMTP / Mail ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: (process.env.SMTP_USER && process.env.SMTP_PASS)
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
})

transporter.verify()
  .then(() => console.log('[mail] SMTP ok'))
  .catch(err => console.warn('[mail] SMTP verify failed:', err?.message))

// ---------- Health-check ----------
app.get('/', (_req, res) => res.send('API up'))

// ---------- Avvio ----------
const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`API http://localhost:${PORT}`)
  try {
    const info = await pool.query(`SELECT current_database() AS db, inet_server_addr()::text AS host`)
    const cnt  = await pool.query(`SELECT COUNT(*)::int AS users FROM public.users`)
    console.log(`[db] connected to ${info.rows[0].db} @ ${info.rows[0].host} users=${cnt.rows[0].users}`)
  } catch (e) {
    console.warn('[db] startup check failed:', e.message)
  }
})



