CREATE TYPE user_role AS ENUM ('user', 'admin');

-- Utenti
CREATE TABLE users (
  id             PRIMARY KEY DEFAULT gen_random_uuid(),
  username       VARCHAR(30)  NOT NULL,
  email          VARCHAR(254) NOT NULL,
  password_hash  TEXT         NOT NULL,
  role           user_role    NOT NULL DEFAULT 'user',
  is_approved    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN      NOT NULL DEFAULT FALSE);