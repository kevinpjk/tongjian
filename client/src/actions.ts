import { api } from './api';
import { useStore } from './store';

/** Click handler shared by both views: either select the event or, in
 *  connect mode, create a connection to the previously chosen event. */
export async function handleEventClick(id: number) {
  const s = useStore.getState();
  if (s.connectFrom && s.connectFrom !== id) {
    try {
      const conn = await api.post<{ id: number }>('/api/connections', { event_a: s.connectFrom, event_b: id });
      await s.loadConnections();
      s.set({ connectFrom: null });
      s.selectEvent(id);
      s.showToast('Connected · 已连接 — generating description…');
      // Fire agent description generation in the background
      api.post('/api/llm/describe-connection', { connection_id: conn.id })
        .then(() => s.loadConnections())
        .then(() => s.showToast('Connection description generated'))
        .catch(() => s.showToast('Connection created (description generation failed — add one manually)'));
    } catch (err: any) {
      s.set({ connectFrom: null });
      s.showToast(err.message);
    }
    return;
  }
  if (s.connectFrom === id) {
    s.set({ connectFrom: null });
    s.showToast('Connect cancelled');
    return;
  }
  s.selectEvent(id);
}

export async function deleteEvent(id: number) {
  const s = useStore.getState();
  await api.del(`/api/events/${id}`);
  s.set({ events: s.events.filter((e) => e.id !== id), selectedEventId: null });
  await Promise.all([s.loadConnections(), s.loadStreams()]);
  s.showToast('Event deleted');
}
