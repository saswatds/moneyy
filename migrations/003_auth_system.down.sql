-- Rollback auth system

DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS webauthn_credentials CASCADE;
DROP TABLE IF EXISTS users CASCADE;
