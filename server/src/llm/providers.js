import { getSetting } from '../db.js';

/**
 * One uniform entry point over three providers.
 * messages: [{ role: 'user'|'assistant', content: string }]
 * Returns the assistant's text.
 */
export async function complete({ system, messages }) {
  const provider = getSetting('provider', 'anthropic');
  if (provider === 'anthropic') return anthropic(system, messages);
  if (provider === 'openai') return openai(system, messages);
  if (provider === 'gemini') return gemini(system, messages);
  throw new Error(`Unknown provider "${provider}". Choose it in Settings.`);
}

function requireKey(name, label) {
  const key = getSetting(name, '');
  if (!key) throw new Error(`No ${label} API key saved. Add one in Settings.`);
  return key;
}

async function anthropic(system, messages) {
  const key = requireKey('anthropic_key', 'Anthropic');
  const model = getSetting('anthropic_model', 'claude-sonnet-4-5');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic API error (${res.status}).`);
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

async function openai(system, messages) {
  const key = requireKey('openai_key', 'OpenAI');
  const model = getSetting('openai_model', 'gpt-4o');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages] })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI API error (${res.status}).`);
  return data.choices?.[0]?.message?.content || '';
}

async function gemini(system, messages) {
  const key = requireKey('gemini_key', 'Gemini');
  const model = getSetting('gemini_model', 'gemini-2.0-flash');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini API error (${res.status}).`);
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
}
