/**
 * The pre-commit hook's checks, over the staged files only. The full `pnpm validate` gate runs in
 * the pre-push hook and in CI, so nothing reaches a shared branch unvalidated.
 */

import { readFileSync } from 'node:fs';
import { isNegativeFixture } from './scripts/githooks/negativeFixtures.mjs';

/**
 * One argument for the command string lint-staged parses. Plain double quotes, not
 * `JSON.stringify`: `string-argv` strips quotes without unescaping, so JSON's doubled backslashes
 * reached the CLI and no Windows path resolved.
 */
const quote = (f) => `"${f}"`;

/**
 * The workspace package owning a repo-relative path, or `null` for a file outside one (`scripts/`,
 * config at the root). eslint and the `scripts` vitest project cover those, and no `tsc` project
 * owns them.
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
  // One key, so the steps run in sequence. lint-staged runs glob keys concurrently, and a second
  // key over these files would put `tsc` on the files `eslint --fix` is rewriting.
  '*.{ts,tsx,js,jsx,mjs}': (files) => {
    const quoted = files.map(quote).join(' ');
    // eslint and vitest transpile without checking types, so only this step sees a type error
    // before a push. Per package, since `tsc` has no single-file mode inside a project.
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
      // After eslint, so a fixer's rewrite is formatted too.
      `prettier --write ${quoted}`,
      `vitest related --run ${quoted}`,
      ...packages.map((name) => `pnpm --filter ${name} type-check`),
    ];
  },
  // Disjoint from the key above, so running the two keys at once never writes one file twice.
  '*.{css,json,yaml,yml,html}': 'prettier --write',
  // Function form, so the staged paths reach only the lint CLI: lint-staged appends them to every
  // string command, and the esbuild build behind `build:linter` would read them as entry points.
  '*.{tscn,tres}': (files) => {
    // A negative fixture exists to error, so linting it would fail every commit that touches one.
    const lintable = files.filter((f) => !isNegativeFixture(f));
    if (lintable.length === 0) return [];
    return ['pnpm build:linter', `node apps/textscene-linter/dist/cli.js ${lintable.map(quote).join(' ')}`];
  },
};
