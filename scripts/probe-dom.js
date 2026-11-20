(() => {
  const qItems = [...document.querySelectorAll('[class*="questionItem"]')];
  const expl = [...document.querySelectorAll('*')].filter(
    (e) => e.children.length === 0 && e.textContent.trim() === 'Explanation'
  );
  return JSON.stringify({
    title: document.querySelector('h1')?.innerText || document.title,
    headings: [...document.querySelectorAll('h2')].map((h) => h.innerText).filter(Boolean),
    questionItems: qItems.length,
    optionButtons: document.querySelectorAll('[class*="optionContainer"]').length,
    explanations: expl.length,
    firstQuestion: qItems[0]?.innerText?.slice(0, 400),
    explChain: expl[0]
      ? (() => {
          let p = expl[0].parentElement;
          const chain = [];
          for (let i = 0; i < 6 && p; i++) {
            chain.push(p.tagName + (p.className ? '.' + String(p.className).split(' ').join('.') : ''));
            p = p.parentElement;
          }
          return chain;
        })()
      : null,
  });
})();
