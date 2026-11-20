export type Section = 'core' | 'extra';
export type QType = 'truefalse' | 'mcq' | 'essay' | 'exercise' | 'flashcard';

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  section: Section;
  type: QType;
  chapter: number | null;
  topic: string;
  source: string;
  sourceUrl?: string;
  question: string;
  options: Option[];
  answer: string | null;
  explanation?: string;
  modelAnswer?: string;
  tags?: string[];
}

export interface BankMeta {
  builtAt: string;
  total: number;
  counts: Record<Section, Partial<Record<QType, number>>>;
  sources: number;
}

export interface Bank {
  meta: BankMeta;
  questions: Question[];
}

export interface SetupConfig {
  types: QType[];
  chapter: number | 'all';
  count: number;
  mode: 'practice' | 'exam';
  shuffleOptions: boolean;
}

export interface SessionState {
  items: Question[];
  answers: Record<string, string>;
  flags: Record<string, boolean>;
  index: number;
  mode: 'practice' | 'exam';
  startedAt: number;
}

export interface HistoryEntry {
  date: string;
  section: Section;
  total: number;
  autoTotal: number;
  correct: number;
}
