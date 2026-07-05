import { Router } from 'express';
import { db } from '../db.js';

export const conversationsRouter = Router();

// List all conversations (most recent first)
conversationsRouter.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
     FROM conversations c ORDER BY c.updated_at DESC`
  ).all();
  res.json(rows);
});

// Get a single conversation with all its messages
conversationsRouter.get('/:id', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id'
  ).all(conv.id);
  res.json({ ...conv, messages });
});

// Create a new conversation
conversationsRouter.post('/', (req, res) => {
  const { title = '' } = req.body || {};
  const info = db.prepare('INSERT INTO conversations (title) VALUES (?)').run(title);
  res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid));
});

// Update conversation title
conversationsRouter.put('/:id', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
  const { title } = req.body || {};
  if (title !== undefined) {
    db.prepare('UPDATE conversations SET title = ?, updated_at = datetime(\'now\') WHERE id = ?').run(title, conv.id);
  }
  res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(conv.id));
});

// Delete a conversation and all its messages
conversationsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Add a message to a conversation
conversationsRouter.post('/:id/messages', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
  const { role, content, proposals_count = 0 } = req.body || {};
  if (!role || !content) return res.status(400).json({ error: 'role and content required.' });
  const info = db.prepare(
    'INSERT INTO messages (conversation_id, role, content, proposals_count) VALUES (?,?,?,?)'
  ).run(conv.id, role, content, proposals_count);
  // Touch updated_at on conversation
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);
  // Auto-title: if this is the first user message and title is empty, set title from content
  if (!conv.title && role === 'user') {
    const title = content.slice(0, 80) + (content.length > 80 ? '…' : '');
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conv.id);
  }
  res.json(db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid));
});
