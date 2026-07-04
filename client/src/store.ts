import { create } from 'zustand';
import { api } from './api';
import type { ChatMsg, HConnection, HEvent, Lang, Proposal, Settings, Stream, ViewMode } from './types';

export interface Filters {
  tags: string[];
  q: string;
  streamIds: number[]; // empty = all streams
}

export type PanelTab = 'detail' | 'agent' | 'review';

interface AppState {
  streams: Stream[];
  events: HEvent[]; // current working set (depends on view/filters/viewport)
  connections: HConnection[];
  proposals: Proposal[];

  lang: Lang;
  view: ViewMode;
  filters: Filters;
  zoom: number; // px per year in the scroll view

  panelTab: PanelTab | null;
  selectedEventId: number | null;
  selectedConnectionId: number | null;
  connectFrom: number | null; // event id awaiting a second click

  editingEvent: Partial<HEvent> | null;
  managingStreams: boolean;
  settingsOpen: boolean;
  enrichStreamId: number | null;

  chat: ChatMsg[];
  chatBusy: boolean;
  chatDraft: string;

  settings: Settings | null;
  toast: string | null;

  // actions
  loadStreams: () => Promise<void>;
  loadConnections: () => Promise<void>;
  loadProposals: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setEvents: (events: HEvent[]) => void;
  set: (partial: Partial<AppState>) => void;
  setFilters: (f: Partial<Filters>) => void;
  selectEvent: (id: number | null) => void;
  selectConnection: (id: number | null) => void;
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<AppState>((setState, getState) => ({
  streams: [],
  events: [],
  connections: [],
  proposals: [],

  lang: 'both',
  view: 'scroll',
  filters: { tags: [], q: '', streamIds: [] },
  zoom: 0.5,

  panelTab: null,
  selectedEventId: null,
  selectedConnectionId: null,
  connectFrom: null,

  editingEvent: null,
  managingStreams: false,
  settingsOpen: false,
  enrichStreamId: null,

  chat: [],
  chatBusy: false,
  chatDraft: '',

  settings: null,
  toast: null,

  loadStreams: async () => setState({ streams: await api.get<Stream[]>('/api/streams') }),
  loadConnections: async () => setState({ connections: await api.get<HConnection[]>('/api/connections') }),
  loadProposals: async () => setState({ proposals: await api.get<Proposal[]>('/api/proposals?status=pending') }),
  loadSettings: async () => {
    const s = await api.get<Settings>('/api/settings');
    setState({ settings: s, lang: (s.display_language as Lang) || 'both' });
  },

  setEvents: (events) => setState({ events }),
  set: (partial) => setState(partial),
  setFilters: (f) => setState({ filters: { ...getState().filters, ...f } }),

  selectEvent: (id) =>
    setState({
      selectedEventId: id,
      selectedConnectionId: null,
      panelTab: id != null ? 'detail' : getState().panelTab
    }),
  selectConnection: (id) =>
    setState({
      selectedConnectionId: id,
      selectedEventId: null,
      panelTab: id != null ? 'detail' : getState().panelTab
    }),

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    setState({ toast: msg });
    toastTimer = setTimeout(() => setState({ toast: null }), 3200);
  }
}));

export const visibleStreams = (s: { streams: Stream[]; filters: Filters }) =>
  s.filters.streamIds.length ? s.streams.filter((st) => s.filters.streamIds.includes(st.id)) : s.streams;
