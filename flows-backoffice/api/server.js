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
      ssl: false, 
      max: 10,
      idleTimeoutMillis: 30000
    })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'FLOWS',
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    })

pool.on('connect', (client) => {
  client.query('SET search_path TO public')
})
;(async () => {
  try {
    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS last_seen_ts BIGINT
    `)
    console.log('[db] users.last_seen_ts ok')
  } catch (e) {
    console.warn('[db] cannot ensure users.last_seen_ts:', e.message)
  }
})()


// (facoltativo) export per altri moduli
module.exports = { pool }

// ---------- Helper DB ----------
async function findUserByUsername (username) {
  const sql = `
    SELECT id, username, password_hash, role, first_login
    FROM public.users
    WHERE lower(username) = lower($1)
    LIMIT 1
  `
  const { rows } = await pool.query(sql, [username])
  return rows[0] || null
}

async function createUser (username, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10)
  const sql = `
    INSERT INTO public.users (username, password_hash, first_login)
    VALUES ($1, $2, false)
    ON CONFLICT (username) DO NOTHING
    RETURNING id, username, role, first_login
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

// ---------- Sessioni  ----------
app.use(session({
  store: new pgSession({
    pool,
    schemaName: 'public',
    tableName: 'session',
    createTableIfMissing: true, 
  }),
  secret: process.env.SESSION_SECRET || 'change-me-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // in dev
    maxAge: 14 * 24 * 60 * 60 * 1000, 
  }
}))

// ---------- Heartbeat lastSeen  ----------
app.use((req, res, next) => {
  if (!req.session) return next()
  const now  = Date.now()
  const last = Number(req.session.lastSeenTs || 0)

  if (now - last >= 15_000) {
    req.session.lastSeenTs = now
    // salva la sessione
    req.session.save(() => {})

    const uid = req.session.userId
    if (uid) {
      pool.query(
        `UPDATE public.users
           SET last_seen_ts = GREATEST(COALESCE(last_seen_ts,0), $1)
         WHERE id = $2`,
        [now, uid]
      ).catch(() => {})
    }
  }
  next()
})

app.post('/me/ping', requireLogin, (req, res) => {
  res.json({ ok: true, at: Date.now() })
})


app.post('/auth/change-password', requireLogin, async (req, res) => {
  try {
    const uid = req.session?.userId
    if (!uid) return res.status(401).json({ ok: false, message: 'not_logged_in' })
    const { password, current_password, new_password } = req.body || {}
    const newPwd = (typeof new_password === 'string' && new_password.trim())
      ? new_password.trim()
      : (typeof password === 'string' && password.trim())
        ? password.trim()
        : ''

    if (!newPwd) {
      return res.status(400).json({ ok: false, message: 'missing_new_password' })
    }

    // Se è stata fornita la password corrente, validala
    if (typeof current_password === 'string' && current_password.length > 0) {
      const q = await pool.query(
        'SELECT password_hash FROM public.users WHERE id = $1',
        [uid]
      )
      const row = q.rows[0]
      if (!row) return res.status(401).json({ ok: false, message: 'user_not_found' })
      const ok = await bcrypt.compare(current_password, row.password_hash)
      if (!ok) return res.status(200).json({ ok: false, message: 'invalid_current_password' })
    }

    // Aggiornamento hash + imposta first_login = true
    const hash = await bcrypt.hash(newPwd, 10)
    await pool.query(
      'UPDATE public.users SET password_hash = $1, first_login = true WHERE id = $2',
      [hash, uid]
    )

    return res.json({ ok: true })
  } catch (e) {
    console.error('[/auth/change-password] error:', e)
    return res.status(500).json({ ok: false, message: 'server_error' })
  }
})



// ---------- Log richieste (dev) ----------
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.url}`)
  next()
})


// ---------- Auth ----------
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'missing_fields' })
    }

    const user = await findUserByUsername(username)
    const validPassword = user && await checkPassword(user, password)

    if (!validPassword) {
      return res.status(200).json({ ok: false, message: 'invalid_credentials' })
    }

    const now = Date.now()

    req.session.loggedIn = true
    req.session.userId = user.id
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    }
    req.session.lastSeenTs = now

    await pool.query(
      `UPDATE public.users
         SET last_seen_ts = GREATEST(COALESCE(last_seen_ts, 0), $1)
       WHERE id = $2`,
      [now, user.id]
    ).catch(() => {})

    req.session.save((err) => {
      if (err) {
        console.error('[/auth/login] session save error:', err)
        return res.status(500).json({ ok: false, message: 'session_save_error' })
      }

      return res.json({
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          first_login: user.first_login === true
        }
      })
    })

  } catch (err) {
    console.error('[/auth/login] error:', err)
    return res.status(500).json({ ok: false, message: 'server_error' })
  }
})



// ---------- Auth: logout ----------
app.post('/auth/logout', requireLogin, async (req, res) => {
  try {
    const uid = req.session?.userId || null;
    const now = Date.now();

    // Mantenimento dell'ultimo accesso anche se la sessione sta per scadere
    if (uid) {
      await pool.query(
        `UPDATE public.users
           SET last_seen_ts = GREATEST(COALESCE(last_seen_ts,0), $1)
         WHERE id = $2`,
        [now, uid]
      ).catch(() => {}); 
    }

    // Distruzione della sessione e pulizia coockie
    req.session.destroy(err => {
      res.clearCookie('connect.sid', { path: '/' });
      if (err) {
        console.error('[/auth/logout] destroy error:', err);
        return res.status(500).json({ ok: false, message: 'logout_error' });
      }
      return res.json({ ok: true });
    });
  } catch (e) {
    console.error('[/auth/logout] error:', e);
    return res.status(500).json({ ok: false, message: 'server_error' });
  }
});


app.get('/auth/ping', (req, res) => {
  req.session.ping = (req.session.ping || 0) + 1
  res.json({
    ok: true,
    sid: req.sessionID,
    hasUser: !!req.session.user,
    ping: req.session.ping,
  })
})

app.get('/me', async (req, res) => {
  if (!req.session?.loggedIn || !req.session?.userId) {
    return res.status(401).json({ ok: false })
  }
  const { rows } = await pool.query(
    'SELECT id, username, role, first_login FROM public.users WHERE id = $1',
    [req.session.userId]
  )
  const u = rows[0]
  if (!u) return res.status(401).json({ ok: false })
  // sincronizza anche la sessione se mancava il role
  req.session.user = { id: u.id, username: u.username, role: u.role }
  return res.json({
    ok: true,
    user: {
      id: u.id,
      username: u.username,
      role: u.role,
      first_login: u.first_login === true
    }
  })
})


// ---------- Guard ----------
function requireLogin (req, res, next) {
  if (req.session?.loggedIn) return next()
  return res.status(401).json({ ok: false, message: 'not_logged_in' })
}



// ---------- Router admin protetto ----------
const adminApi = express.Router()


adminApi.get('/stats', async (_req, res) => {
  try {
    const qTotal = `SELECT COUNT(*)::int AS total FROM public.users`
    const qOnline = `
      SELECT COUNT(DISTINCT (sess->>'userId'))::int AS online
      FROM public.session
      WHERE expire > NOW()
        AND (sess->>'userId') IS NOT NULL
        AND to_timestamp(COALESCE((sess->>'lastSeenTs')::bigint,0)/1000.0)
            > NOW() - INTERVAL '10 minutes'
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

adminApi.get('/users', async (_req, res) => {
  try {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.role,
        COALESCE(u.last_seen_ts, 0) AS last_seen_ts,
        EXISTS (
          SELECT 1
          FROM public.session s
          WHERE s.expire > NOW()
            AND (s.sess->>'userId')::int = u.id
            AND to_timestamp(
                  GREATEST(0, COALESCE((s.sess->>'lastSeenTs')::bigint, 0)) / 1000.0
                ) > NOW() - INTERVAL '30 seconds'
        ) AS online
      FROM public.users u
      ORDER BY online DESC, username ASC;
    `;
    const { rows } = await pool.query(sql);
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error('[/admin/api/users] error:', e);
    res.status(500).json({ ok: false, message: 'server_error' });
  }
});



// DELETE utente per id 
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

function genPassword (len = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}


adminApi.post('/approvals/approve', async (req, res) => {
  try {
    const { name, email, username, requested_role } = req.body || {}

    // ---- validazioni base ----
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!username && !email) {
      return res.status(400).json({ ok: false, message: 'missing_username_or_email' })
    }
    if (email && !emailRe.test(email)) {
      return res.status(400).json({ ok: false, message: 'invalid_email' })
    }

   
    const ALLOWED = new Set(['user','user_manager','logs_manager','admin'])
    const finalRole = (requested_role || '').toString().toLowerCase()
    const roleToAssign = ALLOWED.has(finalRole) ? finalRole : 'user'

    // Creazione utente 
    const finalUsername = (username || email).toLowerCase()
    const plainPwd = genPassword()

    const user = await createUser(finalUsername, plainPwd)
    if (!user) {
      return res.status(409).json({ ok: false, message: 'user_exists' })
    }

    // Se il ruolo richiesto è diverso dal default, aggiorna
    if (roleToAssign !== 'user') {
      await pool.query(
        'UPDATE public.users SET role = $1 WHERE id = $2',
        [roleToAssign, user.id]
      )
    }

    // Ricarica i dati completi 
    const { rows } = await pool.query(
      'SELECT id, username, role FROM public.users WHERE id = $1',
      [user.id]
    )
    const outUser = rows[0]

    //Email con credenziali 
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

    // risposta 
    return res.json({ ok: true, user: outUser }) 
  } catch (err) {
    console.error('[/admin/api/approvals/approve] error:', err)
    return res.status(500).json({ ok: false, message: 'server_error' })
  }
})


// Monta router admin protetto
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

// ---------- Cleanup sessioni scadute ----------
async function cleanupExpiredSessions() {
  try {
    await pool.query(`DELETE FROM public.session WHERE expire <= NOW()`)
  } catch (e) {
    console.warn('[session cleanup] failed:', e?.message)
  }
}
cleanupExpiredSessions()
setInterval(cleanupExpiredSessions, 60 * 60 * 1000) 

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
