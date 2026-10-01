/**
 * The scenes that exist to error, from `scenes/fixtures/negative-fixtures.json`. The pre-commit and
 * pre-push hooks skip them, so a commit or a push that touches one does not fail on it.
 * `fixtureLint.test.ts` reads the same list and asserts each one does error.
 */

import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

/** The list names a fixture by its basename, wherever it sits under `scenes/fixtures`. */
const NEGATIVE_FIXTURES = new Set(
  JSON.parse(readFileSync(new URL('../../scenes/fixtures/negative-fixtures.json', import.meta.url), 'utf8'))
    .files
);

/**
 * Whether `path` names a negative fixture. Backslashes read as separators first: a hook may hand a
 * Windows path, and `posix.basename` cuts only at a forward slash.
 */
export function isNegativeFixture(path) {
  return NEGATIVE_FIXTURES.has(posix.basename(path.replace(/\\/g, '/')));
}
