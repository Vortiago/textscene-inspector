// The files the sweep changed since its base, with their text before and after.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { repoRoot } from './scan.mjs';

const git = (...args) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 << 20 });

export const base = JSON.parse(readFileSync(resolve(repoRoot, '.sweep/batches.json'), 'utf8')).base;

/** Changed paths since the base, committed or not, outside `.sweep/`. Paths from argv narrow it. */
export function changedFiles() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const paths = git('diff', '--name-only', base, '--')
    .split('\n')
    .filter((p) => p !== '' && !p.startsWith('.sweep/'));
  return only.length > 0 ? paths.filter((p) => only.includes(p)) : paths;
}

/** The text of a path at the base, or the empty string for a file the sweep added. */
export function before(path) {
  try {
    return git('show', `${base}:${path}`);
  } catch {
    return '';
  }
}

/** The text of a path now, or the empty string for a file the sweep deleted. */
export function after(path) {
  const file = resolve(repoRoot, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}
