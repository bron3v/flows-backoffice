const path = require('path');
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
// const cors = require('cors'); // scommenta solo se NON usi il proxy di Vite

const app = express();

const pool = new Pool({
  host: '172.19.16.1',        // ok se il server Postgres è qui; altrimenti 'localhost'
  user: 'postgres',
  password: 'FPW',
  database: 'flows-backoffice',
  port: 5432
});

// imposta il search_path così lo schema "auth" è visto di default
pool.on('connect', (client) => {
  client.query('SET search_path TO auth, public');
});

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessione (dev)
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' }
}));

// SOLO se NON usi il proxy di Vite (e fai fetch verso :3000):
// app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

// --- ENDPOINTS ---
// /auth
app.post('/auth', async (req, res) => {
  try {
    console.log('[/auth] body:', req.body);
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'missing_fields' });
    }

    // usa lo schema corretto; con il search_path puoi anche lasciare "users"
    const sql = 'SELECT id, email FROM users WHERE email = $1 AND password = $2 LIMIT 1';
    const { rows } = await pool.query(sql, [email, password]);

    console.log('[/auth] rows:', rows.length);
    if (rows.length !== 1) {
      return res.status(401).json({ ok: false, message: 'invalid_credentials' });
    }

    req.session.loggedIn = true;
    req.session.user = { id: rows[0].id, email: rows[0].email };
    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error('[/auth] error:', err);
    return res.status(500).json({ ok: false, message: 'server_error' });
  }
});

// /me
app.get('/me', (req, res) => {
  if (req.session?.loggedIn) return res.json({ ok: true, user: req.session.user });
  return res.status(401).json({ ok: false, message: 'not_logged_in' });
});

// test
app.get('/', (_req, res) => {
  res.send('API up');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API http://localhost:${PORT}`));
