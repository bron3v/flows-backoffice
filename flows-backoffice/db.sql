CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Creazione schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Creazione tabella utenti
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

SELECT email, now() - last_seen AS diff FROM auth.users ORDER BY last_seen DESC;




