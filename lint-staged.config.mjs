/**
 * The pre-commit hook's checks, over the staged files only: lint and format, so a commit takes
 * seconds. The pre-push hook runs the type checks and the nearby tests, and CI runs the full gate.
 */

import { isNegativeFixture } from './scripts/githooks/negativeFixtures.mjs';

/**
 * One argument for the command string lint-staged parses. Plain double quotes, not
 * `JSON.stringify`: `string-argv` strips quotes without unescaping, so JSON's doubled backslashes
 * reached the CLI and no Windows path resolved.
 */
const quote = (f) => `"${f}"`;

/** @type {import('lint-staged').Configuration} */
export default {
  // One key, with the steps in an array, so they run in sequence: eslint fixes first, and Prettier
  // then formats the fixer's rewrite. lint-staged runs glob keys concurrently.
  '*.{ts,tsx,js,jsx,mjs}': ['eslint --cache --fix', 'prettier --cache --write'],
  // Disjoint from the key above, so running the two keys at once never writes one file twice.
  '*.{css,json,yaml,yml,html}': 'prettier --cache --write',
  // Function form, so the staged paths reach only the lint CLI: lint-staged appends them to every
  // string command, and the esbuild build behind `build:linter` would read them as entry points.
  '*.{tscn,tres}': (files) => {
    // A negative fixture exists to error, so linting it would fail every commit that touches one.
    const lintable = files.filter((f) => !isNegativeFixture(f));
    if (lintable.length === 0) return [];
    return ['pnpm build:linter', `node apps/textscene-linter/dist/cli.js ${lintable.map(quote).join(' ')}`];
  },
};
