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
 * TYPE-CHECK: `eslint` and `vitest` both transpile without checking types, so
 * before this the pre-commit hook could not see a type error at all — and a
 * long local-only session never reaches pre-push or CI, so errors accumulated
 * across commits invisibly. The check is per PACKAGE rather than per file
 * because `tsc` has no meaningful single-file mode inside a project, and it is
 * incremental (each `tsconfig.typecheck.json` sets `tsBuildInfoFile`), so a
 * warm run costs a few seconds rather than the ~20s a cold one does.
 */

import { readFileSync } from 'node:fs';

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
    const quoted = files.map((f) => JSON.stringify(f)).join(' ');
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
  '*.tscn': (files) => [
    'pnpm build:linter',
    `node apps/textscene-linter/dist/cli.js ${files.map((f) => JSON.stringify(f)).join(' ')}`,
  ],
};
