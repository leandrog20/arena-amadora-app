const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Em produção, usa /tmp para SQLite. Para persistência real, use PostgreSQL.
const dbDir = process.env.DB_PATH || path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(path.join(dbDir, 'arena.db'));

// Performance pragmas
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Transaction Polyfill for node:sqlite
db.transaction = function (fn) {
  return function (...args) {
    db.exec('BEGIN TRANSACTION');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

// ── Schema ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    phone     TEXT    NOT NULL,
    password  TEXT    NOT NULL,
    role      TEXT    NOT NULL DEFAULT 'user',
    saldo     REAL    NOT NULL DEFAULT 0,
    xp        INTEGER NOT NULL DEFAULT 0,
    level     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT   NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS torneios (
    id         TEXT    PRIMARY KEY,
    nome       TEXT    NOT NULL,
    jogo       TEXT    NOT NULL,
    data_txt   TEXT    NOT NULL DEFAULT 'A definir',
    vagas      INTEGER NOT NULL DEFAULT 32,
    taxa       REAL    NOT NULL DEFAULT 0,
    premio     REAL    NOT NULL DEFAULT 0,
    formato    TEXT    NOT NULL DEFAULT 'eliminatorio',
    regras     TEXT    NOT NULL DEFAULT '',
    status     TEXT    NOT NULL DEFAULT 'aberto',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inscricoes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    torneio_id  TEXT    NOT NULL REFERENCES torneios(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(torneio_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS historico (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo       TEXT    NOT NULL,
    descricao  TEXT    NOT NULL,
    valor      REAL    NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    torneio_id    TEXT    NOT NULL REFERENCES torneios(id) ON DELETE CASCADE,
    round         INTEGER NOT NULL,
    match_number  INTEGER NOT NULL,
    player1_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    player2_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    winner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status        TEXT    NOT NULL DEFAULT 'pending',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS match_results (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id      INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    reported_by   INTEGER NOT NULL REFERENCES users(id),
    claimed_winner INTEGER NOT NULL REFERENCES users(id),
    proof_url     TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount        REAL    NOT NULL,
    pix_key       TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    admin_note    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id    TEXT,
    actor_id      INTEGER,
    actor_role    TEXT,
    action        TEXT    NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    details       TEXT,
    ip            TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Tenta adicionar colunas xp e level caso o banco já existisse antes da Fase 3
try { db.exec('ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1;'); } catch(e) {}

// ── Índices (criados apenas se não existirem) ─────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_inscricoes_torneio ON inscricoes(torneio_id);
  CREATE INDEX IF NOT EXISTS idx_inscricoes_user    ON inscricoes(user_id);
  CREATE INDEX IF NOT EXISTS idx_historico_user     ON historico(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_name         ON users(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_matches_torneio    ON matches(torneio_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_actor        ON audit_logs(actor_id);
`);

// ── Seed config defaults ──────────────────────────────────
const insertCfg = db.prepare(`INSERT OR IGNORE INTO config(key,value) VALUES (?,?)`);
insertCfg.run('pix_key', 'arena@amadora.com');
insertCfg.run('arena_nome', 'Arena Amadora');

module.exports = db;
