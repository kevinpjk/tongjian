import { useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import type { Settings } from '../types';

const PROVIDERS: { id: Settings['provider']; label: string; keyField: keyof Settings; modelField: keyof Settings }[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', keyField: 'anthropic_key', modelField: 'anthropic_model' },
  { id: 'openai', label: 'OpenAI (GPT)', keyField: 'openai_key', modelField: 'openai_model' },
  { id: 'gemini', label: 'Google (Gemini)', keyField: 'gemini_key', modelField: 'gemini_model' }
];

export default function SettingsModal() {
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);

  const [form, setForm] = useState<Settings>(
    settings ?? {
      provider: 'anthropic',
      anthropic_model: 'claude-sonnet-4-5',
      openai_model: 'gpt-4o',
      gemini_model: 'gemini-2.0-flash',
      anthropic_key: '',
      openai_key: '',
      gemini_key: '',
      display_language: 'both'
    }
  );
  const upd = (patch: Partial<Settings>) => setForm((f) => ({ ...f, ...patch }));
  const close = () => set({ settingsOpen: false });

  const save = async () => {
    await api.put('/api/settings', form);
    await useStore.getState().loadSettings();
    showToast('Settings saved · 已保存');
    close();
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings · 设置</h2>
          <button className="panel-close" onClick={close}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Active provider · 使用的模型</label>
            <div className="swatches" style={{ flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={`chip ${form.provider === p.id ? 'active' : ''}`}
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => upd({ provider: p.id })}
                >
                  {form.provider === p.id ? '●' : '○'} {p.label}
                </button>
              ))}
            </div>
          </div>

          {PROVIDERS.map((p) => (
            <div key={p.id} style={{ opacity: form.provider === p.id ? 1 : 0.6 }}>
              <div className="subhead">{p.label}</div>
              <div className="field">
                <label>Model</label>
                <input
                  type="text"
                  value={form[p.modelField] as string}
                  onChange={(e) => upd({ [p.modelField]: e.target.value } as Partial<Settings>)}
                />
              </div>
              <div className="field">
                <label>API key</label>
                <input
                  type="password"
                  value={form[p.keyField] as string}
                  placeholder="sk-…"
                  onChange={(e) => upd({ [p.keyField]: e.target.value } as Partial<Settings>)}
                />
                <div className="hint">
                  Stored locally in your SQLite database, sent only to {p.label.split(' ')[0]}. Leave the masked
                  value (••••) untouched to keep the saved key.
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
