/**
 * Reads the web previewer's generated scene manifest (`apps/textscene-web/src/fixtures.ts`,
 * untracked) from Node. `generate-fixtures.js` writes its array as JSON, so the parse needs no
 * TypeScript.
 */
import { existsSync, readFileSync } from 'node:fs';
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

/** @param {string} [path] - the manifest to read, this checkout's by default. */
export function readFixtureManifest(path = FIXTURE_MANIFEST_PATH) {
  if (!existsSync(path)) {
    throw new Error(`expected the fixture manifest at ${path}, found none: run \`pnpm generate:fixtures\``);
  }
  return parseFixtureManifest(readFileSync(path, 'utf8'));
}

/** Reads this checkout's manifest into a lookup from a fixture label to its file name. */
export function readFixtureLookup() {
  const fixtures = readFixtureManifest();
  return (label) => fixtures.find((fixture) => fixture.name === label)?.file;
}
