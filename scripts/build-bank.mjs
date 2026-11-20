import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const parent = resolve(root, '..');

const read = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const strip = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, x) => tex(x))
    .replace(/\$([^$]+)\$/g, (_, x) => tex(x))
    .replace(/^>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

function tex(x) {
  return x
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\approx/g, '≈')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\%/g, '%')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ');
}

function cleanBlock(s) {
  return s
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, x) => tex(x))
    .replace(/\$([^$]+)\$/g, (_, x) => tex(x))
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const CHAPTER_KEYWORDS = [
  [1, ['đối tượng nghiên cứu', 'quy luật kinh tế', 'chính sách kinh tế', 'phương pháp nghiên cứu', 'kinh tế chính trị']],
  [2, ['hàng hóa', 'giá trị sử dụng', 'tiền tệ', 'thị trường', 'cung cầu', 'dịch vụ', 'chứng khoán', 'đất đai', 'năng suất lao động', 'cường độ lao động', 'lao động cụ thể', 'lao động trừu tượng', 'trao đổi']],
  [3, ['giá trị thặng dư', 'tư bản bất biến', 'tư bản khả biến', 'tích lũy', 'chu chuyển', 'lợi nhuận', 'tỷ suất', 'tiền công', 'sức lao động', 'cấu tạo hữu cơ', 'tuần hoàn', 'lợi tức', 'giá cả sản xuất', 'chi phí sản xuất', 'tư bản cố định', 'tư bản lưu động']],
  [4, ['độc quyền', 'tư bản tài chính', 'xuất khẩu tư bản', 'lênin', 'đế quốc', 'tài phiệt']],
  [5, ['định hướng xã hội chủ nghĩa', 'định hướng xhcn', 'thành phần kinh tế', 'sở hữu toàn dân', 'kinh tế nhà nước']],
  [6, ['công nghiệp hóa', 'hiện đại hóa', 'cách mạng công nghiệp', 'cnh', 'hđh']],
];

function chapterOf(text, fallback = null) {
  const t = (text || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [ch, words] of CHAPTER_KEYWORDS) {
    let score = 0;
    for (const w of words) if (t.includes(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return bestScore > 0 ? best : fallback;
}

const TYPE_LABEL = {
  truefalse: 'Đúng/Sai',
  mcq: 'Trắc nghiệm',
  essay: 'Tự luận',
  exercise: 'Bài tập',
  flashcard: 'Thẻ ghi nhớ',
};

/* ---------- 1. Parse theory definitions + flashcards ---------- */
function parseTheory() {
  const md = read(join(parent, 'Tổng Hợp Lý Thuyết Chuẩn Ôn Tập.md'));
  const lines = md.split(/\r?\n/);
  let chapter = null;
  const defs = [];
  const seen = new Set();
  for (const raw of lines) {
    const line = raw.trim();
    const ch = line.match(/^##\s*CHƯƠNG\s+(\d+)/i);
    if (ch) {
      chapter = Number(ch[1]);
      continue;
    }
    const m = line.match(/^(?:[-*]|\d+\.)\s+\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
    if (!m) continue;
    const term = strip(m[1]).replace(/[.:：]+$/, '').trim();
    const def = strip(m[2]);
    if (term.length < 3 || term.length > 90) continue;
    if (def.length < 20) continue;
    if (/^(định nghĩa|ví dụ|ý nghĩa|ghi chú|so sánh)$/i.test(term)) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    defs.push({ term, def, chapter: chapter || chapterOf(def) });
  }
  return defs;
}

/* ---------- 2. Parse the formula handbook ---------- */
function parseFormulas() {
  const md = read(join(parent, 'Tổng Quan Công Thức Và Phương Pháp Giải Nhanh.md'));
  const parts = md.split(/^###\s+/m).slice(1);
  const out = [];
  for (const part of parts) {
    const nl = part.indexOf('\n');
    if (nl < 0) continue;
    const heading = strip(part.slice(0, nl)).replace(/^\d+\.\s*/, '').trim();
    const bodyRaw = part.slice(nl + 1);
    const next = bodyRaw.search(/^##\s/m);
    const body = next >= 0 ? bodyRaw.slice(0, next) : bodyRaw;
    const formulas = [...body.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => strip(`$$${m[1]}$$`));
    const formula = formulas.find((f) => f.length > 2);
    if (!formula) continue;
    out.push({
      term: heading,
      formula,
      body: cleanBlock(body).slice(0, 700),
      chapter: chapterOf(`${heading} ${body}`),
    });
  }
  return out;
}

/* ---------- 3. Parse the 12 worked exercises ---------- */
function parseExercises() {
  const md = read(join(parent, 'Lời Giải Chi Tiết 12 Bài Tập Tổng Học.md'));
  const parts = md.split(/^##\s*CÂU\s*(\d+)\s*$/m);
  const items = [];
  for (let i = 1; i < parts.length; i += 2) {
    const num = Number(parts[i]);
    const body = parts[i + 1] || '';
    const idx = body.indexOf('### Đề bài');
    if (idx < 0) continue;
    let rest = body.slice(idx + '### Đề bài'.length);
    const nextH = rest.search(/\n###\s/);
    let questionText = nextH >= 0 ? rest.slice(0, nextH) : rest;
    let solution = nextH >= 0 ? rest.slice(nextH) : '';
    questionText = strip(questionText.replace(/^[:\s-]+/, ''));
    solution = solution
      .replace(/^###\s*/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!questionText) continue;
    items.push({
      id: `core-ex-${num}`,
      section: 'core',
      type: 'exercise',
      chapter: chapterOf(questionText, 3) || 3,
      topic: `Bài tập ${num}`,
      source: 'local-exercise',
      sourceUrl: '',
      question: questionText,
      options: [],
      answer: null,
      explanation: '',
      modelAnswer: cleanBlock(solution),
      tags: ['bài tập', 'tính toán'],
    });
  }
  return items;
}

/* ---------- 3. Core MCQs generated from definitions ---------- */
function buildCoreMcq(defs) {
  const items = [];
  defs.forEach((d, i) => {
    const distractors = defs
      .filter((x) => x.term !== d.term)
      .filter((x) => x.chapter !== d.chapter)
      .slice(i % 7, (i % 7) + 3);
    let pool = distractors;
    if (pool.length < 3) {
      pool = defs.filter((x) => x.term !== d.term).slice(i + 1, i + 4);
    }
    if (pool.length < 3) return;
    const options = [
      { text: d.term, correct: true },
      ...pool.slice(0, 3).map((x) => ({ text: x.term, correct: false })),
    ];
    items.push({
      id: `core-mcq-${i + 1}`,
      section: 'core',
      type: 'mcq',
      chapter: d.chapter,
      topic: d.term,
      source: 'local-theory',
      sourceUrl: '',
      question: `Định nghĩa sau ứng với khái niệm nào: “${d.def}”`,
      options: shuffleDeterministic(options).map((o, k) => ({
        id: 'ABCD'[k],
        text: o.text,
      })),
      answer: null,
      explanation: `${d.term}: ${d.def}`,
      modelAnswer: '',
      tags: ['định nghĩa', 'lý thuyết'],
      _correctText: shuffleDeterministic(options).find((o) => o.correct)?.text,
    });
    // Recompute answer from the same shuffled order
    const opts = shuffleDeterministic(options);
    items[items.length - 1].options = opts.map((o, k) => ({ id: 'ABCD'[k], text: o.text }));
    items[items.length - 1].answer = 'ABCD'[opts.findIndex((o) => o.correct)];
    delete items[items.length - 1]._correctText;
  });
  return items;
}

function shuffleDeterministic(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 4. Core True/False generated from definitions ---------- */
function buildCoreTf(defs) {
  const items = [];
  defs.forEach((d, i) => {
    const other = defs[(i + 5) % defs.length];
    if (!other || other.term === d.term) return;
    items.push({
      id: `core-tf-t-${i + 1}`,
      section: 'core',
      type: 'truefalse',
      chapter: d.chapter,
      topic: d.term,
      source: 'local-theory',
      sourceUrl: '',
      question: `${d.term} là ${d.def}`,
      options: [
        { id: 'A', text: 'Đúng' },
        { id: 'B', text: 'Sai' },
      ],
      answer: 'A',
      explanation: `Đúng. ${d.term}: ${d.def}`,
      modelAnswer: '',
      tags: ['đúng sai', 'lý thuyết'],
    });
    if (other.chapter !== d.chapter) {
      items.push({
        id: `core-tf-f-${i + 1}`,
        section: 'core',
        type: 'truefalse',
        chapter: d.chapter,
        topic: d.term,
        source: 'local-theory',
        sourceUrl: '',
        question: `${d.term} là ${other.def}`,
        options: [
          { id: 'A', text: 'Đúng' },
          { id: 'B', text: 'Sai' },
        ],
        answer: 'B',
        explanation: `Sai. ${d.term} được hiểu là: ${d.def}`,
        modelAnswer: '',
        tags: ['đúng sai', 'lý thuyết'],
      });
    }
  });
  return items;
}

/* ---------- 5. Formula flashcards + MCQs ---------- */
function buildFormulaItems(formulas) {
  const cards = formulas.map((f, i) => ({
    id: `core-formula-card-${i + 1}`,
    section: 'core',
    type: 'flashcard',
    chapter: f.chapter,
    topic: f.term,
    source: 'local-formula',
    sourceUrl: '',
    question: f.term,
    options: [],
    answer: null,
    explanation: '',
    modelAnswer: f.body,
    tags: ['thẻ ghi nhớ', 'công thức'],
  }));

  const mcqs = [];
  formulas.forEach((f, i) => {
    const pool = formulas.filter((x) => x.formula !== f.formula);
    const picks = [];
    for (let k = 0; k < pool.length && picks.length < 3; k++) {
      const candidate = pool[(i + k * 3 + 1) % pool.length];
      if (!picks.some((p) => p.formula === candidate.formula)) picks.push(candidate);
    }
    if (picks.length < 3) return;
    const opts = [
      { text: f.formula, correct: true },
      ...picks.map((p) => ({ text: p.formula, correct: false })),
    ];
    const shuffled = shuffleDeterministic(opts);
    mcqs.push({
      id: `core-formula-mcq-${i + 1}`,
      section: 'core',
      type: 'mcq',
      chapter: f.chapter,
      topic: f.term,
      source: 'local-formula',
      sourceUrl: '',
      question: `Công thức nào dùng để tính: ${f.term}?`,
      options: shuffled.map((o, k) => ({ id: 'ABCD'[k], text: o.text })),
      answer: 'ABCD'[shuffled.findIndex((o) => o.correct)],
      explanation: `${f.term}: ${f.formula}`,
      modelAnswer: '',
      tags: ['công thức', 'trắc nghiệm'],
    });
  });

  return { cards, mcqs };
}

/* ---------- 6. Extra questions from crawled quizzes ---------- */
function loadExtra() {
  const dir = join(root, 'crawl', 'parsed');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const items = [];
  for (const f of files) {
    const quiz = JSON.parse(read(join(dir, f)));
    (quiz.questions || []).forEach((q, qi) => {
      if (!q.question || !Array.isArray(q.answers) || !q.answers.length) return;
      const correctIdx = q.answers.findIndex((a) => a.correct);
      if (correctIdx < 0) return;
      const texts = q.answers.map((a) => a.text.trim());
      const isTf =
        texts.length === 2 ||
        texts.every((t) => /^(đúng|sai|không rõ|chưa rõ|true|false|cannot be determined|partially true)$/i.test(t));
      const type = isTf ? 'truefalse' : 'mcq';
      const base = {
        section: 'extra',
        chapter: chapterOf(q.question),
        topic: quiz.title.replace(/^Quiz:\s*/i, '').slice(0, 90),
        source: quiz.slug,
        sourceUrl: quiz.url,
        explanation: strip(q.explanation || ''),
        modelAnswer: '',
        tags: [type === 'truefalse' ? 'đúng sai' : 'trắc nghiệm', 'studocu'],
      };
      items.push({
        ...base,
        id: `extra-${quiz.id}-q${qi + 1}`,
        type,
        question: strip(q.question),
        options: texts.map((t, k) => ({ id: 'ABCD'[k], text: strip(t) })),
        answer: 'ABCD'[correctIdx],
      });
      const wantsEssay = /^(vì sao|tại sao|phân tích|trình bày|so sánh|chứng minh|hãy|cho biết)/i.test(
        q.question.trim()
      );
      if (wantsEssay || quiz.kind === 'essay') {
        const correctText = texts[correctIdx];
        const model = [strip(q.explanation || ''), correctText ? `Đáp án gợi ý: ${strip(correctText)}` : '']
          .filter(Boolean)
          .join('\n\n');
        items.push({
          ...base,
          id: `extra-${quiz.id}-e${qi + 1}`,
          type: 'essay',
          question: strip(q.question),
          options: [],
          answer: null,
          modelAnswer: model,
        });
      }
      const mathLike =
        type !== 'truefalse' &&
        /[0-9]/.test(q.question) &&
        /(bai-tap|toan|bài tập|tính|chi phí|tỷ suất|giá trị thặng dư|tư bản|sản phẩm)/i.test(
          `${quiz.slug} ${q.question}`
        );
      if (mathLike) {
        items.push({
          ...base,
          id: `extra-${quiz.id}-x${qi + 1}`,
          type: 'exercise',
          question: strip(q.question),
          options: [],
          answer: null,
          modelAnswer: [strip(q.explanation || ''), `Đáp án gợi ý: ${strip(texts[correctIdx])}`]
            .filter(Boolean)
            .join('\n\n'),
          tags: ['bài tập', 'tính toán', 'studocu'],
        });
      }
    });
  }
  return items;
}

/* ---------- 6. Assemble ---------- */
const defs = parseTheory();
const formulas = parseFormulas();
const exercises = parseExercises();
const curated = JSON.parse(read(join(root, 'content', 'core-curated.json')));
const extra = loadExtra();

const coreMcq = buildCoreMcq(defs);
const coreTfAuto = buildCoreTf(defs);
const formulaItems = buildFormulaItems(formulas);

const coreCuratedTf = curated.truefalse.map((q, i) => ({
  id: `core-tf-c${i + 1}`,
  section: 'core',
  type: 'truefalse',
  chapter: q.chapter,
  topic: q.topic,
  source: 'local-theory',
  sourceUrl: '',
  question: q.question,
  options: [
    { id: 'A', text: 'Đúng' },
    { id: 'B', text: 'Sai' },
  ],
  answer: q.answer ? 'A' : 'B',
  explanation: q.explanation,
  modelAnswer: '',
  tags: ['đúng sai', 'lý thuyết'],
}));

const coreEssays = curated.essays.map((q, i) => ({
  id: `core-essay-${i + 1}`,
  section: 'core',
  type: 'essay',
  chapter: q.chapter,
  topic: q.topic,
  source: 'local-theory',
  sourceUrl: '',
  question: q.question,
  options: [],
  answer: null,
  explanation: '',
  modelAnswer: q.modelAnswer,
  tags: ['tự luận', 'lý thuyết'],
}));

const flashcards = defs.map((d, i) => ({
  id: `core-card-${i + 1}`,
  section: 'core',
  type: 'flashcard',
  chapter: d.chapter,
  topic: d.term,
  source: 'local-theory',
  sourceUrl: '',
  question: d.term,
  options: [],
  answer: null,
  explanation: '',
  modelAnswer: d.def,
  tags: ['thẻ ghi nhớ'],
}));

// Extra flashcards: question -> correct answer
const extraCards = extra
  .filter((q) => q.type !== 'essay' && q.answer)
  .map((q, i) => {
    const correct = q.options.find((o) => o.id === q.answer);
    return {
      id: `extra-card-${i + 1}`,
      section: 'extra',
      type: 'flashcard',
      chapter: q.chapter,
      topic: q.topic,
      source: q.source,
      sourceUrl: q.sourceUrl,
      question: q.question,
      options: [],
      answer: null,
      explanation: '',
      modelAnswer: correct ? `${correct.text}${q.explanation ? ` — ${q.explanation}` : ''}` : q.explanation,
      tags: ['thẻ ghi nhớ', 'studocu'],
    };
  });

function normalizeKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9à-ỹ]+/gi, ' ').trim();
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const q of items) {
    const key = `${q.section}|${q.type}|${normalizeKey(q.question)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

const all = dedupe([
  ...exercises,
  ...coreEssays,
  ...coreCuratedTf,
  ...coreTfAuto,
  ...coreMcq,
  ...flashcards,
  ...formulaItems.cards,
  ...formulaItems.mcqs,
  ...extra,
  ...extraCards,
]);

const counts = { core: {}, extra: {} };
for (const q of all) {
  const bucket = counts[q.section] || (counts[q.section] = {});
  bucket[q.type] = (bucket[q.type] || 0) + 1;
}

const bank = {
  meta: {
    builtAt: new Date().toISOString(),
    total: all.length,
    counts,
    sources: [...new Set(all.filter((q) => q.section === 'extra').map((q) => q.source))].length,
  },
  questions: all,
};

mkdirSync(join(root, 'data'), { recursive: true });
mkdirSync(join(root, 'public', 'data'), { recursive: true });
const json = JSON.stringify(bank, null, 2) + '\n';
writeFileSync(join(root, 'data', 'questions.json'), json, 'utf8');
writeFileSync(join(root, 'public', 'data', 'questions.json'), json, 'utf8');

console.log('Definitions:', defs.length);
console.log('Formulas:', formulas.length);
console.log('Exercises:', exercises.length);
console.log('Core MCQs:', coreMcq.length);
console.log('Core TF (auto):', coreTfAuto.length, '+ curated:', coreCuratedTf.length);
console.log('Core essays:', coreEssays.length);
console.log('Extra questions:', extra.length);
console.log('Extra flashcards:', extraCards.length);
console.log('TOTAL:', all.length, JSON.stringify(counts));
