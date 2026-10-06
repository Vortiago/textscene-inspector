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
/** The workspace package a path sits in, from the `packages` globs of `pnpm-workspace.yaml`. */
const WORKSPACE_PACKAGE = /^(?:packages|apps)\/[^/]+(?=\/)/;
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
 * The type checks of every package. `type-check:all` builds the packages, which
 * `type-check:tests` and the docs checks read.
 */
const REPOSITORY_TYPE_CHECKS = [
  ['pnpm', 'type-check:all'],
  ['pnpm', 'type-check:tests'],
];

/** The repository-wide static checks, in the order of the CI `static` job: fastest first. */
export const STATIC_GATE = [['pnpm', 'format:check'], ['pnpm', 'lint'], ...REPOSITORY_TYPE_CHECKS];

/**
 * The packages whose `type-check:tests` project holds every file of their `type-check` project,
 * with options no looser, so the push runs only the tests one. CI runs both. The web previewer is
 * not one: its tests project widens `rootDir`. The extension is not one: its unit-tests project
 * leaves out `src/test/`.
 */
const TESTS_PROJECT_COVERS_SOURCES = [
  'packages/textscene-core',
  'packages/textscene-dev-kit',
  'apps/textscene-linter',
];

/**
 * The type checks for the typed files `typed`: those of each package that holds one, and of every
 * package that depends on it. A typed file outside a package type-checks the whole repository.
 * The packages build first, because each dependent reads the declarations a build emits.
 */
function typeChecksFor(typed) {
  const packageDirs = typed.map((path) => WORKSPACE_PACKAGE.exec(path)?.[0]);
  if (packageDirs.includes(undefined)) return REPOSITORY_TYPE_CHECKS;
  const filters = [...new Set(packageDirs)].flatMap((dir) => ['--filter', `...{./${dir}}`]);
  const coveredByTests = TESTS_PROJECT_COVERS_SOURCES.flatMap((dir) => ['--filter', `!./${dir}`]);
  return [
    ['pnpm', '--filter', './packages/*', 'build'],
    ['pnpm', ...filters, ...coveredByTests, 'type-check'],
    ['pnpm', ...filters, 'type-check:tests'],
  ];
}

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
  // The type checks build the packages first, which the generated-docs checks also need.
  const typed = all.filter((path) => TYPED.test(path));
  const typeChecks = typed.length > 0;
  if (typeChecks) plan.push(...typeChecksFor(typed));
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
