import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useStore } from '../store';
import { api, pickPair, yearLabel } from '../api';
import { TAG_META, type ChatMsg, type HConnection, type HEvent, type Proposal } from '../types';
import { deleteEvent, handleEventClick } from '../actions';

export default function SidePanel() {
  const panelTab = useStore((s) => s.panelTab);
  const proposals = useStore((s) => s.proposals);
  const set = useStore((s) => s.set);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    dragRef.current = { startX: e.clientX, startW: panel.offsetWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const w = Math.max(280, Math.min(700, dragRef.current.startW - (ev.clientX - dragRef.current.startX)));
      panel.style.width = w + 'px';
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <aside className="panel" ref={panelRef}>
      <div className="panel-resize" onMouseDown={onResizeMouseDown} />
      <div className="panel-tabs">
        <button className={panelTab === 'detail' ? 'active' : ''} onClick={() => set({ panelTab: 'detail' })}>
          Detail
        </button>
        <button className={panelTab === 'agent' ? 'active' : ''} onClick={() => set({ panelTab: 'agent' })}>
          Agent
        </button>
        <button className={panelTab === 'review' ? 'active' : ''} onClick={() => set({ panelTab: 'review' })}>
          Review
          {proposals.length > 0 && <span className="badge">{proposals.length}</span>}
        </button>
        <button className="panel-close" title="Close panel" onClick={() => set({ panelTab: null })}>
          ✕
        </button>
      </div>
      {panelTab === 'detail' && <DetailTab />}
      {panelTab === 'agent' && <AgentTab />}
      {panelTab === 'review' && <ReviewTab />}
    </aside>
  );
}

// ——————————————————————————— Detail ———————————————————————————
function DetailTab() {
  const { events, connections, streams, lang, selectedEventId, selectedConnectionId } = useStore();
  const set = useStore((s) => s.set);
  const selectEvent = useStore((s) => s.selectEvent);
  const selectConnection = useStore((s) => s.selectConnection);

  if (selectedConnectionId != null) {
    const c = connections.find((x) => x.id === selectedConnectionId);
    if (!c) return <div className="panel-body"><div className="empty">Connection not found.</div></div>;
    return <ConnectionDetail c={c} lang={lang} />;
  }

  const e = events.find((x) => x.id === selectedEventId);
  if (!e)
    return (
      <div className="panel-body">
        <div className="empty">Select an event to see its full record, connections, and actions.</div>
      </div>
    );

  const st = streams.find((s) => s.id === e.stream_id);
  const t = pickPair(e, 'title');
  const d = pickPair(e, 'description');
  const related = connections.filter((c) => c.event_a === e.id || c.event_b === e.id);

  return (
    <div className="panel-body">
      {st && (
        <div className="detail-stream">
          <span className="dot" style={{ background: st.color }} />
          {st.name_zh} · {st.name_en}
        </div>
      )}
      <div className="detail-year">{yearLabel(e, lang === 'both' ? 'en' : lang)}</div>
      {lang !== 'en' && t.zh && <div className="detail-title-zh">{t.zh}</div>}
      {lang !== 'zh' && t.en && <div className="detail-title-en">{t.en}</div>}
      {lang === 'zh' && !t.zh && <div className="detail-title-zh">{t.en}</div>}

      <div className="tag-pills">
        {e.tags.map((tag) => (
          <span key={tag} className="tag-pill" style={{ background: TAG_META[tag]?.color || '#777' }}>
            {lang === 'zh' ? TAG_META[tag]?.zh : TAG_META[tag]?.en || tag}
          </span>
        ))}
      </div>

      {lang !== 'en' && d.zh && <p className="detail-desc zh">{d.zh}</p>}
      {lang !== 'zh' && d.en && <p className="detail-desc">{d.en}</p>}
      {lang === 'zh' && !d.zh && d.en && <p className="detail-desc">{d.en}</p>}

      <div className="detail-actions">
        <button className="btn small" onClick={() => set({ editingEvent: e })}>
          Edit
        </button>
        <button
          className="btn small"
          onClick={() => {
            set({ connectFrom: e.id, panelTab: null });
            useStore.getState().showToast('Connect mode · click a second event');
          }}
        >
          Connect ⟡
        </button>
        <button
          className="btn small"
          onClick={() => {
            set({ panelTab: 'agent' });
            const draft = `Tell me more about "${t.en || t.zh}" (${yearLabel(e, 'en')}) and suggest any cross-stream connections.`;
            set({ chatDraft: draft });
          }}
        >
          Ask agent
        </button>
        <button
          className="btn small danger"
          onClick={async () => {
            if (!confirm('Delete this event?')) return;
            await deleteEvent(e.id);
          }}
        >
          Delete
        </button>
      </div>

      <div className="subhead">Connections · 联系 ({related.length})</div>
      {related.length === 0 && <div className="empty">No connections yet. Use Connect ⟡ to link this to an event in another stream.</div>}
      {related.map((c) => {
        const otherId = c.event_a === e.id ? c.event_b : c.event_a;
        const otherTitle =
          c.event_a === e.id ? c.b_title_zh || c.b_title_en : c.a_title_zh || c.a_title_en;
        const cd = pickPair(c, 'description');
        return (
          <div key={c.id} className="conn-item" onClick={() => selectConnection(c.id)}>
            <div className="who">⟡ {otherTitle}</div>
            <div className="what">{lang === 'zh' ? cd.zh || cd.en : cd.en || cd.zh}</div>
            <button
              className="btn ghost small"
              style={{ marginTop: 4 }}
              onClick={(ev) => {
                ev.stopPropagation();
                selectEvent(otherId);
              }}
            >
              Jump to linked event →
            </button>
          </div>
        );
      })}

      {e.source_note && <div className="source-note">Source · 来源: {e.source_note}</div>}
    </div>
  );
}

function ConnectionDetail({ c, lang }: { c: HConnection; lang: 'en' | 'zh' | 'both' }) {
  const set = useStore((s) => s.set);
  const selectEvent = useStore((s) => s.selectEvent);
  const loadConnections = useStore((s) => s.loadConnections);
  const showToast = useStore((s) => s.showToast);
  const enRef = useRef<HTMLTextAreaElement>(null);
  const zhRef = useRef<HTMLTextAreaElement>(null);

  const save = async () => {
    await api.put(`/api/connections/${c.id}`, {
      description_en: enRef.current?.value || '',
      description_zh: zhRef.current?.value || ''
    });
    await loadConnections();
    showToast('Connection saved');
  };
  const remove = async () => {
    if (!confirm('Delete this connection?')) return;
    await api.del(`/api/connections/${c.id}`);
    await loadConnections();
    set({ selectedConnectionId: null, panelTab: 'detail' });
    showToast('Connection deleted');
  };

  return (
    <div className="panel-body">
      <button className="btn ghost small" style={{ marginBottom: 8 }} onClick={() => set({ selectedConnectionId: null })}>
        ← Back
      </button>
      <div className="subhead">Connection · 跨流联系</div>
      <div className="conn-item" style={{ cursor: 'default' }}>
        <div className="who" style={{ cursor: 'pointer' }} onClick={() => selectEvent(c.event_a)}>
          {c.a_title_zh || c.a_title_en} <span style={{ color: 'var(--ink-faint)' }}>({c.a_year < 0 ? `${-c.a_year} BCE` : c.a_year})</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--seal)', margin: '4px 0' }}>⟡</div>
        <div className="who" style={{ cursor: 'pointer' }} onClick={() => selectEvent(c.event_b)}>
          {c.b_title_zh || c.b_title_en} <span style={{ color: 'var(--ink-faint)' }}>({c.b_year < 0 ? `${-c.b_year} BCE` : c.b_year})</span>
        </div>
      </div>

      <div className="field">
        <label>Description (EN)</label>
        <textarea ref={enRef} defaultValue={c.description_en} />
      </div>
      <div className="field">
        <label>说明 (中文)</label>
        <textarea ref={zhRef} defaultValue={c.description_zh} style={{ fontFamily: 'var(--serif-zh)' }} />
      </div>
      <div className="detail-actions">
        <button className="btn primary small" onClick={save}>
          Save
        </button>
        <button className="btn small danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ——————————————————————————— Agent ———————————————————————————
// Lightweight markdown + event chip renderer
function MarkdownContent({ text }: { text: string }) {
  const events = useStore((s) => s.events);

  const rendered = useMemo(() => {
    // Split on event references like "event 66", "event #82", "Event 123"
    const parts = text.split(/(event\s*#?\d+)/gi);
    return parts.map((part, i) => {
      const match = part.match(/^event\s*#?(\d+)$/i);
      if (match) {
        const id = Number(match[1]);
        const ev = events.find((e) => e.id === id);
        return (
          <button key={i} className="event-chip-link" onClick={() => handleEventClick(id)}>
            ◆ {ev ? (ev.title_zh || ev.title_en) : `Event ${id}`}
          </button>
        );
      }
      // Basic markdown: **bold**, *italic*, `code`, newlines
      const html = part
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br/>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  }, [text, events]);

  return <>{rendered}</>;
}

function AgentTab() {
  const { chat, chatBusy, chatDraft, selectedEventId, conversations, activeConversationId } = useStore();
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);
  const loadConversations = useStore((s) => s.loadConversations);
  const msgsRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Load conversations on mount
  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight });
  }, [chat, chatBusy]);

  // Auto-resize textarea whenever chatDraft changes
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [chatDraft]);

  const persistMsg = async (convId: number, role: string, content: string, proposalsCount = 0) => {
    await api.post(`/api/conversations/${convId}/messages`, { role, content, proposals_count: proposalsCount });
  };

  const send = async () => {
    const text = chatDraft.trim();
    if (!text || chatBusy) return;

    let convId = activeConversationId;
    // Auto-create conversation on first message
    if (!convId) {
      const conv = await api.post<{ id: number }>('/api/conversations', {});
      convId = conv.id;
      set({ activeConversationId: convId });
    }

    const history: ChatMsg[] = [...chat, { role: 'user', content: text }];
    set({ chat: history, chatDraft: '', chatBusy: true });

    // Persist user message
    await persistMsg(convId, 'user', text);

    try {
      const out = await api.post<{ reply: string; proposals: any[] }>('/api/llm/chat', {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        context_event_ids: selectedEventId ? [selectedEventId] : []
      });
      const assistantMsg: ChatMsg = { role: 'assistant', content: out.reply, proposals: out.proposals.length };
      set({ chat: [...history, assistantMsg], chatBusy: false });

      // Persist assistant message
      await persistMsg(convId, 'assistant', out.reply, out.proposals.length);
      await loadConversations();

      if (out.proposals.length) {
        await useStore.getState().loadProposals();
        showToast(`${out.proposals.length} proposal(s) added to Review`);
      }
    } catch (err: any) {
      const errMsg = `⚠ ${err.message}`;
      set({ chat: [...history, { role: 'assistant', content: errMsg }], chatBusy: false });
      await persistMsg(convId, 'assistant', errMsg);
    }
  };

  const startNew = () => {
    set({ chat: [], activeConversationId: null, chatDraft: '' });
    setShowHistory(false);
  };

  const loadConversation = async (id: number) => {
    const data = await api.get<{ id: number; title: string; messages: Array<{ role: 'user' | 'assistant'; content: string; proposals_count: number }> }>(
      `/api/conversations/${id}`
    );
    set({
      activeConversationId: id,
      chat: data.messages.map((m) => ({ role: m.role, content: m.content, proposals: m.proposals_count || undefined }))
    });
    setShowHistory(false);
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await api.del(`/api/conversations/${id}`);
    if (activeConversationId === id) startNew();
    await loadConversations();
  };

  // Conversation history view
  if (showHistory) {
    return (
      <div className="agent">
        <div className="conv-header">
          <button className="btn small" onClick={() => setShowHistory(false)}>← Back</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>Conversations · 对话历史</span>
          <button className="btn primary small" onClick={startNew}>+ New</button>
        </div>
        <div className="agent-msgs">
          {conversations.length === 0 && <div className="empty">No conversations yet.</div>}
          {conversations.map((c) => (
            <div key={c.id} className={`conv-item${c.id === activeConversationId ? ' active' : ''}`} onClick={() => loadConversation(c.id)}>
              <div className="conv-title">{c.title || 'Untitled conversation'}</div>
              <div className="conv-meta">
                {c.message_count} messages · {new Date(c.updated_at).toLocaleDateString()}
                <button className="conv-del" onClick={(e) => deleteConversation(c.id, e)} title="Delete">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="agent">
      <div className="conv-header">
        <button className="btn ghost small" onClick={() => { loadConversations(); setShowHistory(true); }}>
          ☰ History
        </button>
        <span className="conv-active-title">{activeConv?.title || 'New conversation'}</span>
        <button className="btn ghost small" onClick={startNew} title="Start new conversation">+ New</button>
      </div>
      <div className="agent-msgs" ref={msgsRef}>
        {chat.length === 0 && (
          <div className="empty">
            Ask the research agent to compare civilizations, explain events, or propose additions.
            <br />
            <br />
            Anything it proposes lands in <b>Review</b> for your approval — nothing is added automatically.
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'assistant' ? <MarkdownContent text={m.content} /> : m.content}
            {!!m.proposals && (
              <span className="prop-note" onClick={() => set({ panelTab: 'review' })}>
                ✦ {m.proposals} proposal(s) → open Review
              </span>
            )}
          </div>
        ))}
        {chatBusy && (
          <div className="thinking">
            <span className="dot-pulse" />
            Researching · 检索中…
          </div>
        )}
      </div>
      <div className="agent-input">
        <textarea
          ref={taRef}
          value={chatDraft}
          placeholder="e.g. What was happening in Rome when the Han fell?"
          rows={1}
          onChange={(e) => set({ chatDraft: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn primary" onClick={send} disabled={chatBusy}>
          Send
        </button>
      </div>
    </div>
  );
}

// ——————————————————————————— Review ———————————————————————————
function ReviewTab() {
  const { proposals, streams, events, lang } = useStore();
  const showToast = useStore((s) => s.showToast);

  const refreshAll = async () => {
    const s = useStore.getState();
    await Promise.all([s.loadProposals(), s.loadConnections(), s.loadStreams()]);
  };

  const approve = async (p: Proposal) => {
    await api.post(`/api/proposals/${p.id}/approve`);
    await refreshAll();
    showToast('Approved · 已采纳');
  };
  const reject = async (p: Proposal) => {
    await api.post(`/api/proposals/${p.id}/reject`);
    await useStore.getState().loadProposals();
    showToast('Rejected');
  };
  const approveAll = async () => {
    const r = await api.post<{ approved: number }>('/api/proposals/approve-all');
    await refreshAll();
    showToast(`Approved ${r.approved} proposal(s)`);
  };
  const rejectAll = async () => {
    if (!confirm(`Reject all ${proposals.length} pending proposal(s)?`)) return;
    for (const p of proposals) {
      await api.post(`/api/proposals/${p.id}/reject`);
    }
    await useStore.getState().loadProposals();
    showToast('All proposals rejected');
  };

  if (proposals.length === 0)
    return (
      <div className="panel-body">
        <div className="empty">
          No pending proposals. Ask the Agent a research question, or use ✦ Enrich on any stream to generate
          candidate events for your approval.
        </div>
      </div>
    );

  const streamName = (id: number) => {
    const s = streams.find((x) => x.id === id);
    return s ? `${s.name_zh} ${s.name_en}` : `stream ${id}`;
  };
  const eventTitle = (id: number) => {
    const e = events.find((x) => x.id === id);
    return e ? e.title_zh || e.title_en : `event ${id}`;
  };

  return (
    <div className="panel-body">
      <div className="review-all">
        <button className="btn primary small" onClick={approveAll}>
          Approve all ({proposals.length})
        </button>
        <button className="btn small danger" onClick={rejectAll}>
          Reject all
        </button>
      </div>
      {proposals.map((p) => {
        const pl = p.payload;
        return (
          <div key={p.id} className="proposal">
            <div className="head">
              <span>{p.kind === 'event' ? '✦ Event' : p.kind === 'edit' ? '✎ Edit' : p.kind === 'stream' ? '⊕ Stream' : '⟡ Connection'}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>{p.origin}</span>
            </div>
            <div className="body">
              {p.kind === 'event' ? (
                <>
                  <div className="event-year">
                    {pl.year_start < 0 ? `${-pl.year_start} BCE` : `${pl.year_start} CE`}
                    {pl.year_end != null && ` – ${pl.year_end < 0 ? `${-pl.year_end} BCE` : `${pl.year_end} CE`}`}
                  </div>
                  {pl.title_zh && <div className="event-title-zh">{pl.title_zh}</div>}
                  {pl.title_en && <div className="event-title-en">{pl.title_en}</div>}
                  <div className="detail-stream" style={{ marginTop: 4 }}>
                    {streamName(pl.stream_id)}
                  </div>
                  <p style={{ fontSize: 13, margin: '6px 0 0' }}>
                    {lang === 'zh' ? pl.description_zh || pl.description_en : pl.description_en || pl.description_zh}
                  </p>
                  <div className="tag-pills">
                    {(pl.tags || []).map((t: string) => (
                      <span key={t} className="tag-pill" style={{ background: TAG_META[t]?.color || '#777' }}>
                        {TAG_META[t]?.en || t}
                      </span>
                    ))}
                  </div>
                  {pl.source_note && <div className="source-note">{pl.source_note}</div>}
                </>
              ) : p.kind === 'edit' ? (
                <>
                  <div className="event-title-en" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    Editing: {eventTitle(pl.event_id)}
                  </div>
                  {pl.title_zh && <div className="event-title-zh">{pl.title_zh}</div>}
                  {pl.title_en && <div className="event-title-en">{pl.title_en}</div>}
                  {pl.year_start != null && (
                    <div className="event-year">
                      {pl.year_start < 0 ? `${-pl.year_start} BCE` : `${pl.year_start} CE`}
                      {pl.year_end != null && ` – ${pl.year_end < 0 ? `${-pl.year_end} BCE` : `${pl.year_end} CE`}`}
                    </div>
                  )}
                  <p style={{ fontSize: 13, margin: '6px 0 0' }}>
                    {lang === 'zh' ? pl.description_zh || pl.description_en : pl.description_en || pl.description_zh}
                  </p>
                  {pl.tags && (
                    <div className="tag-pills">
                      {pl.tags.map((t: string) => (
                        <span key={t} className="tag-pill" style={{ background: TAG_META[t]?.color || '#777' }}>
                          {TAG_META[t]?.en || t}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : p.kind === 'stream' ? (
                <>
                  {pl.name_zh && <div className="event-title-zh">{pl.name_zh}</div>}
                  {pl.name_en && <div className="event-title-en">{pl.name_en}</div>}
                  {(pl.year_active_start != null || pl.year_active_end != null) && (
                    <div className="event-year">{pl.year_active_start ?? '?'} – {pl.year_active_end ?? '?'}</div>
                  )}
                  <p style={{ fontSize: 13, margin: '6px 0 0' }}>
                    {lang === 'zh' ? pl.description_zh || pl.description_en : pl.description_en || pl.description_zh}
                  </p>
                </>
              ) : (
                <>
                  <div className="who" style={{ fontSize: 13 }}>
                    {eventTitle(pl.event_a)} ⟡ {eventTitle(pl.event_b)}
                  </div>
                  <p style={{ fontSize: 13, margin: '6px 0 0' }}>
                    {lang === 'zh' ? pl.description_zh || pl.description_en : pl.description_en || pl.description_zh}
                  </p>
                </>
              )}
            </div>
            <div className="foot">
              <button className="btn primary small" onClick={() => approve(p)}>
                Approve
              </button>
              <button className="btn small" onClick={() => reject(p)}>
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
