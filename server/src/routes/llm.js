import { Router } from 'express';
import { runChat, runEnrich, runDescribeConnection } from '../llm/agent.js';

export const llmRouter = Router();

llmRouter.post('/chat', async (req, res) => {
  try {
    const { messages = [], context_event_ids = [] } = req.body || {};
    if (!messages.length) return res.status(400).json({ error: 'messages is required.' });
    const out = await runChat({ messages, context_event_ids });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

llmRouter.post('/enrich', async (req, res) => {
  try {
    const out = await runEnrich(req.body || {});
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

llmRouter.post('/describe-connection', async (req, res) => {
  try {
    const { connection_id } = req.body || {};
    if (!connection_id) return res.status(400).json({ error: 'connection_id is required.' });
    const out = await runDescribeConnection(connection_id);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
