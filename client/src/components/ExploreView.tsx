import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, visibleStreams } from '../store';
import { api, axisYear, pickPair, yearLabel } from '../api';
import type { HEvent } from '../types';
import { handleEventClick } from '../actions';

// ——— layout constants ———
const LANE_W = 282;
const GAP = 30;
const LEFT = 116;
const PAD_TOP = 96;
const PAD_BOT = 160;

type Mode = 'full' | 'card' | 'chip' | 'mini' | 'dot';

function modeFor(z: number): Mode {
  if (z >= 2.5) return 'full';
  if (z >= 0.8) return 'card';
  if (z >= 0.25) return 'chip';
  if (z >= 0.07) return 'mini';
  return 'dot';
}
const MIN_IMP: Record<Mode, number> = { full: 1, card: 2, chip: 3, mini: 4, dot: 5 };
const MODE_LABEL: Record<Mode, string> = {
  dot: '纪元 Epochs',
  mini: '时代 Eras',
  chip: '概览 Overview',
  card: '事件 Events',
  full: '细节 Detail'
};
const NODE_H: Record<Mode, number> = { full: 88, card: 60, chip: 26, mini: 20, dot: 16 };
const NCOLS: Record<Mode, number> = { full: 1, card: 1, chip: 1, mini: 2, dot: 4 };

function niceStep(raw: number) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  for (const s of steps) if (s >= raw) return s;
  return 10000;
}

export default function ExploreView() {
  const { streams, filters, events, connections, lang, zoom, selectedEventId, selectedConnectionId } = useStore();
  const set = useStore((s) => s.set);
  const selectConnection = useStore((s) => s.selectConnection);

  const shown = visibleStreams({ streams, filters });
  const laneIndex = useMemo(() => new Map(shown.map((s, i) => [s.id, i])), [shown]);

  // temporal domain from stream metadata
  const [minYear, maxYear] = useMemo(() => {
    const mins = shown.map((s) => s.min_year).filter((v): v is number => v != null);
    const maxs = shown.map((s) => s.max_year).filter((v): v is number => v != null);
    const lo = mins.length ? Math.min(...mins) : -1000;
    const hi = maxs.length ? Math.max(...maxs) : 2000;
    const pad = Math.max(80, Math.round((hi - lo) * 0.06));
    return [lo - pad, hi + pad];
  }, [shown]);

  const span = Math.max(1, maxYear - minYear);
  const mode = modeFor(zoom);
  const totalH = PAD_TOP + span * zoom + PAD_BOT;
  const totalW = LEFT + shown.length * (LANE_W + GAP) + 60;

  const yOf = (year: number) => PAD_TOP + (year - minYear) * zoom;
  const yearOf = (y: number) => minYear + (y - PAD_TOP) / zoom;
  const laneX = (streamId: number) => LEFT + (laneIndex.get(streamId) ?? 0) * (LANE_W + GAP);
  const laneCenter = (streamId: number) => laneX(streamId) + LANE_W / 2;

  // ——— viewport tracking & data fetching ———
  const scroller = useRef<HTMLDivElement>(null);
  const [viewTick, setViewTick] = useState(0);
  const lastFetch = useRef<{ from: number; to: number; key: string } | null>(null);

  const filterKey = `${filters.q}|${filters.tags.join(',')}|${filters.streamIds.join(',')}|${MIN_IMP[mode]}`;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const t = setTimeout(() => {
      const from = Math.floor(yearOf(el.scrollTop - 400));
      const to = Math.ceil(yearOf(el.scrollTop + el.clientHeight + 400));
      const prev = lastFetch.current;
      if (prev && prev.key === filterKey && from >= prev.from && to <= prev.to) return;
      const pad = Math.max(50, to - from); // fetch double the window
      const range = { from: from - pad, to: to + pad, key: filterKey };
      const params = new URLSearchParams({
        from: String(range.from),
        to: String(range.to),
        min_importance: String(MIN_IMP[mode]),
        limit: '2500'
      });
      if (filters.q) params.set('q', filters.q);
      if (filters.tags.length) params.set('tags', filters.tags.join(','));
      if (filters.streamIds.length) params.set('streams', filters.streamIds.join(','));
      api.get<HEvent[]>(`/api/events?${params}`).then((evs) => {
        lastFetch.current = range;
        set({ events: evs });
      });
    }, 180);
    return () => clearTimeout(t);
  }, [viewTick, zoom, filterKey, minYear, maxYear, streams]);

  // ctrl/cmd + wheel zoom, anchored at the cursor
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const st = useStore.getState();
      const z0 = st.zoom;
      const z1 = Math.min(8, Math.max(0.02, z0 * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      if (z1 === z0) return;
      const rect = el.getBoundingClientRect();
      const cursorY = e.clientY - rect.top;
      const yearAt = minYear + (el.scrollTop + cursorY - PAD_TOP) / z0;
      st.set({ zoom: z1 });
      requestAnimationFrame(() => {
        el.scrollTop = PAD_TOP + (yearAt - minYear) * z1 - cursorY;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [minYear]);

  const zoomBy = (f: number) => {
    const el = scroller.current;
    const st = useStore.getState();
    const z0 = st.zoom;
    const z1 = Math.min(8, Math.max(0.02, z0 * f));
    if (el) {
      const centerYear = minYear + (el.scrollTop + el.clientHeight / 2 - PAD_TOP) / z0;
      st.set({ zoom: z1 });
      requestAnimationFrame(() => {
        el.scrollTop = PAD_TOP + (centerYear - minYear) * z1 - el.clientHeight / 2;
      });
    } else st.set({ zoom: z1 });
  };

  const fit = () => {
    const el = scroller.current;
    if (!el) return;
    const z = Math.min(8, Math.max(0.02, (el.clientHeight - PAD_TOP - 60) / span));
    set({ zoom: z });
    requestAnimationFrame(() => (el.scrollTop = 0));
  };

  // ——— node placement (greedy sub-columns per lane) ———
  const placed = useMemo(() => {
    const h = NODE_H[mode];
    const ncols = NCOLS[mode];
    const out: { e: HEvent; x: number; y: number; w: number; h: number; col: number }[] = [];
    for (const st of shown) {
      const evs = events
        .filter((e) => e.stream_id === st.id && e.importance >= MIN_IMP[mode])
        .sort((a, b) => a.year_start - b.year_start || b.importance - a.importance);
      const bottoms = new Array(ncols).fill(-Infinity);
      const baseX = laneX(st.id);
      const subW = (LANE_W - 6) / ncols;
      for (const e of evs) {
        let y = yOf(e.year_start);
        let col = bottoms.findIndex((b) => b <= y);
        if (col === -1) {
          col = bottoms.indexOf(Math.min(...bottoms));
          y = bottoms[col] + 3;
        }
        bottoms[col] = y + h + 4;
        out.push({
          e,
          x: baseX + col * subW + 3,
          y,
          w: mode === 'dot' ? NODE_H.dot : subW - 6,
          h,
          col
        });
      }
    }
    return out;
  }, [events, shown, zoom, mode]);

  // only mount nodes near the viewport
  const el = scroller.current;
  const winTop = (el?.scrollTop ?? 0) - 700;
  const winBot = (el?.scrollTop ?? 0) + (el?.clientHeight ?? 900) + 700;
  const inWindow = placed.filter((p) => p.y + p.h >= winTop && p.y <= winBot);

  // duration bars (exact spans, drawn behind nodes)
  const durationBars = useMemo(
    () =>
      events
        .filter((e) => e.year_end != null && e.year_end > e.year_start && laneIndex.has(e.stream_id))
        .map((e) => ({
          id: e.id,
          x: laneX(e.stream_id) - 9,
          y: yOf(e.year_start),
          h: Math.max(4, (e.year_end! - e.year_start) * zoom),
          color: shown.find((s) => s.id === e.stream_id)?.color || '#999'
        })),
    [events, zoom, shown]
  );

  // gridlines
  const step = niceStep(140 / zoom);
  const gridYears: number[] = [];
  for (let y = Math.ceil(minYear / step) * step; y <= maxYear; y += step) gridYears.push(y);

  // connections between visible streams
  const linkedToSelected = useMemo(() => {
    const s = new Set<number>();
    for (const c of connections) {
      if (c.event_a === selectedEventId || c.id === selectedConnectionId) s.add(c.event_b);
      if (c.event_b === selectedEventId || c.id === selectedConnectionId) s.add(c.event_a);
    }
    if (selectedConnectionId != null) {
      const c = connections.find((x) => x.id === selectedConnectionId);
      if (c) {
        s.add(c.event_a);
        s.add(c.event_b);
      }
    }
    return s;
  }, [connections, selectedEventId, selectedConnectionId]);

  const paths = connections
    .filter((c) => laneIndex.has(c.a_stream_id) && laneIndex.has(c.b_stream_id))
    .map((c) => {
      const xa = laneCenter(c.a_stream_id);
      const xb = laneCenter(c.b_stream_id);
      const ya = yOf(c.a_year);
      const yb = yOf(c.b_year);
      const d =
        xa === xb
          ? `M ${xa} ${ya} C ${xa + 90} ${ya}, ${xb + 90} ${yb}, ${xb} ${yb}`
          : `M ${xa} ${ya} C ${(xa + xb) / 2} ${ya}, ${(xa + xb) / 2} ${yb}, ${xb} ${yb}`;
      const hot =
        c.id === selectedConnectionId || c.event_a === selectedEventId || c.event_b === selectedEventId;
      return { c, d, hot };
    });

  if (!streams.length)
    return <div className="empty" style={{ marginTop: 60 }}>No streams yet — create one from the Streams button, or run <code>npm run seed</code>.</div>;

  return (
    <div
      className="scrollview"
      ref={scroller}
      onScroll={() => setViewTick((t) => t + 1)}
    >
      <div className="scroll-canvas" style={{ height: totalH, width: totalW, minWidth: '100%' }}>
        {/* sticky civilization headers */}
        <div className="lane-headers" style={{ width: totalW }}>
          <div style={{ width: LEFT, flexShrink: 0 }} />
          {shown.map((st) => (
            <div key={st.id} className="lane-header" style={{ width: LANE_W, marginRight: GAP, flexShrink: 0 }}>
              {lang !== 'en' && st.name_zh && <div className="zh">{st.name_zh}</div>}
              {lang !== 'zh' && <div className="en">{st.name_en}</div>}
              <div className="rule" style={{ background: st.color }} />
              <div className="meta">
                <span>{st.event_count} events</span>
                <button onClick={() => useStore.getState().set({ enrichStreamId: st.id })}>✦ Enrich 充实</button>
              </div>
            </div>
          ))}
        </div>

        {/* gridlines + connection threads */}
        <svg className="grid-svg" width={totalW} height={totalH}>
          {gridYears.map((y) => (
            <line key={y} x1={0} x2={totalW} y1={yOf(y)} y2={yOf(y)} stroke="var(--line)" strokeWidth={y === 0 ? 1.5 : 0.8} strokeDasharray={y === 0 ? undefined : '2 5'} />
          ))}
          {paths.map(({ c, d, hot }) => (
            <path
              key={c.id}
              className={`conn-path ${hot ? 'hot' : ''}`}
              d={d}
              onClick={() => selectConnection(c.id)}
            >
              <title>{(c.a_title_en || c.a_title_zh) + ' ⟡ ' + (c.b_title_en || c.b_title_zh)}</title>
            </path>
          ))}
        </svg>

        {/* year axis labels */}
        {gridYears.map((y) => (
          <div key={y} className="axis-label" style={{ top: yOf(y), fontWeight: y === 0 ? 700 : 400 }}>
            {axisYear(y, lang === 'zh' ? 'zh' : 'en')}
          </div>
        ))}

        {/* exact duration bars */}
        {durationBars.map((b) => (
          <div key={b.id} className="duration-bar" style={{ left: b.x, top: b.y, height: b.h, background: b.color }} />
        ))}

        {/* event nodes */}
        {inWindow.map(({ e, x, y, w, h }) => {
          const st = shown.find((s) => s.id === e.stream_id);
          const t = pickPair(e, 'title');
          const title = lang === 'zh' ? t.zh || t.en : t.en || t.zh;
          const cls = `event-node mode-${mode} ${selectedEventId === e.id ? 'selected' : ''} ${linkedToSelected.has(e.id) ? 'linked' : ''}`;
          if (mode === 'dot')
            return (
              <div
                key={e.id}
                className={cls}
                title={`${yearLabel(e, 'en')} — ${title}`}
                style={{ left: x, top: y, width: w, height: h, background: st?.color, borderColor: '#fffdf6' }}
                onClick={() => handleEventClick(e.id)}
              />
            );
          return (
            <div key={e.id} className={cls} style={{ left: x, top: y, width: w, height: h }} onClick={() => handleEventClick(e.id)}>
              <span className="bar" style={{ background: st?.color }} />
              {mode === 'mini' && <div className="inner">{title}</div>}
              {mode === 'chip' && (
                <div className="inner">
                  <span className="y">{axisYear(e.year_start, lang === 'zh' ? 'zh' : 'en')}</span>
                  <span className="t" style={lang !== 'en' && t.zh ? { fontFamily: 'var(--serif-zh)' } : {}}>
                    {title}
                  </span>
                </div>
              )}
              {(mode === 'card' || mode === 'full') && (
                <div className="inner">
                  <div className="y">{yearLabel(e, lang === 'zh' ? 'zh' : 'en')}</div>
                  {lang === 'both' ? (
                    <>
                      {t.zh && <div className="t-zh">{t.zh}</div>}
                      {t.en && mode === 'full' && <div className="t-en">{t.en}</div>}
                      {t.en && !t.zh && <div className="t-en">{t.en}</div>}
                    </>
                  ) : (
                    <div className={lang === 'zh' ? 't-zh' : 't-en'} style={{ color: 'var(--ink)' }}>
                      {title}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="zoom-hud">
          <button onClick={() => zoomBy(1 / 1.5)} title="Zoom out (⌘/Ctrl + scroll)">−</button>
          <span className="lvl">{MODE_LABEL[mode]}</span>
          <button onClick={() => zoomBy(1.5)} title="Zoom in (⌘/Ctrl + scroll)">+</button>
          <button onClick={fit} title="Fit whole span" style={{ fontSize: 11 }}>⤢</button>
        </div>
      </div>
    </div>
  );
}
