import { Fragment, useEffect, useMemo } from 'react';
import { useStore, visibleStreams } from '../store';
import { api, axisYear, formatYear, pickPair, yearLabel } from '../api';
import { TAG_META, type HEvent, type Stream } from '../types';
import { handleEventClick } from '../actions';

const PAGE = 3000;

export default function ColumnView() {
  const { streams, filters, events, lang, selectedEventId, connections } = useStore();
  const set = useStore((s) => s.set);

  useEffect(() => {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (filters.q) params.set('q', filters.q);
    if (filters.tags.length) params.set('tags', filters.tags.join(','));
    if (filters.streamIds.length) params.set('streams', filters.streamIds.join(','));
    const t = setTimeout(() => {
      api.get<HEvent[]>(`/api/events?${params}`).then((evs) => set({ events: evs }));
    }, 200);
    return () => clearTimeout(t);
  }, [filters.q, filters.tags.join(','), filters.streamIds.join(',')]);

  const shown = visibleStreams({ streams, filters });
  const byStream = useMemo(() => {
    const m = new Map<number, HEvent[]>();
    for (const e of events) {
      if (!m.has(e.stream_id)) m.set(e.stream_id, []);
      m.get(e.stream_id)!.push(e);
    }
    return m;
  }, [events]);

  const connectedIds = useMemo(() => {
    const s = new Set<number>();
    for (const c of connections) {
      s.add(c.event_a);
      s.add(c.event_b);
    }
    return s;
  }, [connections]);

  const linkedToSelected = useMemo(() => {
    const s = new Set<number>();
    if (selectedEventId == null) return s;
    for (const c of connections) {
      if (c.event_a === selectedEventId) s.add(c.event_b);
      if (c.event_b === selectedEventId) s.add(c.event_a);
    }
    return s;
  }, [connections, selectedEventId]);

  if (!streams.length)
    return <div className="empty" style={{ marginTop: 60 }}>No streams yet — create one from the Streams button, or run <code>npm run seed</code>.</div>;

  return (
    <div className="columns">
      {shown.map((st) => (
        <Column
          key={st.id}
          stream={st}
          events={byStream.get(st.id) || []}
          lang={lang}
          selectedEventId={selectedEventId}
          connectedIds={connectedIds}
          linkedToSelected={linkedToSelected}
          onEnrich={() => set({ enrichStreamId: st.id })}
        />
      ))}
    </div>
  );
}

function centuryOf(y: number) {
  return Math.floor(y / 100) * 100;
}

function Column(props: {
  stream: Stream;
  events: HEvent[];
  lang: 'en' | 'zh' | 'both';
  selectedEventId: number | null;
  connectedIds: Set<number>;
  linkedToSelected: Set<number>;
  onEnrich: () => void;
}) {
  const { stream: st, events, lang } = props;
  let lastCentury: number | null = null;
  return (
    <section className="col">
      <div className="col-header">
        <span className="accent" style={{ background: st.color }} />
        {lang !== 'en' && st.name_zh && <div className="col-title-zh">{st.name_zh}</div>}
        {lang !== 'zh' && <div className="col-title-en">{st.name_en}</div>}
        {lang === 'zh' && !st.name_zh && <div className="col-title-zh">{st.name_en}</div>}
        <div className="col-meta">
          <span>{events.length} events</span>
          {st.min_year != null && st.max_year != null && (
            <span>
              {formatYear(st.min_year, lang === 'both' ? 'en' : lang)} → {formatYear(st.max_year, lang === 'both' ? 'en' : lang)}
            </span>
          )}
          <button className="btn small" style={{ marginLeft: 'auto' }} onClick={props.onEnrich}>
            ✦ Enrich
          </button>
        </div>
      </div>
      <div className="col-body">
        {events.length === 0 && <div className="empty">Empty — try ✦ Enrich to have the agent propose events.</div>}
        {events.map((e) => {
          const c = centuryOf(e.year_start);
          const divider = c !== lastCentury;
          lastCentury = c;
          const t = pickPair(e, 'title');
          return (
            <Fragment key={e.id}>
              {divider && <div className="era-divider">{axisYear(c, lang === 'zh' ? 'zh' : 'en')}</div>}
              <div
                className={`event-row ${props.selectedEventId === e.id ? 'selected' : ''} ${props.linkedToSelected.has(e.id) ? 'linked' : ''}`}
                onClick={() => handleEventClick(e.id)}
              >
                {props.connectedIds.has(e.id) && <span className="conn-mark" title="Has cross-stream connections">⟡</span>}
                <div className="event-year">{yearLabel(e, lang === 'both' ? 'en' : lang)}</div>
                {lang === 'both' ? (
                  <>
                    {t.zh && <div className="event-title-zh">{t.zh}</div>}
                    {t.en && <div className="event-title-en">{t.en}</div>}
                  </>
                ) : (
                  <div className="event-title-single" style={lang === 'zh' ? { fontFamily: 'var(--serif-zh)' } : {}}>
                    {lang === 'zh' ? t.zh || t.en : t.en || t.zh}
                  </div>
                )}
                <div className="tag-dots">
                  {e.tags.map((tag) => (
                    <span key={tag} className="dot" title={TAG_META[tag]?.en} style={{ background: TAG_META[tag]?.color || '#999' }} />
                  ))}
                  <span className="imp">{'●'.repeat(e.importance)}{'○'.repeat(5 - e.importance)}</span>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
