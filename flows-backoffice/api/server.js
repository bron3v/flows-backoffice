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
  host: '172.19.16.1',
  user: 'postgres',
  password: 'FPW',
  database: 'flows-backoffice',
  port: 5432
})

// search_path di default: schema "auth" poi "public"
pool.on('connect', (client) => {
  client.query('SET search_path TO auth, public')
})

// ---------- Parsers ----------
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ---------- Sessioni ----------
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' }
}))

// ---------- Auth ----------
app.post('/auth', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'missing_fields' })
    }

    // TODO: usare password hash (bcrypt)
    const sql = 'SELECT id, email FROM users WHERE email = $1 AND password = $2 LIMIT 1'
    const { rows } = await pool.query(sql, [email, password])

    if (rows.length !== 1) {
      return res.status(401).json({ ok: false, message: 'invalid_credentials' })
    }

    req.session.loggedIn = true
    req.session.user = { id: rows[0].id, email: rows[0].email }
    return res.json({ ok: true, user: req.session.user })
  } catch (err) {
    console.error('[/auth] error:', err)
    return res.status(500).json({ ok: false, message: 'server_error' })
  }
})

app.get('/me', (req, res) => {
  if (req.session?.loggedIn) return res.json({ ok: true, user: req.session.user })
  return res.status(401).json({ ok: false, message: 'not_logged_in' })
})

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
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

adminApi.get('/stats', (req, res) => {
  res.json({ ok: true, user: req.session.user, stats: { uptime: process.uptime() } })
})

adminApi.get('/users/me', (req, res) => {
  res.json({ ok: true, user: req.session.user })
})

// Monta UNA sola volta
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

// ---------- Start ----------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`API http://localhost:${PORT}`))
