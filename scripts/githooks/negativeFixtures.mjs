/**
 * The scenes that exist to error: the negative fixtures in `scenes/fixtures/negative-fixtures.json`,
 * and the unfinished edits in `scenes/language-features/unfinished-edits.json`. The pre-commit and
 * pre-push hooks skip them, so a commit or a push that touches one does not fail on it.
 * `fixtureLint.test.ts` and `answers.json` assert that each one does error.
 */

import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

/** The list names a fixture by its basename, wherever it sits under `scenes/fixtures`. */
const NEGATIVE_FIXTURES = new Set(
  JSON.parse(readFileSync(new URL('../../scenes/fixtures/negative-fixtures.json', import.meta.url), 'utf8'))
    .files
);

/** The unfinished edits, by their path from the repository root, since a basename like `typing.tscn` is common. */
const UNFINISHED_EDITS = JSON.parse(
  readFileSync(new URL('../../scenes/language-features/unfinished-edits.json', import.meta.url), 'utf8')
).files.map((file) => `scenes/language-features/project/${file}`);

/**
 * Whether `path` names a scene that exists to error. Backslashes read as separators first: a hook
 * may hand a Windows path, and `posix.basename` cuts only at a forward slash.
 */
export function isNegativeFixture(path) {
  const forwardPath = path.replace(/\\/g, '/');
  return (
    NEGATIVE_FIXTURES.has(posix.basename(forwardPath)) ||
    UNFINISHED_EDITS.some((edit) => forwardPath === edit || forwardPath.endsWith(`/${edit}`))
  );
}
