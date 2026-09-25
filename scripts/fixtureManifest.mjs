/**
 * Reads the web previewer's generated scene manifest (`apps/textscene-web/src/fixtures.ts`)
 * from Node. `generate-fixtures.js` writes its array as JSON, so the parse needs no
 * TypeScript.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';

const FIXTURE_MANIFEST_PATH = join(REPO_ROOT, 'apps/textscene-web/src/fixtures.ts');

/**
 * @param {string} source - the text of `fixtures.ts`.
 * @returns {{ name: string, file: string, category: string, root?: string }[]}
 */
export function parseFixtureManifest(source) {
  const array = source.match(/export const fixtures[^=]*=\s*(\[[\s\S]*?\]);/);
  if (!array) {
    throw new Error('expected `export const fixtures = [...]` in the fixture manifest');
  }
  return JSON.parse(array[1]);
}

export function readFixtureManifest() {
  return parseFixtureManifest(readFileSync(FIXTURE_MANIFEST_PATH, 'utf8'));
}
