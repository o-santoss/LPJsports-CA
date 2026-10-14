-- Núcleo da base LPJ Sports: utilizadores, sessões, mensagens, emails, documentos e registo de ações.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pendente',   -- pendente | ativo | suspenso | recusado
  pin_hash      TEXT NOT NULL,
  fails         INTEGER NOT NULL DEFAULT 0,
  lock_until    TEXT,
  photo         TEXT,                               -- nome do ficheiro em uploads/photos
  region        TEXT NOT NULL DEFAULT '',
  assoc         TEXT NOT NULL DEFAULT '',
  licence       TEXT NOT NULL DEFAULT '',
  addr          TEXT NOT NULL DEFAULT '',
  postal        TEXT NOT NULL DEFAULT '',
  tel           TEXT NOT NULL DEFAULT '',
  birth         TEXT NOT NULL DEFAULT '',
  extra         TEXT NOT NULL DEFAULT '{}',         -- campos próprios de cada app (JSON)
  notif_conf    INTEGER NOT NULL DEFAULT 1,         -- emails de alterações e avaliações
  notif_msg     INTEGER NOT NULL DEFAULT 1,         -- emails de mensagens
  consent_at    TEXT,
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX users_status ON users(status);
CREATE INDEX users_phone ON users(phone);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,                     -- hash SHA-256 do token do cookie
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  ip          TEXT,
  ua          TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE pin_resets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  tries       INTEGER NOT NULL DEFAULT 0,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL = mensagem automática
  kind        TEXT NOT NULL DEFAULT 'mensagem',
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  link        TEXT,
  created_at  TEXT NOT NULL
);
CREATE TABLE message_to (
  message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at     TEXT,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX message_to_user ON message_to(user_id, read_at);

CREATE TABLE emails (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  to_json     TEXT NOT NULL,
  cc_json     TEXT NOT NULL DEFAULT '[]',
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pendente',     -- pendente | enviado | simulado | erro
  error       TEXT,
  created_at  TEXT NOT NULL,
  sent_at     TEXT
);

CREATE TABLE documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  cat         TEXT NOT NULL,
  descr       TEXT NOT NULL DEFAULT '',
  ver         TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL,                        -- file | link
  file        TEXT,
  url         TEXT,
  fname       TEXT,
  ext         TEXT,
  size        INTEGER,
  aud         TEXT NOT NULL DEFAULT 'all',          -- 'all' ou a chave do papel mínimo
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE TABLE document_seen (
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_at     TEXT NOT NULL,
  PRIMARY KEY (document_id, user_id)
);

CREATE TABLE audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  action      TEXT NOT NULL,
  target      TEXT,
  details     TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX audit_created ON audit(created_at);
