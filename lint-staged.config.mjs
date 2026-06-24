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
 */

/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'vitest related --run'],
  '*.tscn': (files) => [
    'pnpm build:linter',
    `node apps/textscene-linter/dist/cli.js ${files.map((f) => JSON.stringify(f)).join(' ')}`,
  ],
};
