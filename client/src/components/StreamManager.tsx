import { useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { STREAM_PALETTE, type Stream } from '../types';

export default function StreamManager() {
  const streams = useStore((s) => s.streams);
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);
  const loadStreams = useStore((s) => s.loadStreams);
  const [draft, setDraft] = useState({ name_en: '', name_zh: '', color: STREAM_PALETTE[3] });

  const close = () => set({ managingStreams: false });

  const add = async () => {
    if (!draft.name_en && !draft.name_zh) return showToast('Name the stream in at least one language.');
    await api.post('/api/streams', draft);
    await loadStreams();
    setDraft({ name_en: '', name_zh: '', color: STREAM_PALETTE[(streams.length + 1) % STREAM_PALETTE.length] });
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
          {streams.map((s) => (
            <StreamRow key={s.id} stream={s} />
          ))}

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
  const loadStreams = useStore((s) => s.loadStreams);
  const showToast = useStore((s) => s.showToast);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name_en: stream.name_en, name_zh: stream.name_zh, color: stream.color });

  const save = async () => {
    await api.put(`/api/streams/${stream.id}`, f);
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
      <div className="stream-row" style={{ flexWrap: 'wrap' }}>
        <input type="text" value={f.name_zh} onChange={(e) => setF({ ...f, name_zh: e.target.value })} style={{ width: 110, fontFamily: 'var(--serif-zh)' }} />
        <input type="text" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} style={{ width: 130 }} />
        <div className="swatches">
          {STREAM_PALETTE.map((c) => (
            <button key={c} className={`swatch ${f.color === c ? 'active' : ''}`} style={{ background: c, width: 18, height: 18 }} onClick={() => setF({ ...f, color: c })} />
          ))}
        </div>
        <button className="btn primary small" onClick={save}>
          Save
        </button>
        <button className="btn small" onClick={() => setEdit(false)}>
          Cancel
        </button>
      </div>
    );

  return (
    <div className="stream-row">
      <span className="swatch-fixed" style={{ background: stream.color }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--serif-zh)', fontWeight: 600 }}>{stream.name_zh}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {stream.name_en} · {stream.event_count} events
        </div>
      </div>
      <button className="btn small" onClick={() => setEdit(true)}>
        Edit
      </button>
      <button className="btn small danger" onClick={remove}>
        Delete
      </button>
    </div>
  );
}
