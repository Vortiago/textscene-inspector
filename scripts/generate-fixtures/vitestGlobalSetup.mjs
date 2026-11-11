/**
 * Vitest's global setup: the tests read the untracked fixture manifest and the demo corpora.
 * The generator vendors a stale corpus first, then writes the manifest from the scenes on disk.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GENERATOR = fileURLToPath(new URL('../generate-fixtures.js', import.meta.url));

export function setup() {
  execFileSync(process.execPath, [GENERATOR], { stdio: 'inherit' });
}
