import { db, safeTags } from '../db.js';
import { complete } from './providers.js';

export const TAGS = [
  'politics',
  'war',
  'religion',
  'culture',
  'technology',
  'science',
  'economics',
  'art',
  'exploration',
  'other'
];

function repositorySummary() {
  const streams = db
    .prepare(
      `SELECT s.id, s.name_en, s.name_zh, s.parent_id, s.year_active_start, s.year_active_end,
        (SELECT COUNT(*) FROM events e WHERE e.stream_id = s.id) AS event_count,
        (SELECT MIN(year_start) FROM events e WHERE e.stream_id = s.id) AS min_year,
        (SELECT MAX(COALESCE(year_end, year_start)) FROM events e WHERE e.stream_id = s.id) AS max_year
       FROM streams s WHERE s.merged_into IS NULL ORDER BY s.sort_order, s.id`
    )
    .all();
  return streams
    .map((s) => {
      const parent = s.parent_id ? streams.find((p) => p.id === s.parent_id) : null;
      const parts = [
        `- stream_id=${s.id}: ${s.name_en}${s.name_zh ? ` / ${s.name_zh}` : ''}`,
        `(${s.event_count} events, years ${s.min_year ?? '—'}..${s.max_year ?? '—'})`,
      ];
      if (s.year_active_start != null || s.year_active_end != null)
        parts.push(`[active ${s.year_active_start ?? '?'}..${s.year_active_end ?? '?'}]`);
      if (parent) parts.push(`[child of ${parent.name_en}]`);
      return parts.join(' ');
    })
    .join('\n');
}

function sampleEvents(contextIds = []) {
  const ids = contextIds.filter(Number.isFinite);
  const ctx = ids.length
    ? db.prepare(`SELECT * FROM events WHERE id IN (${ids.join(',')})`).all()
    : [];
  const recent = db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 40').all();
  const seen = new Set();
  const merged = [...ctx, ...recent].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  return merged
    .map(
      (e) =>
        `- event_id=${e.id} [stream ${e.stream_id}] ${e.year_start}${e.year_end ? `..${e.year_end}` : ''}: ${e.title_en || e.title_zh} ${e.title_zh && e.title_en ? `/ ${e.title_zh}` : ''} (tags: ${safeTags(e.tags).join(', ') || 'none'})`
    )
    .join('\n');
}

const SCHEMA = `Respond with a single JSON object and nothing else (no markdown fences, no commentary outside JSON):
{
  "reply": "your conversational answer to the user, in the language they used",
  "proposed_events": [
    {
      "stream_id": <integer, must be one of the existing stream_ids>,
      "title_en": "English title",
      "title_zh": "中文标题",
      "description_en": "2-4 sentence English description",
      "description_zh": "两到四句中文描述",
      "year_start": <integer year; NEGATIVE for BCE, e.g. -221 means 221 BCE>,
      "year_end": <integer or null; use for durations like dynasties or wars>,
      "tags": ["one or more of: ${TAGS.join(', ')}"],
      "importance": <1-5; 5 = civilization-defining, 3 = notable, 1 = fine detail>,
      "source_note": "brief note on how well-established this is"
    }
  ],
  "proposed_edits": [
    {
      "event_id": <existing event_id to edit>,
      "title_en": "updated English title (or omit to keep current)",
      "title_zh": "updated 中文标题 (or omit to keep current)",
      "description_en": "updated English description (or omit to keep current)",
      "description_zh": "updated 中文描述 (or omit to keep current)",
      "year_start": <updated year or omit>,
      "year_end": <updated year or omit>,
      "tags": ["updated tags or omit"],
      "importance": <updated 1-5 or omit>,
      "source_note": "updated source note or omit"
    }
  ],
  "proposed_connections": [
    {
      "event_a": <existing event_id>,
      "event_b": <existing event_id>,
      "description_en": "how these two events relate across streams",
      "description_zh": "两个事件之间的联系"
    }
  ],
  "proposed_streams": [
    {
      "name_en": "English name",
      "name_zh": "中文名称",
      "description_en": "brief English description of what this stream covers",
      "description_zh": "简要中文描述",
      "color": "#hex color from palette",
      "parent_id": <optional existing stream_id if this is a substream, or null>,
      "year_active_start": <optional integer year when this stream begins, negative for BCE>,
      "year_active_end": <optional integer year when this stream ends, or null if ongoing>
    }
  ]
}
All arrays may be empty. Always fill BOTH the English and Chinese fields for anything you propose. Only propose edits and connections for event_ids listed in the repository sample. Never invent stream_ids (except parent_id for proposed_streams, which must reference an existing stream).`;

export function chatSystemPrompt(contextIds) {
  return `You are the research agent inside Tongjian (通鉴), a personal comparative world-history timeline. The user curates parallel "streams" (civilizations/regions) and enriches them with events. You help them research history, compare civilizations, and propose new events or cross-stream connections. Nothing you propose is added directly — it goes to a review queue the user approves.

Be historically careful: prefer well-established dates and note uncertainty in source_note (e.g. "traditional date", "disputed"). For comparative questions, actively look for synchronisms across streams (e.g. Han–Rome trade, Axial Age thinkers).

Current repository streams:
${repositorySummary() || '(no streams yet — you may suggest the user create some, but do not invent stream_ids)'}

Sample of existing events (for connections and to avoid duplicates):
${sampleEvents(contextIds) || '(no events yet)'}

${SCHEMA}`;
}

export function enrichSystemPrompt() {
  return `You are the research agent inside Tongjian (通鉴), a personal comparative world-history timeline. Generate well-chosen historical events for the requested stream and period. Prefer a mix of tags and importance levels, avoid duplicating existing events, and be careful with dates (negative years = BCE).

Current repository streams:
${repositorySummary()}

${SCHEMA}`;
}

export function parseAgentJson(text) {
  let t = (text || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
  }
  return { reply: text, proposed_events: [], proposed_connections: [] };
}

export function storeProposals(parsed, origin) {
  const insert = db.prepare('INSERT INTO proposals (kind, payload, origin) VALUES (?,?,?)');
  const stored = [];
  for (const e of parsed.proposed_events || []) {
    if (!Number.isFinite(parseInt(e?.stream_id, 10)) || !Number.isFinite(parseInt(e?.year_start, 10))) continue;
    if (!db.prepare('SELECT id FROM streams WHERE id = ?').get(e.stream_id)) continue;
    const info = insert.run('event', JSON.stringify(e), origin);
    stored.push({ id: info.lastInsertRowid, kind: 'event', payload: e });
  }
  for (const ed of parsed.proposed_edits || []) {
    const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(ed?.event_id);
    if (!existing) continue;
    const info = insert.run('edit', JSON.stringify(ed), origin);
    stored.push({ id: info.lastInsertRowid, kind: 'edit', payload: ed });
  }
  for (const c of parsed.proposed_connections || []) {
    const a = db.prepare('SELECT id FROM events WHERE id = ?').get(c?.event_a);
    const b = db.prepare('SELECT id FROM events WHERE id = ?').get(c?.event_b);
    if (!a || !b || c.event_a === c.event_b) continue;
    const info = insert.run('connection', JSON.stringify(c), origin);
    stored.push({ id: info.lastInsertRowid, kind: 'connection', payload: c });
  }
  for (const s of parsed.proposed_streams || []) {
    if (!s?.name_en && !s?.name_zh) continue;
    if (s.parent_id != null && !db.prepare('SELECT id FROM streams WHERE id = ?').get(s.parent_id)) continue;
    const info = insert.run('stream', JSON.stringify(s), origin);
    stored.push({ id: info.lastInsertRowid, kind: 'stream', payload: s });
  }
  return stored;
}

export async function runChat({ messages, context_event_ids = [] }) {
  const text = await complete({
    system: chatSystemPrompt(context_event_ids.map((n) => parseInt(n, 10))),
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  });
  const parsed = parseAgentJson(text);
  const proposals = storeProposals(parsed, 'chat');
  return { reply: parsed.reply || '', proposals };
}

export async function runDescribeConnection(connectionId) {
  const conn = db.prepare(
    `SELECT c.*, ea.title_en AS a_title_en, ea.title_zh AS a_title_zh, ea.description_en AS a_desc_en, ea.year_start AS a_year,
     eb.title_en AS b_title_en, eb.title_zh AS b_title_zh, eb.description_en AS b_desc_en, eb.year_start AS b_year
     FROM connections c JOIN events ea ON ea.id=c.event_a JOIN events eb ON eb.id=c.event_b WHERE c.id=?`
  ).get(connectionId);
  if (!conn) throw new Error('Connection not found.');

  const prompt = `Describe the historical connection between these two events in 1-2 sentences each in English and Chinese:

Event A: "${conn.a_title_en || conn.a_title_zh}" (${conn.a_year < 0 ? `${-conn.a_year} BCE` : conn.a_year})
${conn.a_desc_en || ''}

Event B: "${conn.b_title_en || conn.b_title_zh}" (${conn.b_year < 0 ? `${-conn.b_year} BCE` : conn.b_year})
${conn.b_desc_en || ''}

Respond with ONLY a JSON object: {"description_en": "...", "description_zh": "..."}`;

  const text = await complete({ system: 'You are a concise history expert. Respond only with the requested JSON.', messages: [{ role: 'user', content: prompt }] });
  let parsed;
  try {
    const t = (text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] || t);
  } catch {
    parsed = { description_en: text, description_zh: '' };
  }

  db.prepare('UPDATE connections SET description_en=?, description_zh=? WHERE id=?')
    .run(parsed.description_en || '', parsed.description_zh || '', connectionId);

  return { description_en: parsed.description_en || '', description_zh: parsed.description_zh || '' };
}

export async function runEnrich({ stream_id, focus = '', from_year, to_year, count = 8 }) {
  const stream = db.prepare('SELECT * FROM streams WHERE id = ?').get(stream_id);
  if (!stream) throw new Error('Stream not found.');
  const existing = db
    .prepare('SELECT title_en, title_zh, year_start FROM events WHERE stream_id = ? ORDER BY year_start')
    .all(stream_id)
    .map((e) => `${e.year_start}: ${e.title_en || e.title_zh}`)
    .join('\n');

  const ask = [
    `Propose ${Math.min(20, Math.max(1, parseInt(count, 10) || 8))} events for stream_id=${stream.id} (${stream.name_en}${stream.name_zh ? ` / ${stream.name_zh}` : ''}).`,
    focus ? `Focus: ${focus}` : '',
    from_year != null && from_year !== '' ? `Earliest year: ${from_year} (negative = BCE).` : '',
    to_year != null && to_year !== '' ? `Latest year: ${to_year}.` : '',
    existing ? `Do not duplicate these existing events:\n${existing}` : 'This stream has no events yet.',
    'Put them in proposed_events. Keep "reply" to one short sentence.'
  ]
    .filter(Boolean)
    .join('\n');

  const text = await complete({ system: enrichSystemPrompt(), messages: [{ role: 'user', content: ask }] });
  const parsed = parseAgentJson(text);
  const proposals = storeProposals(parsed, 'enrich');
  return { reply: parsed.reply || '', proposals };
}
