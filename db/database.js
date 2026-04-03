const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Em produção (Render), usa /tmp para SQLite (disco efêmero)
// Para persistência real no Render, use PostgreSQL. SQLite aqui é ideal para Railway.
const dbDir = process.env.DB_PATH || path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'arena.db'));

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    phone     TEXT    NOT NULL,
    password  TEXT    NOT NULL,
    role      TEXT    NOT NULL DEFAULT 'user',
    saldo     REAL    NOT NULL DEFAULT 0,
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
`);

// Seed config defaults
const insertCfg = db.prepare(`INSERT OR IGNORE INTO config(key,value) VALUES (?,?)`);
insertCfg.run('pix_key', 'arena@amadora.com');
insertCfg.run('arena_nome', 'Arena Amadora');

module.exports = db;
