/**
 * The generated fixtures manifest as the showcase reads it: a scenario's label to its fixture
 * file. It resolves from the repo root, so a run from any directory reads this checkout's manifest.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';

const MANIFEST = resolve(REPO_ROOT, 'apps/textscene-web/src/fixtures.ts');

/** The JSON array `pnpm generate:fixtures` writes after `export const fixtures`. */
const FIXTURES_ARRAY_RE = /export const fixtures[^=]*=\s*(\[[\s\S]*?\]);/;

/** The manifest's `{ name, file }` entries from its source text, or none when it holds no array. */
export function parseFixtureManifest(source) {
  const array = FIXTURES_ARRAY_RE.exec(source);
  return array ? JSON.parse(array[1]) : [];
}

/** Reads this checkout's manifest into a lookup from a fixture label to its file name. */
export function readFixtureLookup() {
  const fixtures = parseFixtureManifest(readFileSync(MANIFEST, 'utf8'));
  return (label) => fixtures.find((fixture) => fixture.name === label)?.file;
}
