import type { Bank, QType, Question, Section } from './types';

export const SECTION_LABEL: Record<Section, string> = {
  core: 'Ôn chính',
  extra: 'Luyện thêm',
};

export const SECTION_DESC: Record<Section, string> = {
  core: 'Đề cương, lý thuyết, công thức và 12 bài tập trong bộ tài liệu của bạn.',
  extra: 'Câu hỏi công khai từ khóa học Studocu, dùng để luyện thêm.',
};

export const TYPE_LABEL: Record<QType, string> = {
  truefalse: 'Đúng / Sai',
  mcq: 'Trắc nghiệm',
  essay: 'Tự luận',
  exercise: 'Bài tập',
  flashcard: 'Thẻ ghi nhớ',
};

export const TYPE_ORDER: QType[] = ['truefalse', 'mcq', 'essay', 'exercise', 'flashcard'];

export function chapterLabel(chapter: number | null): string {
  return chapter ? `Chương ${chapter}` : 'Khác';
}

export async function loadBank(): Promise<Bank> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/questions.json`);
  if (!res.ok) throw new Error(`Không tải được dữ liệu (${res.status})`);
  return (await res.json()) as Bank;
}

export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function prepareQuestion(q: Question, shuffleOptions: boolean): Question {
  if (!shuffleOptions || q.options.length < 3 || !q.answer) return q;
  const correct = q.options.find((o) => o.id === q.answer);
  if (!correct) return q;
  const shuffled = shuffle(q.options).map((o, i) => ({ ...o, id: 'ABCD'[i] }));
  return {
    ...q,
    options: shuffled,
    answer: shuffled.find((o) => o.text === correct.text)?.id ?? q.answer,
  };
}

export function isAuto(q: Question): boolean {
  return q.type === 'mcq' || q.type === 'truefalse';
}

export function isCorrect(q: Question, answer: string | undefined): boolean {
  return !!q.answer && answer === q.answer;
}

export function countsFor(bank: Bank, section: Section): Partial<Record<QType, number>> {
  return bank.meta.counts[section] || {};
}

export function chapterList(bank: Bank, section: Section): number[] {
  return [...new Set(bank.questions.filter((q) => q.section === section && q.chapter).map((q) => q.chapter as number))].sort(
    (a, b) => a - b
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
