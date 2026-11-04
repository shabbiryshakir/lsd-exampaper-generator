// Publishes builds to GitHub Pages (the gh-pages branch). Three copies of the app can be online at once:
//
//   https://shabbiryshakir.github.io/lsd-exampaper-generator/           live   (what teachers use)
//   https://shabbiryshakir.github.io/lsd-exampaper-generator/beta/      beta   (for checking before going live)
//   https://shabbiryshakir.github.io/lsd-exampaper-generator/classic/   classic (the version before the Quran update)
//
//   node scripts/release.mjs beta              build this checkout and publish it to /beta/
//   node scripts/release.mjs live              build this checkout and publish it to the live address
//   node scripts/release.mjs classic [ref]     build an older version (default: branch archive/classic-v1) into /classic/
//
// Add --push to also push gh-pages to GitHub (without it you can look at the commit first).
// `live` leaves /beta/ and /classic/ alone, so the classic copy always stays available.
// To go back to the old version for everyone: node scripts/release.mjs live --ref origin/archive/classic-v1 --push
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const target = args[0];
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : null; };
const REPO = 'lsd-exampaper-generator';
const BASES = { beta: `/${REPO}/beta/`, live: `/${REPO}/`, classic: `/${REPO}/classic/` };
if (!BASES[target]) { console.error('usage: node scripts/release.mjs <beta|live|classic> [--ref <git ref>] [--push]'); process.exit(1); }

const run = (cmd, argv, cwd) => execFileSync(cmd, argv, { cwd, stdio: 'inherit' });
const out = (cmd, argv, cwd) => execFileSync(cmd, argv, { cwd, encoding: 'utf8' }).trim();
const root = out('git', ['rev-parse', '--show-toplevel']);
const work = mkdtempSync(join(tmpdir(), 'release-'));
const ref = opt('ref') || (target === 'classic' ? 'origin/archive/classic-v1' : null);

try {
  run('git', ['fetch', 'origin'], root);
  // 1. Source: this checkout, or a clean copy of an older version.
  let src = root;
  if (ref) {
    src = join(work, 'src');
    run('git', ['worktree', 'add', '--detach', src, ref], root);
    // Old versions share this checkout's installed packages.
    run('ln', ['-s', join(root, 'node_modules'), join(src, 'node_modules')]);
  }
  // 2. Build with the right address.
  const dist = join(work, 'dist');
  run('npx', ['vite', 'build', '--base', BASES[target], '--outDir', dist, '--emptyOutDir'], src);

  // 3. Put the build on gh-pages.
  const pages = join(work, 'pages');
  // Build on top of local releases that are not pushed yet, otherwise on what is online.
  let from = 'origin/gh-pages';
  try { run('git', ['merge-base', '--is-ancestor', 'origin/gh-pages', 'gh-pages'], root); from = 'gh-pages'; } catch { /* no local gh-pages, or it has diverged */ }
  run('git', ['worktree', 'add', '--detach', pages, from], root);
  const dest = target === 'live' ? pages : join(pages, target);
  if (target === 'live') {
    for (const f of readdirSync(pages)) if (!['.git', 'beta', 'classic'].includes(f)) rmSync(join(pages, f), { recursive: true, force: true });
  } else if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(dist, dest, { recursive: true });
  run('git', ['add', '-A'], pages);
  const label = ref ? `${target} (${ref})` : target;
  run('git', ['commit', '-m', `Update ${label}`], pages);
  run('git', ['branch', '-f', 'gh-pages', 'HEAD'], pages);
  console.log(`\nCommitted to the local gh-pages branch: Update ${label}`);
  if (flag('push')) { run('git', ['push', 'origin', 'gh-pages'], root); console.log(`Pushed. It is online in a minute or two at https://shabbiryshakir.github.io/${REPO}${target === 'live' ? '/' : `/${target}/`}`); }
  else console.log('Not pushed yet. Run again with --push, or: git push origin gh-pages');
} finally {
  for (const dir of [join(work, 'pages'), join(work, 'src')]) { if (existsSync(dir)) run('git', ['worktree', 'remove', '--force', dir], root); }
  run('git', ['worktree', 'prune'], root);
  rmSync(work, { recursive: true, force: true });
}
