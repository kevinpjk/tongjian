export interface Stream {
  id: number;
  name_en: string;
  name_zh: string;
  color: string;
  description_en: string;
  description_zh: string;
  sort_order: number;
  event_count?: number;
  min_year?: number | null;
  max_year?: number | null;
}

export interface HEvent {
  id: number;
  stream_id: number;
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  year_start: number;
  year_end: number | null;
  tags: string[];
  importance: number;
  source_note: string;
}

export interface HConnection {
  id: number;
  event_a: number;
  event_b: number;
  description_en: string;
  description_zh: string;
  a_stream_id: number;
  a_year: number;
  a_title_en: string;
  a_title_zh: string;
  b_stream_id: number;
  b_year: number;
  b_title_en: string;
  b_title_zh: string;
}

export interface Proposal {
  id: number;
  kind: 'event' | 'connection' | 'edit';
  payload: any;
  status: string;
  origin: string;
  created_at: string;
  a_title?: string;
  b_title?: string;
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  proposals?: number;
}

export interface Settings {
  provider: 'anthropic' | 'openai' | 'gemini';
  anthropic_model: string;
  openai_model: string;
  gemini_model: string;
  anthropic_key: string;
  openai_key: string;
  gemini_key: string;
  display_language: string;
}

export type Lang = 'en' | 'zh' | 'both';
export type ViewMode = 'columns' | 'scroll';

export const TAGS = [
  'politics',
  'war',
  'religion',
  'culture',
  'technology',
  'science',
  'economics',
  'art',
  'exploration',
  'other'
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_META: Record<string, { en: string; zh: string; color: string }> = {
  politics: { en: 'Politics', zh: '政治', color: '#3F5573' },
  war: { en: 'War', zh: '战争', color: '#8A2E20' },
  religion: { en: 'Religion', zh: '宗教', color: '#7B4B63' },
  culture: { en: 'Culture', zh: '文化', color: '#B07A2E' },
  technology: { en: 'Technology', zh: '技术', color: '#56707A' },
  science: { en: 'Science', zh: '科学', color: '#4E7C59' },
  economics: { en: 'Economics', zh: '经济', color: '#8C6D1F' },
  art: { en: 'Art', zh: '艺术', color: '#9C5B33' },
  exploration: { en: 'Exploration', zh: '探索', color: '#2F6B66' },
  other: { en: 'Other', zh: '其他', color: '#6B6152' }
};

export const STREAM_PALETTE = [
  '#A63A2B', // vermilion
  '#3F5573', // indigo
  '#B07A2E', // ochre
  '#4E7C59', // jade
  '#7B4B63', // plum
  '#56707A', // slate
  '#6C6F3F', // moss
  '#7A4A2B' // umber
];
