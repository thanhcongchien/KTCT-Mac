import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const tmp = join(root, '.pages-tmp');

if (!existsSync(dist)) {
  console.error('Chưa có thư mục dist. Hãy chạy npm run build trước.');
  process.exit(1);
}

const remote = execSync('git remote get-url origin', { cwd: root, encoding: 'utf8' }).trim();
const run = (cmd) =>
  execSync(cmd, { cwd: tmp, stdio: 'inherit', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
cpSync(dist, tmp, { recursive: true });
writeFileSync(join(tmp, '.nojekyll'), '');

run('git init');
run('git checkout -b gh-pages');
run('git add -A');
run(
  'git -c user.name="KTCT Deploy" -c user.email="deploy@local" commit -m "Deploy KTCT practice site"'
);
run(`git remote add origin ${remote}`);
run('git push -f origin gh-pages');
rmSync(tmp, { recursive: true, force: true });

console.log('Đã deploy lên nhánh gh-pages.');
