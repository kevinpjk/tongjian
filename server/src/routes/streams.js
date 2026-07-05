import { Router } from 'express';
import { db } from '../db.js';

export const streamsRouter = Router();

streamsRouter.get('/', (req, res) => {
  const includeMerged = req.query.include_merged === '1';
  const rows = db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM events e WHERE e.stream_id = s.id) AS event_count,
        (SELECT MIN(year_start) FROM events e WHERE e.stream_id = s.id) AS min_year,
        (SELECT MAX(COALESCE(year_end, year_start)) FROM events e WHERE e.stream_id = s.id) AS max_year
       FROM streams s
       ${includeMerged ? '' : 'WHERE s.merged_into IS NULL'}
       ORDER BY s.sort_order, s.id`
    )
    .all();
  res.json(rows);
});

streamsRouter.post('/', (req, res) => {
  const { name_en = '', name_zh = '', color = '#4E7C59', description_en = '', description_zh = '',
          parent_id = null, year_active_start = null, year_active_end = null } = req.body || {};
  if (!name_en && !name_zh) return res.status(400).json({ error: 'A stream needs a name in at least one language.' });
  if (parent_id != null && !db.prepare('SELECT id FROM streams WHERE id = ?').get(parent_id))
    return res.status(400).json({ error: 'Parent stream not found.' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM streams').get().m;
  const info = db
    .prepare(
      `INSERT INTO streams (name_en, name_zh, color, description_en, description_zh, sort_order,
       parent_id, year_active_start, year_active_end) VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(name_en, name_zh, color, description_en, description_zh, max + 1,
         parent_id, year_active_start, year_active_end);
  res.json(db.prepare('SELECT * FROM streams WHERE id = ?').get(info.lastInsertRowid));
});

streamsRouter.put('/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM streams WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Stream not found.' });
  const next = { ...cur, ...req.body };
  db.prepare(
    `UPDATE streams SET name_en=?, name_zh=?, color=?, description_en=?, description_zh=?, sort_order=?,
     parent_id=?, year_active_start=?, year_active_end=? WHERE id=?`
  ).run(next.name_en, next.name_zh, next.color, next.description_en, next.description_zh, next.sort_order,
        next.parent_id ?? null, next.year_active_start ?? null, next.year_active_end ?? null, cur.id);
  res.json(db.prepare('SELECT * FROM streams WHERE id = ?').get(cur.id));
});

streamsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM streams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Merge stream B into stream A: move all events, mark B as merged
streamsRouter.post('/:id/merge', (req, res) => {
  const targetId = Number(req.params.id);
  const { source_id } = req.body || {};
  if (!source_id) return res.status(400).json({ error: 'source_id required.' });
  const target = db.prepare('SELECT * FROM streams WHERE id = ?').get(targetId);
  const source = db.prepare('SELECT * FROM streams WHERE id = ?').get(source_id);
  if (!target || !source) return res.status(404).json({ error: 'Stream not found.' });

  const merge = db.transaction(() => {
    db.prepare('UPDATE events SET stream_id = ? WHERE stream_id = ?').run(targetId, source_id);
    db.prepare('UPDATE streams SET merged_into = ? WHERE id = ?').run(targetId, source_id);
    // Track lineage
    const derived = JSON.parse(target.derived_from || '[]');
    if (!derived.includes(source_id)) derived.push(source_id);
    db.prepare('UPDATE streams SET derived_from = ? WHERE id = ?').run(JSON.stringify(derived), targetId);
  });
  merge();
  res.json({ ok: true, target_id: targetId, source_id });
});

// Split: move selected events from stream A into a new stream B
streamsRouter.post('/:id/split', (req, res) => {
  const sourceId = Number(req.params.id);
  const { event_ids, name_en = '', name_zh = '', color = '#4E7C59' } = req.body || {};
  if (!Array.isArray(event_ids) || event_ids.length === 0)
    return res.status(400).json({ error: 'event_ids array required.' });
  const source = db.prepare('SELECT * FROM streams WHERE id = ?').get(sourceId);
  if (!source) return res.status(404).json({ error: 'Stream not found.' });

  const split = db.transaction(() => {
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM streams').get().m;
    const info = db.prepare(
      `INSERT INTO streams (name_en, name_zh, color, sort_order, derived_from)
       VALUES (?, ?, ?, ?, ?)`
    ).run(name_en || source.name_en + ' (split)', name_zh, color, max + 1, JSON.stringify([sourceId]));
    const newId = info.lastInsertRowid;
    const placeholders = event_ids.map(() => '?').join(',');
    db.prepare(`UPDATE events SET stream_id = ? WHERE id IN (${placeholders}) AND stream_id = ?`)
      .run(newId, ...event_ids, sourceId);
    return newId;
  });
  const newId = split();
  res.json(db.prepare('SELECT * FROM streams WHERE id = ?').get(newId));
});
