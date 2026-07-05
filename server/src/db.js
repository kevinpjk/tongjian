import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'tongjian.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT NOT NULL,
  name_zh TEXT DEFAULT '',
  color TEXT NOT NULL DEFAULT '#4E7C59',
  description_en TEXT DEFAULT '',
  description_zh TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  title_en TEXT DEFAULT '',
  title_zh TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  description_zh TEXT DEFAULT '',
  year_start INTEGER NOT NULL,
  year_end INTEGER,
  tags TEXT DEFAULT '[]',
  importance INTEGER DEFAULT 3,
  source_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_stream_year ON events(stream_id, year_start);
CREATE INDEX IF NOT EXISTS idx_events_year ON events(year_start);
CREATE INDEX IF NOT EXISTS idx_events_importance ON events(importance);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_a INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_b INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  description_en TEXT DEFAULT '',
  description_zh TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- 'event' | 'connection' | 'stream'
  payload TEXT NOT NULL,         -- JSON
  status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  origin TEXT DEFAULT 'agent',   -- 'chat' | 'enrich' | 'manual'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,          -- 'user' | 'assistant'
  content TEXT DEFAULT '',
  proposals_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
`);

// Safe migrations: ADD COLUMN IF NOT EXISTS equivalent for SQLite
const migrations = [
  `ALTER TABLE streams ADD COLUMN parent_id INTEGER REFERENCES streams(id) ON DELETE SET NULL`,
  `ALTER TABLE streams ADD COLUMN year_active_start INTEGER`,
  `ALTER TABLE streams ADD COLUMN year_active_end INTEGER`,
  `ALTER TABLE streams ADD COLUMN derived_from TEXT DEFAULT '[]'`,
  `ALTER TABLE streams ADD COLUMN merged_into INTEGER`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

export function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

export function rowToEvent(row) {
  if (!row) return null;
  return { ...row, tags: safeTags(row.tags) };
}

export function safeTags(text) {
  try {
    const v = JSON.parse(text || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
