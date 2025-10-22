--
-- PostgreSQL database dump
--


-- Dumped from database version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)

-- Started on 2025-10-15 14:15:10 CEST
ROLLBACK;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16389)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 3496 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 16446)
-- Name: registration_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.registration_requests (
    id integer NOT NULL,
    email text NOT NULL,
    affiliation text NOT NULL,
    note text,
    status text DEFAULT 'pending'::text NOT NULL,
    requester_ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.registration_requests OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16445)
-- Name: registration_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.registration_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.registration_requests_id_seq OWNER TO postgres;

--
-- TOC entry 3497 (class 0 OID 0)
-- Dependencies: 219
-- Name: registration_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.registration_requests_id_seq OWNED BY public.registration_requests.id;


--
-- TOC entry 218 (class 1259 OID 16437)
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 16427)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 16426)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 3498 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3330 (class 2604 OID 16449)
-- Name: registration_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_requests ALTER COLUMN id SET DEFAULT nextval('public.registration_requests_id_seq'::regclass);


--
-- TOC entry 3329 (class 2604 OID 16430)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3490 (class 0 OID 16446)
-- Dependencies: 220
-- Data for Name: registration_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 3488 (class 0 OID 16437)
-- Dependencies: 218
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

TRUNCATE TABLE public.session;

INSERT INTO public.session (sid, sess, expire) VALUES
('RFoEBJhGaFJIlv8tPweXQof0S__hRR8i','{"cookie":{"originalMaxAge":1209600000,"expires":"2025-10-03T14:50:26.082Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}','2025-10-15 21:40:41'),
('W5H_pRJxfjeGf7kqOMw_Coh9Kx9_KWNr','{"cookie":{"originalMaxAge":1209600000,"expires":"2025-10-16T07:25:21.715Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1}','2025-10-16 09:25:22'),
('a9x6DjTTKcF1PygibTk5pIYVJtAO3tHy','{"cookie":{"originalMaxAge":1209600000,"expires":"2025-10-27T22:06:05.475Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":2}','2025-10-29 13:10:30'),
('4_EGI_7eSQ4ZjgSJwyfxsc-_e6Bls283','{"cookie":{"originalMaxAge":1209600000,"expires":"2025-10-27T12:44:36.682Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1}','2025-10-28 09:25:49');



--
-- TOC entry 3487 (class 0 OID 16427)
-- Dependencies: 217
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--


BEGIN;
TRUNCATE TABLE public.users RESTART IDENTITY;  -- azzera righe e sequenza
INSERT INTO public.users (username, password_hash) VALUES
  ('f.pili',    '$2a$06$JgCN5pOMMMLJy3ZxEjz6/OZWxd/VUPx9EL0dCruZPcKWfGoEo//GG'),
  ('a.coppola', '$2a$06$V9ZHs8cL83qz8kZwdgk0QuG/2HkzQ/vaFxIazmur8ZE0L7SPM9ya.');
COMMIT;




--
-- TOC entry 3499 (class 0 OID 0)
-- Dependencies: 219
-- Name: registration_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.registration_requests_id_seq', 1, false);


--
-- TOC entry 3500 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- TOC entry 3341 (class 2606 OID 16455)
-- Name: registration_requests registration_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

--ALTER TABLE ONLY public.registration_requests
--    ADD CONSTRAINT registration_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3339 (class 2606 OID 16443)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

--ALTER TABLE ONLY public.session
--    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 3334 (class 2606 OID 16434)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

--ALTER TABLE ONLY public.users
--    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3336 (class 2606 OID 16436)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

--ALTER TABLE ONLY public.users
--    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3337 (class 1259 OID 16444)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 3342 (class 1259 OID 16456)
-- Name: ux_registration_requests_email_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX IF NOT EXISTS ux_registration_requests_email_pending ON public.registration_requests USING btree (lower(email)) WHERE (status = 'pending'::text);


-- Completed on 2025-10-15 14:15:10 CEST

--
-- PostgreSQL database dump complete
--

BEGIN;

-- 0) Crea l'ENUM se manca
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin','user','user_manager','logs_manager');
  END IF;
END
$$;

-- 1) Aggiungi la colonna se manca
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role public.user_role;

-- 2) Imposta il DEFAULT = 'user' (serve anche per i nuovi insert)
ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'user';

-- 3) Backfill: riempi le righe già esistenti che sono NULL
UPDATE public.users
SET role = 'user'
WHERE role IS NULL;

-- 4) Ora puoi imporre il NOT NULL senza errori
ALTER TABLE public.users
  ALTER COLUMN role SET NOT NULL;

COMMIT;

UPDATE public.users
SET role = 'admin'::public.user_role
WHERE lower(username) = 'f.pili'
RETURNING id, username, role;


