import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';

export const settingsRouter = Router();

const KEY_FIELDS = ['anthropic_key', 'openai_key', 'gemini_key'];
const PLAIN_FIELDS = ['provider', 'anthropic_model', 'openai_model', 'gemini_model', 'display_language'];

const DEFAULTS = {
  provider: 'anthropic',
  anthropic_model: 'claude-sonnet-4-5',
  openai_model: 'gpt-4o',
  gemini_model: 'gemini-2.0-flash',
  display_language: 'both'
};

function mask(v) {
  if (!v) return '';
  return v.length <= 6 ? '••••' : `••••${v.slice(-4)}`;
}

settingsRouter.get('/', (_req, res) => {
  const out = {};
  for (const f of PLAIN_FIELDS) out[f] = getSetting(f, DEFAULTS[f] || '');
  for (const f of KEY_FIELDS) out[f] = mask(getSetting(f, ''));
  res.json(out);
});

settingsRouter.put('/', (req, res) => {
  const body = req.body || {};
  for (const f of PLAIN_FIELDS) {
    if (body[f] !== undefined) setSetting(f, body[f]);
  }
  for (const f of KEY_FIELDS) {
    // Ignore masked placeholders so re-saving the form doesn't wipe keys.
    if (body[f] !== undefined && !String(body[f]).startsWith('••••')) setSetting(f, body[f]);
  }
  res.json({ ok: true });
});
