const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const express = require('express')
const session = require('express-session')
const { Pool } = require('pg')
const pgSession = require('connect-pg-simple')(session)
const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')

const app = express()

// ---------- Parsers ----------
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ---------- Postgres ----------
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'FLOWS',
  ssl: process.env.PGSSL === 'true'
})

pool.on('connect', async (client) => {
  try {
    await client.query('SET search_path TO public')
  } catch (err) {
    console.warn('[db] SET search_path failed:', err.message)
  }
})

// ---------- Assicura colonne necessarie ----------
;(async () => {
  try {
    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS last_seen_ts BIGINT
    `)

    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT false
    `)

    await pool.query(`
      UPDATE public.users
      SET first_login = false
      WHERE first_login IS NULL
    `)

    console.log('[db] users columns ok')
  } catch (e) {
    console.warn('[db] cannot ensure users columns:', e.message)
  }
})()

// ---------- Sessioni ----------
app.use(session({
  store: new pgSession({
    pool,
    schemaName: 'public',
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'change-me-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
}))

// ---------- SMTP / Mail ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    : undefined,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000
})

transporter.verify()
  .then(() => console.log('[mail] SMTP ok'))
  .catch(err => console.warn('[mail] SMTP verify failed:', err?.message))

// ---------- Helper ----------
function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next()

  return res.status(401).json({
    ok: false,
    message: 'not_logged_in'
  })
}

function genPassword(len = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  let out = ''

  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }

  return out
}

function cleanHtmlValue(value) {
  return String(value || '').replace(/[<>]/g, '')
}

async function findUserByUsername(username) {
  const sql = `
    SELECT id, username, password_hash, role, first_login
    FROM public.users
    WHERE lower(username) = lower($1)
    LIMIT 1
  `

  const { rows } = await pool.query(sql, [username])
  return rows[0] || null
}

async function checkPassword(user, plain) {
  return bcrypt.compare(plain, user.password_hash)
}

async function deleteUserById(id) {
  const sql = `
    DELETE FROM public.users
    WHERE id = $1
    RETURNING id
  `

  const { rows } = await pool.query(sql, [id])
  return rows[0] || null
}

// ---------- Heartbeat lastSeen ----------
app.use((req, res, next) => {
  if (!req.session) return next()

  const now = Date.now()
  const last = Number(req.session.lastSeenTs || 0)

  if (now - last >= 15_000) {
    req.session.lastSeenTs = now
    req.session.save(() => {})

    const uid = req.session.userId

    if (uid) {
      pool.query(
        `
        UPDATE public.users
        SET last_seen_ts = GREATEST(COALESCE(last_seen_ts, 0), $1)
        WHERE id = $2
        `,
        [now, uid]
      ).catch(() => {})
    }
  }

  next()
})

// ---------- Log richieste ----------
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.url}`)
  next()
})

// ---------- Auth ----------
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: 'missing_fields'
      })
    }

    const user = await findUserByUsername(username)
    const validPassword = user && await checkPassword(user, password)

    if (!validPassword) {
      return res.status(200).json({
        ok: false,
        message: 'invalid_credentials'
      })
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
      `
      UPDATE public.users
      SET last_seen_ts = GREATEST(COALESCE(last_seen_ts, 0), $1)
      WHERE id = $2
      `,
      [now, user.id]
    ).catch(() => {})

    req.session.save((err) => {
      if (err) {
        console.error('[/auth/login] session save error:', err)

        return res.status(500).json({
          ok: false,
          message: 'session_save_error'
        })
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

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

app.post('/auth/logout', requireLogin, async (req, res) => {
  try {
    const uid = req.session?.userId || null
    const now = Date.now()

    if (uid) {
      await pool.query(
        `
        UPDATE public.users
        SET last_seen_ts = GREATEST(COALESCE(last_seen_ts, 0), $1)
        WHERE id = $2
        `,
        [now, uid]
      ).catch(() => {})
    }

    req.session.destroy(err => {
      res.clearCookie('connect.sid', { path: '/' })

      if (err) {
        console.error('[/auth/logout] destroy error:', err)

        return res.status(500).json({
          ok: false,
          message: 'logout_error'
        })
      }

      return res.json({ ok: true })
    })
  } catch (e) {
    console.error('[/auth/logout] error:', e)

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

app.get('/auth/ping', (req, res) => {
  req.session.ping = (req.session.ping || 0) + 1

  res.json({
    ok: true,
    sid: req.sessionID,
    hasUser: !!req.session.user,
    ping: req.session.ping
  })
})

app.get('/me', async (req, res) => {
  try {
    if (!req.session?.loggedIn || !req.session?.userId) {
      return res.status(401).json({ ok: false })
    }

    const { rows } = await pool.query(
      `
      SELECT id, username, role, first_login
      FROM public.users
      WHERE id = $1
      `,
      [req.session.userId]
    )

    const user = rows[0]

    if (!user) {
      return res.status(401).json({ ok: false })
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
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
  } catch (err) {
    console.error('[/me] error:', err)

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

app.post('/me/ping', requireLogin, async (req, res) => {
  const now = Date.now()
  req.session.lastSeenTs = now

  if (req.session.userId) {
    await pool.query(
      `
      UPDATE public.users
      SET last_seen_ts = GREATEST(COALESCE(last_seen_ts, 0), $1)
      WHERE id = $2
      `,
      [now, req.session.userId]
    ).catch(() => {})
  }

  res.json({
    ok: true,
    at: now
  })
})

// ---------- Cambio password ----------
app.post('/auth/change-password', requireLogin, async (req, res) => {
  try {
    const uid = req.session?.userId

    if (!uid) {
      return res.status(401).json({
        ok: false,
        message: 'not_logged_in'
      })
    }

    const { password, current_password, new_password } = req.body || {}

    const newPwd = typeof new_password === 'string' && new_password.trim()
      ? new_password.trim()
      : typeof password === 'string' && password.trim()
        ? password.trim()
        : ''

    if (!newPwd) {
      return res.status(400).json({
        ok: false,
        message: 'missing_new_password'
      })
    }

    if (typeof current_password === 'string' && current_password.length > 0) {
      const q = await pool.query(
        `
        SELECT password_hash
        FROM public.users
        WHERE id = $1
        `,
        [uid]
      )

      const row = q.rows[0]

      if (!row) {
        return res.status(401).json({
          ok: false,
          message: 'user_not_found'
        })
      }

      const ok = await bcrypt.compare(current_password, row.password_hash)

      if (!ok) {
        return res.status(200).json({
          ok: false,
          message: 'invalid_current_password'
        })
      }
    }

    const hash = await bcrypt.hash(newPwd, 10)

    await pool.query(
      `
      UPDATE public.users
      SET password_hash = $1, first_login = true
      WHERE id = $2
      `,
      [hash, uid]
    )

    return res.json({ ok: true })
  } catch (e) {
    console.error('[/auth/change-password] error:', e)

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

// ---------- Router admin protetto ----------
const adminApi = express.Router()

adminApi.get('/stats', async (_req, res) => {
  try {
    const qTotal = `
      SELECT COUNT(*)::int AS total
      FROM public.users
    `

    const qOnline = `
      SELECT COUNT(DISTINCT (sess->>'userId'))::int AS online
      FROM public.session
      WHERE expire > NOW()
        AND (sess->>'userId') IS NOT NULL
        AND to_timestamp(COALESCE((sess->>'lastSeenTs')::bigint, 0) / 1000.0)
          > NOW() - INTERVAL '10 minutes'
    `

    const qPending = `
      SELECT COUNT(*)::int AS pending
      FROM public.registration_requests
      WHERE status = 'pending'
    `

    const [
      { rows: totalRows },
      { rows: onlineRows },
      { rows: pendingRows }
    ] = await Promise.all([
      pool.query(qTotal),
      pool.query(qOnline),
      pool.query(qPending)
    ])

    res.json({
      ok: true,
      stats: {
        usersTotal: totalRows[0].total,
        usersOnline: onlineRows[0].online,
        pendingRequests: pendingRows[0].pending,
        systemName: 'Flows system',
        uptime: process.uptime()
      }
    })
  } catch (e) {
    console.error('[/admin/api/stats] error:', e)

    res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

adminApi.get('/users/me', (req, res) => {
  res.json({
    ok: true,
    user: req.session.user
  })
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
      ORDER BY online DESC, username ASC
    `

    const { rows } = await pool.query(sql)

    res.json({
      ok: true,
      items: rows
    })
  } catch (e) {
    console.error('[/admin/api/users] error:', e)

    res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

adminApi.delete('/users/:id', requireLogin, async (req, res) => {
  const targetId = String(req.params.id)
  const myId = String(req.session?.user?.id || '')

  if (targetId === myId) {
    return res.status(403).json({
      ok: false,
      message: 'cannot_delete_self'
    })
  }

  try {
    const deleted = await deleteUserById(targetId)

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        message: 'user_not_found'
      })
    }

    res.json({
      ok: true,
      deletedId: deleted.id
    })
  } catch (err) {
    console.error('DELETE /admin/api/users/:id error:', err)

    res.status(500).json({
      ok: false,
      message: 'delete_failed'
    })
  }
})

// ---------- Lista richieste pendenti ----------
adminApi.get('/approvals', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        note,
        status,
        requester_ip,
        user_agent,
        created_at
      FROM public.registration_requests
      WHERE status = 'pending'
      ORDER BY created_at DESC
      `
    )

    return res.json({
      ok: true,
      items: rows
    })
  } catch (err) {
    console.error('[/admin/api/approvals] error:', err)

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

// ---------- Approva richiesta + crea utente + invia credenziali ----------
adminApi.post('/approvals/approve', async (req, res) => {
  const client = await pool.connect()

  try {
    const { id, name, email, username, requested_role, role } = req.body || {}

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    let request = null
    let finalEmail = email ? String(email).trim().toLowerCase() : ''
    let finalUsername = username ? String(username).trim().toLowerCase() : ''

    if (id) {
      const q = await client.query(
        `
        SELECT id, email, affiliation, note, status
        FROM public.registration_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      )

      request = q.rows[0]

      if (!request) {
        return res.status(404).json({
          ok: false,
          message: 'request_not_found'
        })
      }

      if (request.status !== 'pending') {
        return res.status(409).json({
          ok: false,
          message: 'request_not_pending'
        })
      }

      finalEmail = String(request.email || '').trim().toLowerCase()
      finalUsername = finalEmail
    }

    if (!finalUsername && finalEmail) {
      finalUsername = finalEmail
    }

    if (!finalUsername && !finalEmail) {
      return res.status(400).json({
        ok: false,
        message: 'missing_username_or_email'
      })
    }

    if (finalEmail && !emailRe.test(finalEmail)) {
      return res.status(400).json({
        ok: false,
        message: 'invalid_email'
      })
    }

    const ALLOWED_ROLES = new Set([
      'user',
      'user_manager',
      'logs_manager',
      'admin'
    ])

    const requestedRoleValue = requested_role || role || 'user'
    const finalRole = String(requestedRoleValue).toLowerCase()
    const roleToAssign = ALLOWED_ROLES.has(finalRole) ? finalRole : 'user'

    const plainPwd = genPassword()
    const hash = await bcrypt.hash(plainPwd, 10)

    await client.query('BEGIN')

    const existingUser = await client.query(
      `
      SELECT id
      FROM public.users
      WHERE lower(username) = lower($1)
      LIMIT 1
      `,
      [finalUsername]
    )

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        ok: false,
        message: 'user_exists'
      })
    }

    const createdUser = await client.query(
      `
      INSERT INTO public.users
        (username, password_hash, role, first_login)
      VALUES
        ($1, $2, $3, false)
      RETURNING id, username, role, first_login
      `,
      [finalUsername, hash, roleToAssign]
    )

    const outUser = createdUser.rows[0]

    if (id) {
      await client.query(
        `
        UPDATE public.registration_requests
        SET status = 'approved'
        WHERE id = $1
        `,
        [id]
      )
    }

    await client.query('COMMIT')

    if (finalEmail) {
      const subject = 'Your FLOWS account has been approved'
      const loginUrl = process.env.LOGIN_URL || 'http://localhost:5173/login'

      const displayName = name || finalUsername
      const safeName = cleanHtmlValue(displayName)
      const safeUsername = cleanHtmlValue(finalUsername)
      const safePassword = cleanHtmlValue(plainPwd)

      const html = `
        <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f7f8; padding: 32px;">
          <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
            
            <div style="background-color: #14b8a6; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; letter-spacing: 1px;">
                FLOWS
              </h1>
            </div>

            <div style="padding: 32px;">
              <h2 style="margin-top: 0; color: #111827; font-size: 22px;">
                Account approved
              </h2>

              <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                Hello <strong>${safeName}</strong>,
              </p>

              <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                Your request to access <strong>FLOWS</strong> has been approved.
                You can now log in using the credentials below.
              </p>

              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; color: #111827; font-size: 15px;">
                  <strong>Username</strong><br>
                  <code style="display: inline-block; margin-top: 6px; color: #0f766e; font-size: 15px;">
                    ${safeUsername}
                  </code>
                </p>

                <p style="margin: 0; color: #111827; font-size: 15px;">
                  <strong>Temporary password</strong><br>
                  <code style="display: inline-block; margin-top: 6px; color: #0f766e; font-size: 15px;">
                    ${safePassword}
                  </code>
                </p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                For security reasons, please change your password after your first login.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}"
                   style="background-color: #14b8a6; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: bold; display: inline-block;">
                  Log in to FLOWS
                </a>
              </div>

              <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                If the button does not work, copy and paste this link into your browser:
                <br>
                <a href="${loginUrl}" style="color: #0f766e;">
                  ${loginUrl}
                </a>
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">

              <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
                This is an automatic message from FLOWS. Please do not reply to this email.
              </p>
            </div>
          </div>
        </div>
      `

      const text = `Hello ${displayName},

Your request to access FLOWS has been approved.

You can now log in using the credentials below:

Username: ${finalUsername}
Temporary password: ${plainPwd}

Login URL: ${loginUrl}

For security reasons, please change your password after your first login.

This is an automatic message from FLOWS. Please do not reply to this email.`

      const mailInfo = await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost',
        to: process.env.MAIL_TO_OVERRIDE || finalEmail,
        subject,
        text,
        html
      })

      console.log('[mail] approval sent:', mailInfo.messageId, mailInfo.response)
    }

    return res.json({
      ok: true,
      user: outUser
    })
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    console.error('[/admin/api/approvals/approve] error:', err)

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  } finally {
    client.release()
  }
})

// ---------- Rifiuta richiesta pendente ----------
adminApi.post('/approvals/reject', async (req, res) => {
  try {
    const { id } = req.body || {}

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'missing_id'
      })
    }

    const { rows } = await pool.query(
      `
      UPDATE public.registration_requests
      SET status = 'rejected'
      WHERE id = $1
        AND status = 'pending'
      RETURNING id, email, note, status, created_at
      `,
      [id]
    )

    if (!rows[0]) {
      return res.status(404).json({
        ok: false,
        message: 'request_not_found_or_not_pending'
      })
    }

    return res.json({
      ok: true,
      request: rows[0]
    })
  } catch (err) {
    console.error('[/admin/api/approvals/reject] error:', err)

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

adminApi.delete('/approvals/:id', async (req, res) => {
  try {
    const id = req.params.id

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'missing_id'
      })
    }

    const { rows } = await pool.query(
      `
      DELETE FROM public.registration_requests
      WHERE id = $1
        AND status = 'pending'
      RETURNING id, email, note, status, created_at
      `,
      [id]
    )

    if (!rows[0]) {
      return res.status(404).json({
        ok: false,
        message: 'request_not_found_or_not_pending'
      })
    }

    return res.json({
      ok: true,
      deleted: rows[0]
    })
  } catch (err) {
    console.error('DELETE /admin/api/approvals/:id error:', err)

    return res.status(500).json({
      ok: false,
      message: 'server_error'
    })
  }
})

// ---------- Test invio email ----------
adminApi.post('/mail/test', async (req, res) => {
  try {
    const { to } = req.body || {}

    if (!to) {
      return res.status(400).json({
        ok: false,
        message: 'missing_to'
      })
    }

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost',
      to: process.env.MAIL_TO_OVERRIDE || to,
      subject: 'Test email Flows',
      text: 'Se ricevi questa email, la configurazione SMTP funziona.',
      html: '<p>Se ricevi questa email, la configurazione SMTP funziona.</p>'
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[/admin/api/mail/test] error:', err)

    return res.status(500).json({
      ok: false,
      message: 'mail_error',
      detail: err.message
    })
  }
})

// ---------- Monta router admin protetto ----------
app.use('/admin/api', requireLogin, adminApi)

// ---------- Health-check ----------
app.get('/', (_req, res) => {
  res.send('API up')
})

// ---------- Cleanup sessioni scadute ----------
async function cleanupExpiredSessions() {
  try {
    await pool.query(`
      DELETE FROM public.session
      WHERE expire <= NOW()
    `)
  } catch (e) {
    console.warn('[session cleanup] failed:', e?.message)
  }
}

cleanupExpiredSessions()
setInterval(cleanupExpiredSessions, 60 * 60 * 1000)

// ---------- Avvio ----------
const PORT = process.env.PORT || 3002

app.listen(PORT, async () => {
  console.log(`API http://localhost:${PORT}`)

  try {
    const info = await pool.query(`
      SELECT current_database() AS db, inet_server_addr()::text AS host
    `)

    const users = await pool.query(`
      SELECT COUNT(*)::int AS users
      FROM public.users
    `)

    const pending = await pool.query(`
      SELECT COUNT(*)::int AS pending
      FROM public.registration_requests
      WHERE status = 'pending'
    `)

    console.log(`[db] connected to ${info.rows[0].db} @ ${info.rows[0].host} users=${users.rows[0].users} pending=${pending.rows[0].pending}`)
  } catch (e) {
    console.warn('[db] startup check failed:', e.message)
  }
})