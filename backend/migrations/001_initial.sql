CREATE TABLE users (
  id UUID PRIMARY KEY,
  external_id VARCHAR(160) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  mode VARCHAR(32) NOT NULL,
  seed VARCHAR(255) NOT NULL,
  config_version VARCHAR(80) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE game_attempts (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  game_id VARCHAR(64) NOT NULL,
  difficulty VARCHAR(32) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  raw_score DOUBLE PRECISION,
  metrics_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX game_attempts_game_id_idx ON game_attempts(game_id);
CREATE TABLE round_attempts (
  id UUID PRIMARY KEY,
  game_attempt_id UUID NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  stimulus_json JSONB NOT NULL DEFAULT '{}',
  response_json JSONB NOT NULL DEFAULT '{}',
  correct BOOLEAN NOT NULL,
  reaction_time_ms DOUBLE PRECISION NOT NULL,
  score DOUBLE PRECISION NOT NULL
);
CREATE INDEX round_attempts_game_attempt_id_idx ON round_attempts(game_attempt_id);
CREATE TABLE events (
  id UUID PRIMARY KEY,
  game_attempt_id UUID NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  timestamp_ms DOUBLE PRECISION NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX events_game_attempt_id_idx ON events(game_attempt_id);
CREATE INDEX events_event_type_idx ON events(event_type);
CREATE TABLE game_configurations (
  id UUID PRIMARY KEY,
  version VARCHAR(80) NOT NULL UNIQUE,
  configuration_json JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
