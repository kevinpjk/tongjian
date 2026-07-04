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
      `SELECT s.id, s.name_en, s.name_zh,
        (SELECT COUNT(*) FROM events e WHERE e.stream_id = s.id) AS event_count,
        (SELECT MIN(year_start) FROM events e WHERE e.stream_id = s.id) AS min_year,
        (SELECT MAX(COALESCE(year_end, year_start)) FROM events e WHERE e.stream_id = s.id) AS max_year
       FROM streams s ORDER BY s.sort_order, s.id`
    )
    .all();
  return streams
    .map(
      (s) =>
        `- stream_id=${s.id}: ${s.name_en}${s.name_zh ? ` / ${s.name_zh}` : ''} (${s.event_count} events, years ${s.min_year ?? '—'}..${s.max_year ?? '—'})`
    )
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
  "proposed_connections": [
    {
      "event_a": <existing event_id>,
      "event_b": <existing event_id>,
      "description_en": "how these two events relate across streams",
      "description_zh": "两个事件之间的联系"
    }
  ]
}
"proposed_events" and "proposed_connections" may be empty arrays. Always fill BOTH the English and Chinese fields for anything you propose. Only propose connections between event_ids listed in the repository sample. Never invent stream_ids.`;

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
  for (const c of parsed.proposed_connections || []) {
    const a = db.prepare('SELECT id FROM events WHERE id = ?').get(c?.event_a);
    const b = db.prepare('SELECT id FROM events WHERE id = ?').get(c?.event_b);
    if (!a || !b || c.event_a === c.event_b) continue;
    const info = insert.run('connection', JSON.stringify(c), origin);
    stored.push({ id: info.lastInsertRowid, kind: 'connection', payload: c });
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
