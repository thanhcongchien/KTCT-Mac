(() => {
  const raw = [...document.querySelectorAll('script')]
    .map((s) => s.textContent || '')
    .join('\n');

  let decoded = '';
  const pushRe = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  while ((m = pushRe.exec(raw))) {
    try {
      decoded += JSON.parse(m[1]);
    } catch {
      /* ignore malformed chunk */
    }
  }
  const text = decoded || raw;

  const pick = (needle) => {
    const at = text.indexOf(needle);
    if (at < 0) return null;
    const start = text.indexOf('{', at);
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  };

  const quiz = pick('"quiz":');
  if (!quiz || !Array.isArray(quiz.questions)) {
    return JSON.stringify({ error: 'quiz-not-found', decodedLen: text.length });
  }

  return JSON.stringify({
    id: quiz.id,
    title: document.querySelector('h1')?.innerText?.trim() || '',
    totalQuestions: quiz.questions.length,
    questions: quiz.questions.map((q) => ({
      question: q.question,
      explanation: q.explanation || '',
      answers: (q.answers || []).map((a) => ({ text: a.answer, correct: !!a.isCorrect })),
    })),
  });
})();
