import type { HEvent, Lang } from './types';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path)
};

// ——— Bilingual helpers ———

/** Pick a field in the display language, falling back to the other language. */
export function pick(obj: any, field: string, lang: Lang): string {
  const en = obj?.[`${field}_en`] || '';
  const zh = obj?.[`${field}_zh`] || '';
  if (lang === 'zh') return zh || en;
  if (lang === 'en') return en || zh;
  if (en && zh) return `${zh} · ${en}`;
  return en || zh;
}

/** Both-language variant that returns the two parts separately (for stacked display). */
export function pickPair(obj: any, field: string): { zh: string; en: string } {
  return { zh: obj?.[`${field}_zh`] || '', en: obj?.[`${field}_en`] || '' };
}

export function formatYear(y: number, lang: Lang): string {
  if (lang === 'zh') return y < 0 ? `公元前${-y}年` : `公元${y}年`;
  return y < 0 ? `${-y} BCE` : `${y} CE`;
}

export function yearLabel(e: Pick<HEvent, 'year_start' | 'year_end'>, lang: Lang): string {
  const a = formatYear(e.year_start, lang);
  if (e.year_end == null || e.year_end === e.year_start) return a;
  return `${a} – ${formatYear(e.year_end, lang)}`;
}

/** Compact axis label: "500 BCE" / "前500". */
export function axisYear(y: number, lang: Lang): string {
  if (lang === 'zh') return y < 0 ? `前${-y}` : `${y}`;
  return y < 0 ? `${-y} BCE` : `${y}`;
}
