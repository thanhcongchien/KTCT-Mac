(() => {
  const scripts = [...document.querySelectorAll('script')]
    .map((s) => s.textContent || '')
    .filter((t) => t.includes('Explanation') || t.includes('isCorrect') || t.includes('correctOption'));
  const joined = scripts.join('\n');
  const findCtx = (needle, span = 600) => {
    const i = joined.indexOf(needle);
    return i < 0 ? null : joined.slice(Math.max(0, i - span), i + span);
  };
  const keys = ['isCorrect', 'correctOption', 'correctAnswer', 'is_correct', 'answerId', 'options', '"answer"'];
  return JSON.stringify({
    scriptCount: scripts.length,
    joinedLen: joined.length,
    explanationCtx: findCtx('Explanation'),
    isCorrectCtx: findCtx('isCorrect'),
    answerCtx: findCtx('correctOption') || findCtx('correctAnswer'),
    keyHits: keys.map((k) => [k, joined.includes(k)]),
  });
})();
