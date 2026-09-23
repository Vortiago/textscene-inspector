// Commits each given batch on its own, with the Sweep-Batch trailer that marks it done.
// Usage: node .sweep/commit.mjs <batch ids…>   Run only while no agent edits the tree.
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { repoRoot } from './scan.mjs';

const { batches } = JSON.parse(readFileSync(resolve(repoRoot, '.sweep/batches.json'), 'utf8'));
const git = (...args) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const SUBJECT = {
  prose: (label) => `docs: bring the ${label} documents to Simplified Technical English`,
  adr: () => 'docs(adr): state the decision records as current fact',
  sheet: () => 'docs(comparison): tighten the parity sheet prose',
  code: (label) => `docs(${label}): cut code comments to the Clean Code comment rules`,
};

function isDone(id) {
  return git('log', '--format=%H', `--grep=^Sweep-Batch: ${id}$`).trim() !== '';
}

for (const id of process.argv.slice(2)) {
  const batch = batches.find((b) => b.id === id);
  if (!batch) throw new Error(`expected a batch id from batches.json, got ${id}`);
  if (isDone(id)) {
    console.log(`${id}: already committed`);
    continue;
  }
  git('add', '--all', '--', ...batch.files);
  const label = id.replace(/^w\d+-\d+-/, '');
  const message = `${SUBJECT[batch.kind](label)}\n\nSweep-Batch: ${id}\nRefs #473\n`;
  // An empty batch still gets its commit: the trailer is the only record that it is done.
  // HUSKY=0 skips the pre-commit hook, because the wave's gate already ran the full suite on
  // this tree. The pre-push `validate` still runs on every push.
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', message], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, HUSKY: '0' },
  });
  console.log(`${id}: committed ${git('rev-parse', '--short', 'HEAD').trim()}`);
}
