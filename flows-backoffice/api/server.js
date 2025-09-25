const path = require('path');
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  host: '172.19.16.1', // Host del server Postgres
  user: 'postgres',           
  password: 'FPW',            
  database: 'flows-backoffice', 
  port: 5432 // Porta standard Postgres
});

//Impostazione del search_path, schema "auth" è visto di default
pool.on('connect', (client) => {
  client.query('SET search_path TO auth, public');
});

// Body parsers
// Abilitazione lettura di body "application/x-www-form-urlencoded" e "application/json" dalle richieste HTTP.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessione (dev)
// Abilita sessioni lato server
// - secret: chiave per firmare il cookie di sessione
// - resave/saveUninitialized: evita scritture inutili.
// - cookie.secure: TODO: in produzione impostare a true per HTTPS
// - sameSite: 'lax' riduce rischi CSRF mantenendo compatibilità con navigazioni "normali".
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' }
}));


// Endpoint di autenticazione:
// - Validazione presenza di email e password nel body.
// - Esecuzione di query su Postgres per evitare problemi di SQL injection.
// - Se trova l'utente, crea la sessione e restituisce { ok: true, user }.
// - Altrimenti, restituisce 401 con "invalid_credentials".
app.post('/auth', async (req, res) => {
  try {
    console.log('[/auth] body:', req.body);
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'missing_fields' });
    }

    //Confronto password in chiaro. TODO: usare hash bcrypt.
    const sql = 'SELECT id, email FROM users WHERE email = $1 AND password = $2 LIMIT 1';
    const { rows } = await pool.query(sql, [email, password]);

    console.log('[/auth] rows:', rows.length);
    if (rows.length !== 1) {
      return res.status(401).json({ ok: false, message: 'invalid_credentials' });
    }

    // Salvataggio dello stato di login nella sessione (server-side) e info utente non sensibili.
    req.session.loggedIn = true;
    req.session.user = { id: rows[0].id, email: rows[0].email };
    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error('[/auth] error:', err);
    return res.status(500).json({ ok: false, message: 'server_error' });
  }
});

// Endpoint di verifica sessione:
// - Se la sessione esiste e l'utente è loggato, ritorna { ok: true, user }.
// - Altrimenti 401 "not_logged_in".
app.get('/me', (req, res) => {
  if (req.session?.loggedIn) return res.json({ ok: true, user: req.session.user });
  return res.status(401).json({ ok: false, message: 'not_logged_in' });
});


// Health-check per verificare che il server risponde.
app.get('/', (_req, res) => {
  res.send('API up');
});

const PORT = process.env.PORT || 3000;
// Avvio del server HTTP su PORT (default 3000). Stampa dell'URL locale d'ascolto.
app.listen(PORT, () => console.log(`API http://localhost:${PORT}`));
