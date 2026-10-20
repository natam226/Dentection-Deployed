CREATE TABLE accounts (
  user_id TEXT PRIMARY KEY REFERENCES professionals(id), email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, salt TEXT NOT NULL, iterations INTEGER NOT NULL DEFAULT 100000
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES professionals(id), expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE invitations (
  token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL DEFAULT (unixepoch()+604800), used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE auth_attempts (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
