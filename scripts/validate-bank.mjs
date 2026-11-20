import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bank = JSON.parse(readFileSync(join(root, 'data', 'questions.json'), 'utf8'));

const problems = [];
const ids = new Set();
for (const q of bank.questions) {
  if (!q.id || ids.has(q.id)) problems.push(`id trùng/thiếu: ${q.id}`);
  ids.add(q.id);
  if (!q.question || !q.question.trim()) problems.push(`${q.id}: thiếu nội dung câu hỏi`);
  if (!['core', 'extra'].includes(q.section)) problems.push(`${q.id}: section sai`);
  if (!['truefalse', 'mcq', 'essay', 'exercise', 'flashcard'].includes(q.type))
    problems.push(`${q.id}: type sai`);
  if ((q.type === 'mcq' || q.type === 'truefalse') && !q.options?.length)
    problems.push(`${q.id}: thiếu lựa chọn`);
  if (q.type === 'mcq' || q.type === 'truefalse') {
    if (!q.answer) problems.push(`${q.id}: thiếu đáp án`);
    else if (!q.options.some((o) => o.id === q.answer))
      problems.push(`${q.id}: đáp án ${q.answer} không nằm trong lựa chọn`);
    if (q.options.length < 2) problems.push(`${q.id}: ít hơn 2 lựa chọn`);
  }
  if ((q.type === 'essay' || q.type === 'exercise') && !q.modelAnswer)
    problems.push(`${q.id}: thiếu đáp án mẫu/lời giải`);
  if (q.type === 'flashcard' && !q.modelAnswer) problems.push(`${q.id}: thẻ thiếu định nghĩa`);
}

console.log('Tổng:', bank.questions.length);
for (const section of ['core', 'extra']) {
  const list = bank.questions.filter((q) => q.section === section);
  console.log(`- ${section}: ${list.length}`);
  for (const [type, count] of Object.entries(
    list.reduce((acc, q) => ({ ...acc, [q.type]: (acc[q.type] || 0) + 1 }), {})
  ))
    console.log(`    ${type}: ${count}`);
}

if (problems.length) {
  console.error(`\n${problems.length} lỗi:`);
  for (const p of problems.slice(0, 50)) console.error('  -', p);
  process.exitCode = 1;
} else {
  console.log('\nDữ liệu hợp lệ.');
}
