import { Router } from 'express';
import { db } from '../db.js';

export const streamsRouter = Router();

streamsRouter.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM events e WHERE e.stream_id = s.id) AS event_count,
        (SELECT MIN(year_start) FROM events e WHERE e.stream_id = s.id) AS min_year,
        (SELECT MAX(COALESCE(year_end, year_start)) FROM events e WHERE e.stream_id = s.id) AS max_year
       FROM streams s ORDER BY s.sort_order, s.id`
    )
    .all();
  res.json(rows);
});

streamsRouter.post('/', (req, res) => {
  const { name_en = '', name_zh = '', color = '#4E7C59', description_en = '', description_zh = '' } = req.body || {};
  if (!name_en && !name_zh) return res.status(400).json({ error: 'A stream needs a name in at least one language.' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM streams').get().m;
  const info = db
    .prepare(
      'INSERT INTO streams (name_en, name_zh, color, description_en, description_zh, sort_order) VALUES (?,?,?,?,?,?)'
    )
    .run(name_en, name_zh, color, description_en, description_zh, max + 1);
  res.json(db.prepare('SELECT * FROM streams WHERE id = ?').get(info.lastInsertRowid));
});

streamsRouter.put('/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM streams WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Stream not found.' });
  const next = { ...cur, ...req.body };
  db.prepare(
    `UPDATE streams SET name_en=?, name_zh=?, color=?, description_en=?, description_zh=?, sort_order=? WHERE id=?`
  ).run(next.name_en, next.name_zh, next.color, next.description_en, next.description_zh, next.sort_order, cur.id);
  res.json(db.prepare('SELECT * FROM streams WHERE id = ?').get(cur.id));
});

streamsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM streams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
