CREATE TABLE IF NOT EXISTS prompthub_auth_sessions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > 0)
);

CREATE INDEX IF NOT EXISTS prompthub_auth_sessions_expiry
  ON prompthub_auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS prompthub_oauth_states (
  state_hash TEXT PRIMARY KEY NOT NULL CHECK (length(state_hash) = 64),
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > 0)
);

CREATE INDEX IF NOT EXISTS prompthub_oauth_states_expiry
  ON prompthub_oauth_states (expires_at);
