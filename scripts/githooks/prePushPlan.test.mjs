import { describe, expect, it } from 'vitest';
import { planChecks } from './prePushPlan.mjs';

/** A file the real-Godot tests read, in these cases: any file of the harness folder. */
const isEngineTestInput = (path) => path.startsWith('scripts/godot-ref/');

const plan = (
  changed,
  deleted = [],
  isNegativeFixture = () => false,
  testsBeside = () => [],
  hasEngine = false
) =>
  planChecks({
    changed,
    deleted,
    isNegativeFixture,
    testsBeside,
    isEngineTestInput,
    hasEngine: () => hasEngine,
  }).map((command) => command.join(' '));

/** The plan on a host that has, or lacks, Godot and `xvfb-run`. */
const planOnHost = (hasEngine, changed, deleted, testsBeside) =>
  plan(changed, deleted, undefined, testsBeside, hasEngine);

/** A negative-fixture predicate over the one fixture `edge-a.tscn`, wherever it sits. */
const isEdgeA = (path) => path.split('/').at(-1) === 'edge-a.tscn';

const STATIC_GATE = [
  'pnpm format:check',
  'pnpm lint',
  'pnpm check:dep-scripts',
  'pnpm canonical --check',
  'pnpm type-check:all',
  'pnpm type-check:tests',
];

/** The packages whose tests project already type-checks every source file. */
const COVERED_BY_TESTS =
  '--filter !./packages/textscene-core --filter !./packages/textscene-dev-kit --filter !./apps/textscene-linter';

/** The type checks of the packages in `dirs` and of their dependents. */
const typeChecks = (...dirs) => {
  const filters = dirs.map((dir) => `--filter ...{./${dir}}`).join(' ');
  return [
    'pnpm --filter ./packages/* build',
    `pnpm ${filters} ${COVERED_BY_TESTS} type-check`,
    `pnpm ${filters} type-check:tests`,
  ];
};

const EXPORT_SCAN = 'pnpm exec vitest run scripts/testOnlyExports.test.mjs';

const ENGINE_TESTS = 'pnpm test:godot-ref';

describe('planChecks', () => {
  it('runs the real-Godot tests last for a change to a file they read, on a host with the engine', () => {
    expect(planOnHost(true, ['scripts/godot-ref/run.mjs']).at(-1)).toBe(ENGINE_TESTS);
    expect(planOnHost(true, ['scripts/godot-ref/scenes/preview-lighting.tscn']).at(-1)).toBe(ENGINE_TESTS);
    expect(planOnHost(true, [], ['scripts/godot-ref/lavapipe.mjs'])).toEqual([ENGINE_TESTS]);
  });

  it('leaves the real-Godot tests out on a host without the engine, where they cannot run', () => {
    expect(planOnHost(false, ['scripts/godot-ref/run.mjs'])).not.toContain(ENGINE_TESTS);
  });

  it('leaves the real-Godot tests out for a change to a file they do not read (edge case)', () => {
    expect(planOnHost(true, ['scripts/godot-reference.mjs', 'scripts/visual/run.mjs'])).not.toContain(
      ENGINE_TESTS
    );
  });

  it('keeps a real-Godot test file out of the unit run, whose projects exclude it', () => {
    const engineFile = 'scripts/godot-ref/run.engine.test.mjs';
    const commands = planOnHost(true, [engineFile], [], (path) => [path]);
    expect(commands.filter((command) => command.includes('vitest run'))).toEqual([]);
    expect(commands.at(-1)).toBe(ENGINE_TESTS);
  });

  it('runs the real-Godot tests after the static checks when the toolchain changes too', () => {
    expect(planOnHost(true, ['package.json', 'scripts/godot-ref/run.mjs'])).toEqual([
      ...STATIC_GATE,
      ENGINE_TESTS,
    ]);
  });

  it('runs the test-only export scan when a source file of core changes or goes', () => {
    expect(plan(['packages/textscene-core/src/r3f/ySort.ts'])).toContain(EXPORT_SCAN);
    expect(plan([], ['packages/textscene-core/src/r3f/ySort.tsx'])).toContain(EXPORT_SCAN);
  });

  it('runs the scan in the one test run, with the tests beside the changed file', () => {
    const beside = () => ['packages/textscene-core/src/r3f/ySort.test.ts'];
    expect(plan(['packages/textscene-core/src/r3f/ySort.ts'], [], undefined, beside)).toContain(
      'pnpm exec vitest run packages/textscene-core/src/r3f/ySort.test.ts scripts/testOnlyExports.test.mjs'
    );
  });

  it('leaves the scan out for a change outside the source of core (edge case)', () => {
    expect(plan(['apps/textscene-web/src/App.tsx'])).not.toContain(EXPORT_SCAN);
    expect(plan(['packages/textscene-core/README.md'])).not.toContain(EXPORT_SCAN);
  });

  it('runs nothing for files no check reads', () => {
    expect(plan(['README.md', '.claude/skills/other/SKILL.md', 'docs/adr/0001-x.md'])).toEqual([]);
  });

  it('only checks the formatting of a workflow change, since CI runs the workflow', () => {
    expect(plan(['.github/workflows/release.yml'], ['.github/workflows/old.yml'])).toEqual([
      'pnpm exec prettier --cache --check .github/workflows/release.yml',
    ]);
  });

  it('runs the static checks over the whole repository when the toolchain changes', () => {
    for (const path of [
      'package.json',
      'apps/textscene-web/package.json',
      'pnpm-lock.yaml',
      'githooks/pre-push',
      'packages/textscene-core/tsconfig.tests.json',
      'eslint.config.js',
      'prettier.config.mjs',
      '.prettierignore',
      'lint-staged.config.mjs',
    ]) {
      expect(plan([path])).toEqual(STATIC_GATE);
    }
  });

  it('runs the static checks over the whole repository when the negative-fixture loader changes', () => {
    expect(plan(['scripts/githooks/negativeFixtures.mjs'])).toEqual(STATIC_GATE);
  });

  it('runs the tests beside a toolchain change after the static checks', () => {
    const testsBeside = () => ['scripts/githooks/prePushPlan.test.mjs'];
    expect(
      plan(['githooks/pre-push', 'scripts/githooks/prePushPlan.mjs'], [], undefined, testsBeside)
    ).toEqual([...STATIC_GATE, 'pnpm exec vitest run scripts/githooks/prePushPlan.test.mjs']);
  });

  it('type-checks and lints a TypeScript change', () => {
    expect(plan(['apps/textscene-web/src/a.ts'])).toEqual([
      ...typeChecks('apps/textscene-web'),
      'npx eslint --cache apps/textscene-web/src/a.ts',
      'pnpm exec prettier --cache --check apps/textscene-web/src/a.ts',
      'pnpm canonical --check',
    ]);
  });

  it('runs the tests beside each changed file once', () => {
    const testsBeside = (path) => (path.endsWith('.test.mjs') ? [path] : [path.replace('.mjs', '.test.mjs')]);
    expect(plan(['scripts/x.mjs', 'scripts/x.test.mjs'], [], undefined, testsBeside)).toEqual([
      'npx eslint --cache scripts/x.mjs scripts/x.test.mjs',
      'pnpm exec prettier --cache --check scripts/x.mjs scripts/x.test.mjs',
      'pnpm canonical --check',
      'pnpm exec vitest run scripts/x.test.mjs',
    ]);
  });

  it.each([
    'apps/textscene-vscode/src/test/integration/suite/a.test.ts',
    'apps/textscene-vscode/src/test/installed/suite/a.test.ts',
  ])('leaves the extension host suite %s to CI, since vitest excludes it', (suite) => {
    expect(plan([suite], [], undefined, (path) => [path])).toEqual([
      ...typeChecks('apps/textscene-vscode'),
      `npx eslint --cache ${suite}`,
      `pnpm exec prettier --cache --check ${suite}`,
      'pnpm canonical --check',
    ]);
  });

  it('runs no tests for a stylesheet', () => {
    expect(plan(['packages/textscene-core/src/a.css'], [], undefined, () => ['never.test.ts'])).toEqual([
      'pnpm exec prettier --cache --check packages/textscene-core/src/a.css',
    ]);
  });

  it('lints a script change without the type checks', () => {
    expect(plan(['scripts/x.mjs'])).toEqual([
      'npx eslint --cache scripts/x.mjs',
      'pnpm exec prettier --cache --check scripts/x.mjs',
      'pnpm canonical --check',
    ]);
  });

  it('reads no @canonical tags for code outside the roots the list reads', () => {
    expect(plan(['tools/x.mjs'])).toEqual([
      'npx eslint --cache tools/x.mjs',
      'pnpm exec prettier --cache --check tools/x.mjs',
    ]);
  });

  it('runs only the tests type check of a package whose tests project covers its sources', () => {
    const [, sources, tests] = plan([], ['packages/textscene-core/src/gone.ts']);
    expect(sources).toContain('--filter !./packages/textscene-core');
    expect(tests).not.toContain('!./packages/textscene-core');
  });

  it('type-checks a deleted TypeScript file, since its importers break', () => {
    expect(plan([], ['apps/textscene-web/src/gone.ts'])).toEqual(typeChecks('apps/textscene-web'));
  });

  it('type-checks each package with a TypeScript change once', () => {
    expect(
      plan(
        [],
        ['apps/textscene-web/src/a.ts', 'apps/textscene-linter/src/b.ts', 'apps/textscene-web/src/c.tsx']
      )
    ).toEqual(typeChecks('apps/textscene-web', 'apps/textscene-linter'));
  });

  it('type-checks the whole repository for a TypeScript file outside a package', () => {
    expect(plan([], ['tools/a.ts'])).toEqual(['pnpm type-check:all', 'pnpm type-check:tests']);
  });

  it('lints a changed scene with the built linter', () => {
    expect(plan(['scenes/fixtures/unit-a.tscn'])).toEqual([
      'pnpm build:linter',
      'pnpm lint:tscn scenes/fixtures/unit-a.tscn',
    ]);
  });

  it('skips a negative fixture, which exists to error', () => {
    expect(plan(['scenes/fixtures/nested/edge-a.tscn'], [], isEdgeA)).toEqual([]);
  });

  it('lints the other scenes of a push that also changes a negative fixture', () => {
    expect(plan(['scenes/fixtures/edge-a.tscn', 'scenes/fixtures/unit-a.tscn'], [], isEdgeA)).toEqual([
      'pnpm build:linter',
      'pnpm lint:tscn scenes/fixtures/unit-a.tscn',
    ]);
  });

  it('builds core before the generated-docs checks when nothing else built it', () => {
    expect(plan(['packages/textscene-core/src/nodes/3d/x/comparison.md'])).toEqual([
      'pnpm --filter @textscene/core build',
      'pnpm docs:lint-sections --check',
      'pnpm docs:index --check',
      'pnpm docs:gallery --check',
    ]);
  });

  it('checks a vendored copy against its stamp', () => {
    expect(plan(['.claude/rules/ste-rules.md'])).toEqual(['node scripts/vendor/verktoykasse.mjs --check']);
  });
});
