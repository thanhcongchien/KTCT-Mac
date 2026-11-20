import { load } from 'cheerio';

const url = 'https://www.studocu.vn/vn/quiz/dung-sai-ktct-dungsai-ktct/1186582';
const res = await fetch(url, {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    'accept-language': 'vi,en;q=0.8',
  },
});
const html = await res.text();
console.log('status', res.status, 'chars', html.length);

const $ = load(html);
const expl = $('*')
  .contents()
  .filter((_, n) => n.type === 'text' && n.data.trim() === 'Explanation');
console.log('Explanation text nodes:', expl.length);

// Find the "Quiz questions" heading and dump its parent structure
const h = $('h2').filter((_, el) => $(el).text().trim() === 'Quiz questions');
console.log('quiz questions headings:', h.length);
if (h.length) {
  const section = h.first().parent();
  console.log('parent tag/class:', section.get(0).tagName, section.attr('class'));
  const text = section.text().replace(/\s+/g, ' ').slice(0, 700);
  console.log('SECTION TEXT:', text);
  // dump first 3 question-ish blocks
  const blocks = section.find('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return /question|item/i.test(cls);
  });
  console.log('candidate blocks:', blocks.length);
  blocks.slice(0, 3).each((i, el) => {
    console.log(`-- block ${i} class=${$(el).attr('class')}`);
    console.log($(el).text().replace(/\s+/g, ' ').slice(0, 300));
  });
}

// Inspect the main question containers
const qitems = $('div[class*="questionItem"]');
console.log('questionItem count:', qitems.length);
qitems.slice(0, 2).each((i, el) => {
  console.log(`== qitem ${i} class=${$(el).attr('class')}`);
  console.log($(el).text().replace(/\s+/g, ' ').slice(0, 400));
});

// Where does Explanation live? print parent chain of first
expl.slice(0, 2).each((i, n) => {
  let p = n.parent;
  const chain = [];
  for (let k = 0; k < 6 && p; k++) {
    chain.push(`${p.tagName}${p.attribs?.class ? '.' + p.attribs.class.split(' ').join('.') : ''}`);
    p = p.parent;
  }
  console.log(`expl chain ${i}:`, chain.join(' < '));
});
