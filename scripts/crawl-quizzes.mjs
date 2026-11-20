import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targetsPath = join(root, 'crawl', 'targets.json');
const parsedDir = join(root, 'crawl', 'parsed');
const extractScript = readFileSync(join(root, 'scripts', 'extract-quiz.js'), 'utf8');
const session = 'ktct-crawl';
const force = process.argv.includes('--force');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

mkdirSync(parsedDir, { recursive: true });

const targets = JSON.parse(readFileSync(targetsPath, 'utf8')).slice(0, limit);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, input) {
  return execSync(cmd, {
    cwd: root,
    input,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function parseEvalOutput(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('npm notice') && !l.startsWith('[agent-browser]'));
  for (const line of lines) {
    if (!/^["{[]/.test(line)) continue;
    try {
      const first = JSON.parse(line);
      const value = typeof first === 'string' ? JSON.parse(first) : first;
      if (value && typeof value === 'object') return value;
    } catch {
      /* try next line */
    }
  }
  return null;
}

async function extract(url) {
  run(`agent-browser --session ${session} open "${url}" --headed`);
  await sleep(3000);
  const out = run(`agent-browser --session ${session} eval --stdin`, extractScript);
  const parsed = parseEvalOutput(out);
  if (!parsed) console.log('  DEBUG raw output:', JSON.stringify(out.slice(0, 200)));
  return parsed;
}

let ok = 0;
let failed = 0;
for (let i = 0; i < targets.length; i++) {
  const t = targets[i];
  const url = `https://www.studocu.vn/vn/quiz/${t.slug}/${t.id}`;
  const outPath = join(parsedDir, `${t.slug}-${t.id}.json`);
  if (!force && existsSync(outPath)) {
    console.log(`[${i + 1}/${targets.length}] skip ${t.id} (cached)`);
    ok++;
    continue;
  }
  let data = null;
  for (let attempt = 1; attempt <= 2 && !data?.questions?.length; attempt++) {
    try {
      if (attempt > 1) await sleep(2500);
      data = await extract(url);
      if (data?.error) console.log(`  attempt ${attempt}: ${data.error}`);
    } catch (e) {
      console.log(`  attempt ${attempt} failed: ${e.message.split('\n')[0]}`);
    }
  }
  if (data?.questions?.length) {
    data.slug = t.slug;
    data.kind = t.kind;
    data.url = url;
    writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`[${i + 1}/${targets.length}] ok ${t.id} — ${data.questions.length} questions`);
    ok++;
  } else {
    console.log(`[${i + 1}/${targets.length}] FAILED ${t.id}`);
    failed++;
  }
  await sleep(1800);
}

try {
  run(`agent-browser --session ${session} close`);
} catch {
  /* ignore */
}

console.log(`\nDone: ${ok} ok, ${failed} failed, ${targets.length} targets`);
if (failed) process.exitCode = 1;
