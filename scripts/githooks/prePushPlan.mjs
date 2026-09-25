/**
 * The checks a push needs, from the files it changes. CI runs the full gate on each pull request,
 * so the pre-push hook runs only what the change can break. A change to the toolchain runs the full gate.
 */

/** A file whose change can break any check, so the push runs the full `pnpm validate`. */
const TOOLCHAIN =
  /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|eslint\.config\.js|lint-staged\.config\.mjs|vitest\.(?:config|shared)\.ts|githooks\/.*|\.github\/workflows\/.*)$|(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|vitest\.config\.ts)$/;

const CODE = /\.(?:ts|tsx|js|mjs|cjs|css)$/;
const TYPED = /\.(?:ts|tsx)$/;
const LINTED_CODE = /\.(?:ts|tsx|js|mjs|cjs)$/;
const SCENE = /\.(?:tscn|tres)$/;
/** Markdown that the generated-docs checks read or write. */
const GENERATED_DOCS_INPUT = /(?:^|\/)comparison\.md$|^docs\/comparison\//;
const VENDORED = /^\.claude\/(?:skills\/conventional-commits\/|rules\/|agents\/ste-review\.md$)/;

/**
 * The commands, in order, for a push that changes `changed` (paths that still exist) and deletes
 * `deleted`. Each command is an argv array. An empty list means the push needs no check.
 */
export function planChecks({ changed, deleted }) {
  const all = [...changed, ...deleted];
  if (all.some((path) => TOOLCHAIN.test(path))) return [['pnpm', 'validate']];

  const plan = [];
  const code = changed.filter((path) => CODE.test(path));
  // `type-check:all` builds the packages first, which the generated-docs checks also need.
  const typeChecks = all.some((path) => TYPED.test(path));
  if (typeChecks) plan.push(['pnpm', 'type-check:all'], ['pnpm', 'type-check:tests']);
  const linted = changed.filter((path) => LINTED_CODE.test(path));
  if (linted.length > 0) plan.push(['npx', 'eslint', ...linted]);
  if (code.length > 0) plan.push(['pnpm', 'exec', 'vitest', 'related', '--run', ...code]);

  const scenes = changed.filter((path) => SCENE.test(path));
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
