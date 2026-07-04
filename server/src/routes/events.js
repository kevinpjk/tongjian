import { Router } from 'express';
import { db, rowToEvent } from '../db.js';

export const eventsRouter = Router();

// GET /api/events?from=-500&to=200&min_importance=3&streams=1,2&tags=politics,war&q=han&limit=800
// Only what the current viewport / filters need is loaded — this is what keeps a
// large repository fast. All params optional.
eventsRouter.get('/', (req, res) => {
  const { from, to, min_importance, streams, tags, q } = req.query;
  const limit = Math.min(parseInt(req.query.limit || '1200', 10) || 1200, 5000);
  const offset = parseInt(req.query.offset || '0', 10) || 0;

  const where = [];
  const params = {};

  if (from !== undefined && from !== '') {
    where.push('COALESCE(year_end, year_start) >= @from');
    params.from = parseInt(from, 10);
  }
  if (to !== undefined && to !== '') {
    where.push('year_start <= @to');
    params.to = parseInt(to, 10);
  }
  if (min_importance) {
    where.push('importance >= @minImp');
    params.minImp = parseInt(min_importance, 10);
  }
  if (streams) {
    const ids = String(streams)
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter(Number.isFinite);
    if (ids.length) where.push(`stream_id IN (${ids.join(',')})`);
  }
  if (tags) {
    const list = String(tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (list.length) {
      const placeholders = list.map((_, i) => `@tag${i}`).join(',');
      list.forEach((t, i) => (params[`tag${i}`] = t));
      where.push(`EXISTS (SELECT 1 FROM json_each(events.tags) je WHERE je.value IN (${placeholders}))`);
    }
  }
  if (q) {
    where.push('(title_en LIKE @q OR title_zh LIKE @q OR description_en LIKE @q OR description_zh LIKE @q)');
    params.q = `%${q}%`;
  }

  const sql = `SELECT * FROM events ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY year_start, importance DESC LIMIT ${limit} OFFSET ${offset}`;
  res.json(db.prepare(sql).all(params).map(rowToEvent));
});

eventsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Event not found.' });
  res.json(rowToEvent(row));
});

function normalize(body, current = {}) {
  const e = { ...current, ...body };
  return {
    stream_id: parseInt(e.stream_id, 10),
    title_en: e.title_en || '',
    title_zh: e.title_zh || '',
    description_en: e.description_en || '',
    description_zh: e.description_zh || '',
    year_start: parseInt(e.year_start, 10),
    year_end: e.year_end === null || e.year_end === undefined || e.year_end === '' ? null : parseInt(e.year_end, 10),
    tags: JSON.stringify(Array.isArray(e.tags) ? e.tags : []),
    importance: Math.min(5, Math.max(1, parseInt(e.importance, 10) || 3)),
    source_note: e.source_note || ''
  };
}

eventsRouter.post('/', (req, res) => {
  const e = normalize(req.body);
  if (!Number.isFinite(e.stream_id)) return res.status(400).json({ error: 'stream_id is required.' });
  if (!Number.isFinite(e.year_start)) return res.status(400).json({ error: 'year_start is required (negative = BCE).' });
  if (!e.title_en && !e.title_zh) return res.status(400).json({ error: 'A title in at least one language is required.' });
  const info = db
    .prepare(
      `INSERT INTO events (stream_id, title_en, title_zh, description_en, description_zh,
       year_start, year_end, tags, importance, source_note)
       VALUES (@stream_id, @title_en, @title_zh, @description_en, @description_zh,
       @year_start, @year_end, @tags, @importance, @source_note)`
    )
    .run(e);
  res.json(rowToEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid)));
});

eventsRouter.put('/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Event not found.' });
  const e = normalize(req.body, { ...cur, tags: JSON.parse(cur.tags || '[]') });
  db.prepare(
    `UPDATE events SET stream_id=@stream_id, title_en=@title_en, title_zh=@title_zh,
     description_en=@description_en, description_zh=@description_zh, year_start=@year_start,
     year_end=@year_end, tags=@tags, importance=@importance, source_note=@source_note,
     updated_at=datetime('now') WHERE id=@id`
  ).run({ ...e, id: cur.id });
  res.json(rowToEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(cur.id)));
});

eventsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
