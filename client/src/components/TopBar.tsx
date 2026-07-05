import { useState } from 'react';
import { useStore } from '../store';
import { TAGS, TAG_META } from '../types';
import type { Lang, ViewMode } from '../types';
import { api } from '../api';

export default function TopBar() {
  const { lang, view, filters, streams, proposals, panelTab } = useStore();
  const set = useStore((s) => s.set);
  const setFilters = useStore((s) => s.setFilters);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const setLang = (l: Lang) => {
    set({ lang: l });
    api.put('/api/settings', { display_language: l }).catch(() => {});
  };

  const togglePanel = (tab: 'agent' | 'review') => set({ panelTab: panelTab === tab ? null : tab });

  return (
    <>
      <header className="topbar">
        <div className="brand" title="资治通鉴 — 'a comprehensive mirror in aid of governance'">
          <div className="brand-seal">鉴</div>
          <div className="brand-name">
            <div className="zh">通鉴</div>
            <div className="en">Tongjian · History Atlas</div>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="View">
          {(
            [
              ['scroll', '长卷 Scroll'],
              ['columns', '列表 Columns']
            ] as [ViewMode, string][]
          ).map(([v, label]) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => set({ view: v })}>
              {label}
            </button>
          ))}
        </div>

        <input
          className="search"
          placeholder="Search titles & descriptions · 搜索…"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />

        <div className="segmented" aria-label="Language">
          {(
            [
              ['en', 'EN'],
              ['zh', '中'],
              ['both', '双']
            ] as [Lang, string][]
          ).map(([l, label]) => (
            <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>
              {label}
            </button>
          ))}
        </div>

        <button className="btn primary" onClick={() => set({ editingEvent: {} })}>
          + Event
        </button>
        <button className="btn" onClick={() => set({ managingStreams: true })}>
          Streams
        </button>
        <button className={`btn ${panelTab === 'agent' ? 'primary' : ''}`} onClick={() => togglePanel('agent')}>
          Agent
        </button>
        <button className={`btn ${panelTab === 'review' ? 'primary' : ''}`} onClick={() => togglePanel('review')}>
          Review{proposals.length > 0 && <span className="badge">{proposals.length}</span>}
        </button>
        <button className="btn ghost" title="Settings" onClick={() => set({ settingsOpen: true })}>
          ⚙
        </button>
      </header>

      <div className={`filterbar${filtersOpen ? '' : ' collapsed'}`}>
        <button className="filterbar-toggle" onClick={() => setFiltersOpen(!filtersOpen)} title={filtersOpen ? 'Hide filters' : 'Show filters'}>
          {filtersOpen ? '▾' : '▸'} Filters
        </button>
        {filtersOpen && <><span className="label">Tags</span>
        {TAGS.map((t) => {
          const active = filters.tags.includes(t);
          const meta = TAG_META[t];
          return (
            <button
              key={t}
              className={`chip ${active ? 'active' : ''}`}
              onClick={() =>
                setFilters({ tags: active ? filters.tags.filter((x) => x !== t) : [...filters.tags, t] })
              }
            >
              <span className="dot" style={{ background: meta.color }} />
              {lang === 'zh' ? meta.zh : lang === 'en' ? meta.en : `${meta.zh} ${meta.en}`}
            </button>
          );
        })}
        <span className="chip-sep" />
        <span className="label">Streams</span>
        {streams.map((st) => {
          const active = filters.streamIds.length === 0 || filters.streamIds.includes(st.id);
          return (
            <button
              key={st.id}
              className={`chip ${filters.streamIds.includes(st.id) ? 'active' : ''}`}
              style={{ opacity: active ? 1 : 0.55, marginLeft: st.parent_id ? 12 : 0 }}
              onClick={() => {
                const cur = filters.streamIds;
                setFilters({
                  streamIds: cur.includes(st.id) ? cur.filter((x) => x !== st.id) : [...cur, st.id]
                });
              }}
              title="Click to isolate streams; clear all chips to show everything"
            >
              <span className="dot" style={{ background: st.color }} />
              {st.parent_id ? '└ ' : ''}{lang === 'zh' ? st.name_zh || st.name_en : lang === 'en' ? st.name_en || st.name_zh : `${st.name_zh} ${st.name_en}`.trim()}
            </button>
          );
        })}
        {(filters.tags.length > 0 || filters.streamIds.length > 0 || filters.q) && (
          <button className="btn ghost small" onClick={() => setFilters({ tags: [], streamIds: [], q: '' })}>
            Clear · 清除
          </button>
        )}
        </>}
      </div>
    </>
  );
}
