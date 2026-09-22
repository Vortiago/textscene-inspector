/**
 * lint-staged runs in the pre-commit hook (fast: only the staged files).
 * The full `pnpm validate` gate runs in the pre-push hook and in CI, so nothing
 * reaches a shared branch unvalidated.
 *
 * The *.{ts,...} entry uses function form so the type-check commands below can
 * be appended per package. The scene entry uses it so the staged filenames are
 * NOT appended to `pnpm build:linter` — lint-staged appends matched files to
 * every string command, and passing scene paths to the esbuild build would
 * treat them as extra entry points and fail; only the lint CLI should get them.
 *
 * TYPE-CHECK: `eslint` and `vitest` both transpile without checking types, so
 * before this the pre-commit hook could not see a type error at all — and a
 * long local-only session never reaches pre-push or CI, so errors accumulated
 * across commits invisibly. The check is per PACKAGE rather than per file
 * because `tsc` has no meaningful single-file mode inside a project.
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

/**
 * The workspace package owning a repo-relative path, or `null` for a file
 * outside one (`scripts/`, config at the root) — those are covered by eslint
 * and the `scripts` vitest project, and belong to no `tsc` project.
 */
function owningPackage(file) {
  const parts = file.split('/');
  const root = parts.indexOf('packages') === 0 || parts.indexOf('apps') === 0 ? parts.slice(0, 2) : null;
  if (!root) return null;
  try {
    const manifest = JSON.parse(readFileSync(`${root.join('/')}/package.json`, 'utf8'));
    return manifest.scripts?.['type-check'] ? manifest.name : null;
  } catch {
    return null;
  }
}

/** @type {import('lint-staged').Configuration} */
export default {
  // ONE key, so the three run in SEQUENCE. lint-staged runs different glob keys
  // CONCURRENTLY, and a second key overlapping this one would put `tsc` on the
  // same files `eslint --fix` is rewriting.
  '*.{ts,tsx,js,jsx,mjs}': (files) => {
    const quoted = files.map(quote).join(' ');
    const packages = [
      ...new Set(
        files
          .filter((f) => /\.tsx?$/.test(f))
          .map((f) => owningPackage(f.replace(`${process.cwd()}/`, '')))
          .filter((name) => name !== null)
      ),
    ];
    return [
      `eslint --fix ${quoted}`,
      `vitest related --run ${quoted}`,
      ...packages.map((name) => `pnpm --filter ${name} type-check`),
    ];
  },
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
