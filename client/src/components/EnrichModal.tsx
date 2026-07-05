import { useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';

export default function EnrichModal() {
  const streamId = useStore((s) => s.enrichStreamId)!;
  const stream = useStore((s) => s.streams.find((x) => x.id === streamId));
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);

  const [focus, setFocus] = useState('');
  const [fromYear, setFromYear] = useState<number | ''>(stream?.year_active_start ?? '');
  const [toYear, setToYear] = useState<number | ''>(stream?.year_active_end ?? '');
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);

  const close = () => set({ enrichStreamId: null });

  const run = async () => {
    setBusy(true);
    try {
      const out = await api.post<{ reply: string; proposals: any[] }>('/api/llm/enrich', {
        stream_id: streamId,
        focus,
        from_year: fromYear,
        to_year: toYear,
        count
      });
      await useStore.getState().loadProposals();
      close();
      set({ panelTab: 'review' });
      showToast(`${out.proposals.length} proposal(s) ready in Review · 待审`);
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            Enrich · 充实 — {stream?.name_zh} {stream?.name_en}
          </h2>
          <button className="panel-close" onClick={close}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0, color: 'var(--ink-soft)', fontSize: 13.5 }}>
            The research agent will propose events for this stream. They go to <b>Review</b> — nothing is added
            until you approve.
          </p>
          <div className="field">
            <label>Focus (optional) · 主题</label>
            <input
              type="text"
              value={focus}
              placeholder="e.g. technology & science, or the Tang–Song transition"
              onChange={(e) => setFocus(e.target.value)}
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>From year (− BCE)</label>
              <input type="number" value={fromYear} onChange={(e) => setFromYear(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div className="field">
              <label>To year</label>
              <input type="number" value={toYear} onChange={(e) => setToYear(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>
          <div className="field">
            <label>How many · 数量 ({count})</label>
            <input type="range" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? 'Researching…' : '✦ Generate proposals'}
          </button>
        </div>
      </div>
    </div>
  );
}
