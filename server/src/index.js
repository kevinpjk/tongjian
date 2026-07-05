import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import './db.js';
import { streamsRouter } from './routes/streams.js';
import { eventsRouter } from './routes/events.js';
import { connectionsRouter } from './routes/connections.js';
import { proposalsRouter } from './routes/proposals.js';
import { settingsRouter } from './routes/settings.js';
import { llmRouter } from './routes/llm.js';
import { conversationsRouter } from './routes/conversations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '4mb' }));

app.use('/api/streams', streamsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/proposals', proposalsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/llm', llmRouter);
app.use('/api/conversations', conversationsRouter);

// In production (`npm run build && npm start`), serve the built client.
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Tongjian server listening on http://localhost:${PORT}`);
});
