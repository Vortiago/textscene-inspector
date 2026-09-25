/** The repository's files as the convention guards read them, and a line lookup for their reports. */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/**
 * The working tree's files that match the pathspecs: tracked or new and not ignored, minus any
 * deleted but not yet staged. With no pathspec, every such file.
 */
export function workingTreeFiles(...pathspecs: string[]): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', ...pathspecs], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\n')
    .filter((path) => path !== '' && existsSync(resolve(REPO_ROOT, path)));
}

/** The 1-based line of a source offset. */
export function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === '\n') line++;
  return line;
}
