# ✅ To-Do List Tecnica per il Portale Backoffice

## 🔧 FASE 1 – Setup di base del progetto backoffice
- [ ] Definire stack tecnologico (es: Node.js + Express + MongoDB)
- [ ] Configurare sistema di routing per endpoint API interni protetti (`/admin/api/*`)
- [ ] Implementare struttura per middleware (autenticazione, logging, ecc.)

## 🖥️ FASE 2 – UI / Dashboard backoffice
- [ ] Definire struttura della dashboard (utenti, log, stato del sistema, ecc.)
- [ ] Scegliere framework UI: Vue 3 + Element Plus o Naive UI
- [ ] Creare layout base responsive (header, sidebar, contenuto)
- [ ] Collegare alla logica back-end con API protette
- [ ] Visualizzare:
  - [ ] Stato del sistema (uptime, richieste recenti)
  - [ ] Ultimi log
  - [ ] Utenti e ruoli
- [ ] Autenticazione per accesso alla dashboard
- [ ] Sistema di gestione dei ruoli (es: admin, editor, solo-lettura)

## 🔐 FASE 3 – Autenticazione sicura FLOWS
- [ ] Integrazione con Google Authenticator o simili (2FA)
  - [ ] Setup della chiave segreta e QR Code
  - [ ] Verifica del codice OTP all’accesso

## 🧠 FASE 4 – Logging avanzato
- [ ] Integrare libreria di logging (`winston`, `pino`, ecc.)
- [ ] Definire livelli di log: `info`, `warn`, `error`, `debug`, ecc.
- [ ] Loggare eventi importanti:
  - [ ] Login, logout, modifiche, errori, ecc.
- [ ] Salvare i log:
  - [ ] Su file o su database (Mongo/Postgres/Elasticsearch)
  - [ ] Opzionale: invio log a sistemi esterni (Logstash, etc.)

## 📦 FASE 6 – Deployment e manutenzione
- [ ] Deploy su sottodominio protetto (`backoffice.flows.unica.it`)
- [ ] Protezione con HTTPS, rate limiting e CORS
- [ ] Backup automatici dei log
- [ ] Monitoraggio uptime e alert via email/Telegram/Slack

## 🧪 FASE 7 – Testing e sicurezza
- [ ] Test del flusso login + 2FA + UI
- [ ] Simulazione attacchi comuni (brute-force, CSRF, XSS)
- [ ] Limitare accesso alla dashboard (IP whitelist o VPN)
- [ ] Code review e hardening di sicurezza