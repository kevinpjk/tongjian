import { Router } from 'express';
import { db, rowToEvent } from '../db.js';

export const proposalsRouter = Router();

function parseRow(row) {
  return { ...row, payload: JSON.parse(row.payload) };
}

proposalsRouter.get('/', (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db.prepare('SELECT * FROM proposals WHERE status = ? ORDER BY id').all(status);
  res.json(rows.map(parseRow));
});

// Approve a proposal: writes it into the real repository.
proposalsRouter.post('/:id/approve', (req, res) => {
  const row = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Proposal not found.' });
  if (row.status !== 'pending') return res.status(409).json({ error: 'Proposal was already resolved.' });
  const p = JSON.parse(row.payload);

  try {
    if (row.kind === 'event') {
      const stream = db.prepare('SELECT id FROM streams WHERE id = ?').get(p.stream_id);
      if (!stream) throw new Error('The stream this event belongs to no longer exists.');
      const info = db
        .prepare(
          `INSERT INTO events (stream_id, title_en, title_zh, description_en, description_zh,
           year_start, year_end, tags, importance, source_note)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          p.stream_id,
          p.title_en || '',
          p.title_zh || '',
          p.description_en || '',
          p.description_zh || '',
          parseInt(p.year_start, 10),
          p.year_end == null ? null : parseInt(p.year_end, 10),
          JSON.stringify(p.tags || []),
          Math.min(5, Math.max(1, parseInt(p.importance, 10) || 3)),
          p.source_note || 'Added by research agent'
        );
      db.prepare("UPDATE proposals SET status='approved' WHERE id=?").run(row.id);
      return res.json({
        ok: true,
        created: rowToEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid))
      });
    }
    if (row.kind === 'connection') {
      const a = db.prepare('SELECT id FROM events WHERE id = ?').get(p.event_a);
      const b = db.prepare('SELECT id FROM events WHERE id = ?').get(p.event_b);
      if (!a || !b) throw new Error('One of the connected events no longer exists.');
      const exists = db
        .prepare('SELECT id FROM connections WHERE (event_a=? AND event_b=?) OR (event_a=? AND event_b=?)')
        .get(p.event_a, p.event_b, p.event_b, p.event_a);
      if (!exists) {
        db.prepare('INSERT INTO connections (event_a, event_b, description_en, description_zh) VALUES (?,?,?,?)').run(
          p.event_a,
          p.event_b,
          p.description_en || '',
          p.description_zh || ''
        );
      }
      db.prepare("UPDATE proposals SET status='approved' WHERE id=?").run(row.id);
      return res.json({ ok: true });
    }
    throw new Error(`Unknown proposal kind: ${row.kind}`);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

proposalsRouter.post('/:id/reject', (req, res) => {
  db.prepare("UPDATE proposals SET status='rejected' WHERE id=? AND status='pending'").run(req.params.id);
  res.json({ ok: true });
});

proposalsRouter.post('/approve-all', (_req, res) => {
  const rows = db.prepare("SELECT id FROM proposals WHERE status='pending' ORDER BY id").all();
  let approved = 0;
  for (const r of rows) {
    // Reuse logic by inlining: simplest is an internal fetch-less call.
    const row = db.prepare('SELECT * FROM proposals WHERE id = ?').get(r.id);
    const p = JSON.parse(row.payload);
    try {
      if (row.kind === 'event' && db.prepare('SELECT id FROM streams WHERE id=?').get(p.stream_id)) {
        db.prepare(
          `INSERT INTO events (stream_id, title_en, title_zh, description_en, description_zh,
           year_start, year_end, tags, importance, source_note) VALUES (?,?,?,?,?,?,?,?,?,?)`
        ).run(
          p.stream_id,
          p.title_en || '',
          p.title_zh || '',
          p.description_en || '',
          p.description_zh || '',
          parseInt(p.year_start, 10),
          p.year_end == null ? null : parseInt(p.year_end, 10),
          JSON.stringify(p.tags || []),
          Math.min(5, Math.max(1, parseInt(p.importance, 10) || 3)),
          p.source_note || 'Added by research agent'
        );
        db.prepare("UPDATE proposals SET status='approved' WHERE id=?").run(row.id);
        approved++;
      } else if (row.kind === 'connection') {
        const a = db.prepare('SELECT id FROM events WHERE id = ?').get(p.event_a);
        const b = db.prepare('SELECT id FROM events WHERE id = ?').get(p.event_b);
        if (a && b) {
          const exists = db
            .prepare('SELECT id FROM connections WHERE (event_a=? AND event_b=?) OR (event_a=? AND event_b=?)')
            .get(p.event_a, p.event_b, p.event_b, p.event_a);
          if (!exists)
            db.prepare(
              'INSERT INTO connections (event_a, event_b, description_en, description_zh) VALUES (?,?,?,?)'
            ).run(p.event_a, p.event_b, p.description_en || '', p.description_zh || '');
          db.prepare("UPDATE proposals SET status='approved' WHERE id=?").run(row.id);
          approved++;
        }
      }
    } catch {
      /* leave problem rows pending so the user can see them */
    }
  }
  res.json({ ok: true, approved });
});
