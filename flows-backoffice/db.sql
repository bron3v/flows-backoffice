CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Creazione schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Creazione tabella utenti
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Inserimento di un utente iniziale
INSERT INTO auth.users (email, password)
VALUES ('flowsBackoffice@unica.it', 'flows');
