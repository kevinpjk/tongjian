import { Router } from 'express';
import { db } from '../db.js';

export const connectionsRouter = Router();

// Returns connections joined with just enough event info to draw and label them.
connectionsRouter.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*,
        ea.stream_id AS a_stream_id, ea.year_start AS a_year, ea.title_en AS a_title_en, ea.title_zh AS a_title_zh,
        eb.stream_id AS b_stream_id, eb.year_start AS b_year, eb.title_en AS b_title_en, eb.title_zh AS b_title_zh
       FROM connections c
       JOIN events ea ON ea.id = c.event_a
       JOIN events eb ON eb.id = c.event_b
       ORDER BY c.id DESC`
    )
    .all();
  res.json(rows);
});

connectionsRouter.post('/', (req, res) => {
  const { event_a, event_b, description_en = '', description_zh = '' } = req.body || {};
  const a = parseInt(event_a, 10);
  const b = parseInt(event_b, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b)
    return res.status(400).json({ error: 'A connection needs two different events.' });
  const exists = db
    .prepare('SELECT id FROM connections WHERE (event_a=? AND event_b=?) OR (event_a=? AND event_b=?)')
    .get(a, b, b, a);
  if (exists) return res.status(409).json({ error: 'These two events are already connected.' });
  const info = db
    .prepare('INSERT INTO connections (event_a, event_b, description_en, description_zh) VALUES (?,?,?,?)')
    .run(a, b, description_en, description_zh);
  res.json(db.prepare('SELECT * FROM connections WHERE id = ?').get(info.lastInsertRowid));
});

connectionsRouter.put('/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Connection not found.' });
  const next = { ...cur, ...req.body };
  db.prepare('UPDATE connections SET description_en=?, description_zh=? WHERE id=?').run(
    next.description_en,
    next.description_zh,
    cur.id
  );
  res.json(db.prepare('SELECT * FROM connections WHERE id = ?').get(cur.id));
});

connectionsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM connections WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
