import { useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { TAGS, TAG_META, type HEvent } from '../types';

export default function EventEditor() {
  const editing = useStore((s) => s.editingEvent)!;
  const streams = useStore((s) => s.streams);
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);
  const isNew = !editing.id;

  const [form, setForm] = useState({
    stream_id: editing.stream_id ?? streams[0]?.id ?? 0,
    title_en: editing.title_en ?? '',
    title_zh: editing.title_zh ?? '',
    description_en: editing.description_en ?? '',
    description_zh: editing.description_zh ?? '',
    year_start: editing.year_start ?? 0,
    year_end: editing.year_end ?? ('' as number | ''),
    tags: editing.tags ?? ([] as string[]),
    importance: editing.importance ?? 3,
    source_note: editing.source_note ?? ''
  });

  const upd = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const close = () => set({ editingEvent: null });

  const save = async () => {
    if (!form.title_en && !form.title_zh) return showToast('Give the event a title in at least one language.');
    const body = { ...form, year_end: form.year_end === '' ? null : form.year_end };
    try {
      if (isNew) await api.post<HEvent>('/api/events', body);
      else await api.put<HEvent>(`/api/events/${editing.id}`, body);
      const s = useStore.getState();
      await Promise.all([s.loadStreams(), s.loadConnections()]);
      // nudge the current view to refetch
      s.set({ events: [...s.events] });
      showToast(isNew ? 'Event created · 已新增' : 'Event updated · 已更新');
      close();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isNew ? 'New event · 新事件' : 'Edit event · 编辑事件'}</h2>
          <button className="panel-close" onClick={close}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Stream · 流</label>
            <select value={form.stream_id} onChange={(e) => upd({ stream_id: Number(e.target.value) })}>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_zh} · {s.name_en}
                </option>
              ))}
            </select>
          </div>

          <div className="row2">
            <div className="field">
              <label>Title (EN)</label>
              <input type="text" value={form.title_en} onChange={(e) => upd({ title_en: e.target.value })} />
            </div>
            <div className="field">
              <label>标题 (中文)</label>
              <input
                type="text"
                value={form.title_zh}
                onChange={(e) => upd({ title_zh: e.target.value })}
                style={{ fontFamily: 'var(--serif-zh)' }}
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Year start (− = BCE)</label>
              <input
                type="number"
                value={form.year_start}
                onChange={(e) => upd({ year_start: Number(e.target.value) })}
              />
              <div className="hint">e.g. −221 = 221 BCE</div>
            </div>
            <div className="field">
              <label>Year end (optional)</label>
              <input
                type="number"
                value={form.year_end}
                onChange={(e) => upd({ year_end: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              <div className="hint">For dynasties, wars, eras</div>
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Description (EN)</label>
              <textarea value={form.description_en} onChange={(e) => upd({ description_en: e.target.value })} />
            </div>
            <div className="field">
              <label>描述 (中文)</label>
              <textarea
                value={form.description_zh}
                onChange={(e) => upd({ description_zh: e.target.value })}
                style={{ fontFamily: 'var(--serif-zh)' }}
              />
            </div>
          </div>

          <div className="field">
            <label>Tags · 标签</label>
            <div className="swatches" style={{ gap: 5 }}>
              {TAGS.map((t) => {
                const active = form.tags.includes(t);
                return (
                  <button
                    key={t}
                    className={`chip ${active ? 'active' : ''}`}
                    onClick={() => upd({ tags: active ? form.tags.filter((x) => x !== t) : [...form.tags, t] })}
                  >
                    <span className="dot" style={{ background: TAG_META[t].color }} />
                    {TAG_META[t].en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Importance · 权重 (1–5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={form.importance}
                onChange={(e) => upd({ importance: Number(e.target.value) })}
              />
              <div className="hint">5 = civilization-defining · shown even when zoomed far out</div>
            </div>
            <div className="field">
              <label>Source note · 来源</label>
              <input type="text" value={form.source_note} onChange={(e) => upd({ source_note: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
