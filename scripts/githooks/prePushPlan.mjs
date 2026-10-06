/**
 * The checks a push needs, from the files it changes. The push runs the static checks and the
 * tests beside each changed file. CI runs the whole suite, the builds and the packaging on each
 * pull request.
 */

/**
 * A file whose change can break any static check, so the push runs them over the whole
 * repository. A workflow file is not one: locally only the format check reads it, and CI runs it
 * on the pull request. The negative-fixture loader is one: both hooks read it to decide which
 * scenes they skip.
 */
const TOOLCHAIN =
  /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|eslint\.config\.js|prettier\.config\.mjs|\.prettierignore|lint-staged\.config\.mjs|vitest\.(?:config|shared)\.ts|githooks\/.*|scripts\/githooks\/negativeFixtures\.mjs)$|(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|vitest\.config\.ts)$/;

const TYPED = /\.(?:ts|tsx)$/;
const TESTABLE = /\.(?:ts|tsx|js|mjs|cjs)$/;
const LINTED_CODE = /\.(?:ts|tsx|js|mjs|cjs)$/;
/** What Prettier formats here. Markdown is not: `.prettierignore` leaves it to the STE rules. */
const FORMATTED = /\.(?:ts|tsx|js|mjs|cjs|css|json|ya?ml|html)$/;
const SCENE = /\.(?:tscn|tres)$/;
/** Markdown that the generated-docs checks read or write. */
const GENERATED_DOCS_INPUT = /(?:^|\/)comparison\.md$|^docs\/comparison\//;
const VENDORED = /^\.claude\/(?:skills\/conventional-commits\/|rules\/|agents\/ste-review\.md$)/;
/**
 * The mocha suites that run inside a VS Code window. Vitest excludes them and finds no test file
 * in them, which fails the run. CI runs them in its integration and installed-package jobs.
 */
const EXTENSION_HOST_SUITE = /^apps\/textscene-vscode\/src\/test\//;

/**
 * The repository-wide static checks, in the order of the CI `static` job: fastest first.
 * `type-check:all` builds the packages, which `type-check:tests` and the docs checks read.
 */
export const STATIC_GATE = [
  ['pnpm', 'format:check'],
  ['pnpm', 'lint'],
  ['pnpm', 'type-check:all'],
  ['pnpm', 'type-check:tests'],
];

/**
 * The commands, in order, for a push that changes `changed` (paths that still exist) and deletes
 * `deleted`. Each command is an argv array. An empty list means the push needs no check.
 * `isNegativeFixture` tells a scene that exists to error, which the plan does not lint.
 * `testsBeside` gives the test files beside a changed file, which the plan runs.
 */
export function planChecks({ changed, deleted, isNegativeFixture, testsBeside }) {
  const all = [...changed, ...deleted];
  const tests = [...new Set(changed.filter((path) => TESTABLE.test(path)).flatMap(testsBeside))].filter(
    (path) => !EXTENSION_HOST_SUITE.test(path)
  );
  const runTests = tests.length > 0 ? [['pnpm', 'exec', 'vitest', 'run', ...tests]] : [];
  if (all.some((path) => TOOLCHAIN.test(path))) return [...STATIC_GATE, ...runTests];

  const plan = [];
  // `type-check:all` builds the packages first, which the generated-docs checks also need.
  const typeChecks = all.some((path) => TYPED.test(path));
  if (typeChecks) plan.push(['pnpm', 'type-check:all'], ['pnpm', 'type-check:tests']);
  const linted = changed.filter((path) => LINTED_CODE.test(path));
  if (linted.length > 0) plan.push(['npx', 'eslint', '--cache', ...linted]);
  const formatted = changed.filter((path) => FORMATTED.test(path));
  if (formatted.length > 0) plan.push(['pnpm', 'exec', 'prettier', '--cache', '--check', ...formatted]);
  plan.push(...runTests);

  const scenes = changed.filter((path) => SCENE.test(path) && !isNegativeFixture(path));
  if (scenes.length > 0) plan.push(['pnpm', 'build:linter'], ['pnpm', 'lint:tscn', ...scenes]);

  if (all.some((path) => GENERATED_DOCS_INPUT.test(path))) {
    if (!typeChecks) plan.push(['pnpm', '--filter', '@textscene/core', 'build']);
    plan.push(
      ['pnpm', 'docs:lint-sections', '--check'],
      ['pnpm', 'docs:index', '--check'],
      ['pnpm', 'docs:gallery', '--check']
    );
  }
  if (all.some((path) => VENDORED.test(path))) {
    plan.push(['node', 'scripts/vendor/verktoykasse.mjs', '--check']);
  }
  return plan;
}
