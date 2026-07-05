import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { STREAM_PALETTE, type Stream, type HEvent } from '../types';

function sortedByHierarchy(streams: Stream[]): Stream[] {
  const roots = streams.filter((s) => !s.parent_id);
  const children = streams.filter((s) => s.parent_id);
  const result: Stream[] = [];
  for (const r of roots) {
    result.push(r);
    for (const c of children) {
      if (c.parent_id === r.id) result.push(c);
    }
  }
  // any orphans (parent not in visible list)
  for (const c of children) {
    if (!result.includes(c)) result.push(c);
  }
  return result;
}

export default function StreamManager() {
  const streams = useStore((s) => s.streams);
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);
  const loadStreams = useStore((s) => s.loadStreams);
  const [showMerged, setShowMerged] = useState(false);
  const [mergedStreams, setMergedStreams] = useState<Stream[]>([]);
  const [draft, setDraft] = useState({
    name_en: '', name_zh: '', color: STREAM_PALETTE[3],
    parent_id: null as number | null,
    year_active_start: '' as string,
    year_active_end: '' as string,
  });

  useEffect(() => {
    if (showMerged) {
      api.get<Stream[]>('/api/streams?include_merged=1').then((all) =>
        setMergedStreams(all.filter((s) => s.merged_into != null))
      );
    }
  }, [showMerged]);

  const close = () => set({ managingStreams: false });

  const add = async () => {
    if (!draft.name_en && !draft.name_zh) return showToast('Name the stream in at least one language.');
    await api.post('/api/streams', {
      ...draft,
      year_active_start: draft.year_active_start ? Number(draft.year_active_start) : null,
      year_active_end: draft.year_active_end ? Number(draft.year_active_end) : null,
    });
    await loadStreams();
    setDraft({
      name_en: '', name_zh: '', color: STREAM_PALETTE[(streams.length + 1) % STREAM_PALETTE.length],
      parent_id: null, year_active_start: '', year_active_end: '',
    });
    showToast('Stream added · 已新增');
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Streams · 历史之流</h2>
          <button className="panel-close" onClick={close}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {sortedByHierarchy(streams).map((s) => (
            <StreamRow key={s.id} stream={s} />
          ))}

          {/* merged/archived streams */}
          <div style={{ marginTop: 12 }}>
            <button className="btn ghost small" onClick={() => setShowMerged(!showMerged)}>
              {showMerged ? '▾ Hide' : '▸ Show'} merged streams ({mergedStreams.length || '…'})
            </button>
            {showMerged && mergedStreams.map((s) => (
              <div key={s.id} className="stream-row" style={{ opacity: 0.5 }}>
                <span className="swatch-fixed" style={{ background: s.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--serif-zh)', fontWeight: 600 }}>{s.name_zh}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {s.name_en} · merged into stream #{s.merged_into}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="subhead">Add a stream · 新增</div>
          <div className="row2">
            <div className="field">
              <label>Name (EN)</label>
              <input type="text" value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} />
            </div>
            <div className="field">
              <label>名称 (中文)</label>
              <input
                type="text"
                value={draft.name_zh}
                onChange={(e) => setDraft({ ...draft, name_zh: e.target.value })}
                style={{ fontFamily: 'var(--serif-zh)' }}
              />
            </div>
          </div>
          <div className="field">
            <label>Colour</label>
            <div className="swatches">
              {STREAM_PALETTE.map((c) => (
                <button
                  key={c}
                  className={`swatch ${draft.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setDraft({ ...draft, color: c })}
                />
              ))}
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Parent stream</label>
              <select
                value={draft.parent_id ?? ''}
                onChange={(e) => setDraft({ ...draft, parent_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">None (top-level)</option>
                {streams.filter((s) => !s.merged_into).map((s) => (
                  <option key={s.id} value={s.id}>{s.name_en || s.name_zh}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Active from (year)</label>
              <input
                type="number"
                placeholder="e.g. -753"
                value={draft.year_active_start}
                onChange={(e) => setDraft({ ...draft, year_active_start: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Active until (year)</label>
              <input
                type="number"
                placeholder="e.g. 476"
                value={draft.year_active_end}
                onChange={(e) => setDraft({ ...draft, year_active_end: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={close}>
            Done
          </button>
          <button className="btn primary" onClick={add}>
            Add stream
          </button>
        </div>
      </div>
    </div>
  );
}

function StreamRow({ stream }: { stream: Stream }) {
  const streams = useStore((s) => s.streams);
  const loadStreams = useStore((s) => s.loadStreams);
  const showToast = useStore((s) => s.showToast);
  const [edit, setEdit] = useState(false);
  const [merging, setMerging] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [f, setF] = useState({
    name_en: stream.name_en, name_zh: stream.name_zh, color: stream.color,
    description_en: stream.description_en || '', description_zh: stream.description_zh || '',
    parent_id: stream.parent_id,
    year_active_start: stream.year_active_start != null ? String(stream.year_active_start) : '',
    year_active_end: stream.year_active_end != null ? String(stream.year_active_end) : '',
  });

  const save = async () => {
    await api.put(`/api/streams/${stream.id}`, {
      ...f,
      year_active_start: f.year_active_start ? Number(f.year_active_start) : null,
      year_active_end: f.year_active_end ? Number(f.year_active_end) : null,
    });
    await loadStreams();
    setEdit(false);
    showToast('Stream saved');
  };
  const remove = async () => {
    if (!confirm(`Delete "${stream.name_en || stream.name_zh}" and all its events? This cannot be undone.`)) return;
    await api.del(`/api/streams/${stream.id}`);
    const s = useStore.getState();
    await Promise.all([s.loadStreams(), s.loadConnections()]);
    showToast('Stream deleted');
  };

  if (edit)
    return (
      <div className="stream-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <input type="text" value={f.name_zh} onChange={(e) => setF({ ...f, name_zh: e.target.value })} style={{ width: 110, fontFamily: 'var(--serif-zh)' }} placeholder="中文名" />
        <input type="text" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} style={{ width: 130 }} placeholder="English name" />
        <div className="swatches">
          {STREAM_PALETTE.map((c) => (
            <button key={c} className={`swatch ${f.color === c ? 'active' : ''}`} style={{ background: c, width: 18, height: 18 }} onClick={() => setF({ ...f, color: c })} />
          ))}
        </div>
        <select
          value={f.parent_id ?? ''}
          onChange={(e) => setF({ ...f, parent_id: e.target.value ? Number(e.target.value) : null })}
          style={{ width: 130 }}
        >
          <option value="">No parent</option>
          {streams.filter((s) => !s.merged_into && s.id !== stream.id).map((s) => (
            <option key={s.id} value={s.id}>{s.name_en || s.name_zh}</option>
          ))}
        </select>
        <input type="number" value={f.year_active_start} onChange={(e) => setF({ ...f, year_active_start: e.target.value })} style={{ width: 80 }} placeholder="From yr" />
        <input type="number" value={f.year_active_end} onChange={(e) => setF({ ...f, year_active_end: e.target.value })} style={{ width: 80 }} placeholder="To yr" />
        <div style={{ width: '100%' }}>
          <input type="text" value={f.description_en} onChange={(e) => setF({ ...f, description_en: e.target.value })} placeholder="Description (EN)" style={{ width: '100%', marginBottom: 4 }} />
          <input type="text" value={f.description_zh} onChange={(e) => setF({ ...f, description_zh: e.target.value })} placeholder="描述 (中文)" style={{ width: '100%', fontFamily: 'var(--serif-zh)' }} />
        </div>
        <button className="btn primary small" onClick={save}>
          Save
        </button>
        <button className="btn small" onClick={() => setEdit(false)}>
          Cancel
        </button>
      </div>
    );

  const parentStream = stream.parent_id ? streams.find((s) => s.id === stream.parent_id) : null;
  const yearRange = stream.year_active_start != null || stream.year_active_end != null
    ? `${stream.year_active_start ?? '?'} – ${stream.year_active_end ?? '?'}`
    : null;
  const derivedIds: number[] = (() => { try { return JSON.parse(stream.derived_from || '[]'); } catch { return []; } })();
  const derivedNames = derivedIds.map((id) => streams.find((s) => s.id === id)).filter(Boolean);

  const moveUp = async () => {
    const idx = streams.findIndex((s) => s.id === stream.id);
    if (idx <= 0) return;
    const other = streams[idx - 1];
    await Promise.all([
      api.put(`/api/streams/${stream.id}`, { sort_order: other.sort_order }),
      api.put(`/api/streams/${other.id}`, { sort_order: stream.sort_order }),
    ]);
    await loadStreams();
  };
  const moveDown = async () => {
    const idx = streams.findIndex((s) => s.id === stream.id);
    if (idx >= streams.length - 1) return;
    const other = streams[idx + 1];
    await Promise.all([
      api.put(`/api/streams/${stream.id}`, { sort_order: other.sort_order }),
      api.put(`/api/streams/${other.id}`, { sort_order: stream.sort_order }),
    ]);
    await loadStreams();
  };

  return (
    <div className="stream-row" style={stream.parent_id ? { marginLeft: 20 } : undefined}>
      <div className="sort-arrows">
        <button className="arrow" onClick={moveUp} title="Move up">↑</button>
        <button className="arrow" onClick={moveDown} title="Move down">↓</button>
      </div>
      <span className="swatch-fixed" style={{ background: stream.color }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--serif-zh)', fontWeight: 600 }}>{stream.name_zh}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {stream.name_en} · {stream.event_count} events
          {parentStream && <> · sub of {parentStream.name_en || parentStream.name_zh}</>}
          {yearRange && <> · {yearRange}</>}
          {derivedNames.length > 0 && <> · merged from {derivedNames.map((s) => s!.name_en || s!.name_zh).join(', ')}</>}
        </div>
      </div>
      <button className="btn small" onClick={() => setEdit(true)}>
        Edit
      </button>
      <button className="btn small" onClick={() => setMerging(true)}>
        Merge
      </button>
      <button className="btn small" onClick={() => setSplitting(true)}>
        Split
      </button>
      <button className="btn small danger" onClick={remove}>
        Delete
      </button>
      {merging && <MergeModal stream={stream} onClose={() => setMerging(false)} />}
      {splitting && <SplitModal stream={stream} onClose={() => setSplitting(false)} />}
    </div>
  );
}

function MergeModal({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  const streams = useStore((s) => s.streams);
  const loadStreams = useStore((s) => s.loadStreams);
  const loadConnections = useStore((s) => s.loadConnections);
  const showToast = useStore((s) => s.showToast);
  const [targetId, setTargetId] = useState<number | ''>('');

  const merge = async () => {
    if (!targetId) return showToast('Select a target stream.');
    if (!confirm(`Merge "${stream.name_en || stream.name_zh}" into the selected stream? All events will be moved.`)) return;
    await api.post(`/api/streams/${targetId}/merge`, { source_id: stream.id });
    await Promise.all([loadStreams(), loadConnections()]);
    showToast('Streams merged · 已合并');
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Merge "{stream.name_en || stream.name_zh}"</h2>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, margin: '0 0 12px' }}>
            All events from this stream will be moved into the target. This stream will be marked as merged.
          </p>
          <div className="field">
            <label>Merge into</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select target stream…</option>
              {streams.filter((s) => s.id !== stream.id && !s.merged_into).map((s) => (
                <option key={s.id} value={s.id}>{s.name_zh || s.name_en} · {s.name_en}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={merge}>Merge</button>
        </div>
      </div>
    </div>
  );
}

function SplitModal({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  const loadStreams = useStore((s) => s.loadStreams);
  const showToast = useStore((s) => s.showToast);
  const [events, setEvents] = useState<HEvent[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name_en, setNameEn] = useState('');
  const [name_zh, setNameZh] = useState('');

  useEffect(() => {
    api.get<HEvent[]>(`/api/events?streams=${stream.id}&limit=5000`).then(setEvents);
  }, [stream.id]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const split = async () => {
    if (selected.size === 0) return showToast('Select at least one event to split off.');
    if (!name_en && !name_zh) return showToast('Name the new stream.');
    await api.post(`/api/streams/${stream.id}/split`, {
      event_ids: [...selected],
      name_en,
      name_zh,
      color: STREAM_PALETTE[(Math.random() * STREAM_PALETTE.length) | 0],
    });
    await loadStreams();
    showToast('Stream split · 已拆分');
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Split from "{stream.name_en || stream.name_zh}"</h2>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="row2">
            <div className="field">
              <label>New stream name (EN)</label>
              <input type="text" value={name_en} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div className="field">
              <label>新流名称 (中文)</label>
              <input type="text" value={name_zh} onChange={(e) => setNameZh(e.target.value)} style={{ fontFamily: 'var(--serif-zh)' }} />
            </div>
          </div>
          <div className="field">
            <label>Select events to move ({selected.size} selected)</label>
            <div className="split-event-list">
              {events.map((e) => (
                <label key={e.id} className="split-event-item">
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                  <span className="year">{e.year_start}</span>
                  <span>{e.title_zh || e.title_en}</span>
                </label>
              ))}
              {events.length === 0 && <div className="empty">No events in this stream.</div>}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={split}>Split off {selected.size} event(s)</button>
        </div>
      </div>
    </div>
  );
}
