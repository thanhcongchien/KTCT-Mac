(() => {
  const h2 = [...document.querySelectorAll('h2')].find((h) => h.innerText.trim() === 'Quiz questions');
  const section = h2?.parentElement;
  const text = section ? section.innerText.replace(/\s+/g, ' ') : null;
  const exprs = [...document.querySelectorAll('*')]
    .filter((e) => e.children.length === 0 && /explanation/i.test(e.textContent))
    .slice(0, 5)
    .map((e) => ({
      tag: e.tagName,
      cls: e.className,
      text: e.textContent.trim().slice(0, 80),
      parentCls: e.parentElement?.className,
      parentText: e.parentElement?.innerText?.replace(/\s+/g, ' ').slice(0, 300),
    }));
  // find the container that has question text + 'Explanation'
  const blocks = section ? [...section.querySelectorAll('*')].filter((e) => e.innerText && e.innerText.includes('Explanation') && e.children.length > 2) : [];
  const smallest = blocks.sort((a, b) => a.innerText.length - b.innerText.length)[0];
  return JSON.stringify({
    sectionText: text ? text.slice(0, 1200) : null,
    exprs,
    smallestBlockCls: smallest?.className,
    smallestBlockText: smallest?.innerText.replace(/\s+/g, ' ').slice(0, 500),
  });
})();
