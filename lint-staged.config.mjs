/**
 * lint-staged runs in the pre-commit hook (fast: only the staged files).
 * The full `pnpm validate` gate runs in the pre-push hook and in CI, so nothing
 * reaches a shared branch unvalidated.
 *
 * The *.{ts,...} entry uses string form: lint-staged appends and shell-quotes
 * the staged files itself. The *.tscn entry uses function form so the staged
 * filenames are NOT appended to `pnpm build:linter` — lint-staged appends
 * matched files to every string command, and passing .tscn paths to the esbuild
 * build would treat them as extra entry points and fail; only the lint CLI
 * should receive them.
 *
 * The negative fixtures are skipped: they exist to produce an error, so linting
 * them here would fail every commit that touches one. `fixtureLint.test.ts`
 * asserts the same list DOES error, and both read it from one file so the two
 * cannot drift apart.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const NEGATIVE_FIXTURES = new Set(
  JSON.parse(readFileSync(new URL('./scenes/fixtures/negative-fixtures.json', import.meta.url), 'utf8'))
    .files
);

/**
 * One argument for the command string lint-staged parses.
 *
 * Plain double quotes rather than `JSON.stringify`: lint-staged splits the
 * returned string with `string-argv`, which strips quotes without unescaping,
 * so JSON's doubled backslashes reached the CLI as part of the path and no
 * Windows path resolved.
 */
const quote = (f) => `"${f}"`;

/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,js,jsx,mjs}': ['eslint --fix', 'vitest related --run'],
  '*.{tscn,tres}': (files) => {
    // `basename`, not a split: lint-staged hands the hook absolute paths, and
    // `node:path` is `path.win32` on Windows, so it cuts a backslash path there
    // and leaves a backslash in a POSIX filename alone.
    const lintable = files.filter((f) => !NEGATIVE_FIXTURES.has(basename(f)));
    if (lintable.length === 0) return [];
    return [
      'pnpm build:linter',
      `node apps/textscene-linter/dist/cli.js ${lintable.map(quote).join(' ')}`,
    ];
  },
};
