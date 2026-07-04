import { useEffect } from 'react';
import { useStore } from './store';
import TopBar from './components/TopBar';
import ColumnView from './components/ColumnView';
import ExploreView from './components/ExploreView';
import SidePanel from './components/SidePanel';
import EventEditor from './components/EventEditor';
import StreamManager from './components/StreamManager';
import EnrichModal from './components/EnrichModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const view = useStore((s) => s.view);
  const panelTab = useStore((s) => s.panelTab);
  const editingEvent = useStore((s) => s.editingEvent);
  const managingStreams = useStore((s) => s.managingStreams);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const enrichStreamId = useStore((s) => s.enrichStreamId);
  const toast = useStore((s) => s.toast);
  const connectFrom = useStore((s) => s.connectFrom);

  useEffect(() => {
    const s = useStore.getState();
    s.loadStreams();
    s.loadConnections();
    s.loadProposals();
    s.loadSettings();
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        <div className="main-view">
          {view === 'columns' ? <ColumnView /> : <ExploreView />}
          {connectFrom != null && (
            <div className="view-hint">Connect mode · 连线模式 — click a second event, or click the first again to cancel</div>
          )}
        </div>
        {panelTab && <SidePanel />}
      </div>

      {editingEvent && <EventEditor />}
      {managingStreams && <StreamManager />}
      {enrichStreamId != null && <EnrichModal />}
      {settingsOpen && <SettingsModal />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
