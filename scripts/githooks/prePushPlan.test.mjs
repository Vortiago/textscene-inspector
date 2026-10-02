import { describe, expect, it } from 'vitest';
import { planChecks } from './prePushPlan.mjs';

const plan = (changed, deleted = [], isNegativeFixture = () => false, testsBeside = () => []) =>
  planChecks({ changed, deleted, isNegativeFixture, testsBeside }).map((command) => command.join(' '));

/** A negative-fixture predicate over the one fixture `edge-a.tscn`, wherever it sits. */
const isEdgeA = (path) => path.split('/').at(-1) === 'edge-a.tscn';

const STATIC_GATE = ['pnpm format:check', 'pnpm lint', 'pnpm type-check:all', 'pnpm type-check:tests'];

describe('planChecks', () => {
  it('runs nothing for files no check reads', () => {
    expect(plan(['README.md', '.claude/skills/other/SKILL.md', 'docs/adr/0001-x.md'])).toEqual([]);
  });

  it('only checks the formatting of a workflow change, since CI runs the workflow', () => {
    expect(plan(['.github/workflows/release.yml'], ['.github/workflows/old.yml'])).toEqual([
      'pnpm exec prettier --check .github/workflows/release.yml',
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

  it('type-checks and lints a TypeScript change', () => {
    expect(plan(['packages/textscene-core/src/a.ts'])).toEqual([
      'pnpm type-check:all',
      'pnpm type-check:tests',
      'npx eslint packages/textscene-core/src/a.ts',
      'pnpm exec prettier --check packages/textscene-core/src/a.ts',
    ]);
  });

  it('runs the tests beside each changed file once', () => {
    const testsBeside = (path) => (path.endsWith('.test.mjs') ? [path] : [path.replace('.mjs', '.test.mjs')]);
    expect(plan(['scripts/x.mjs', 'scripts/x.test.mjs'], [], undefined, testsBeside)).toEqual([
      'npx eslint scripts/x.mjs scripts/x.test.mjs',
      'pnpm exec prettier --check scripts/x.mjs scripts/x.test.mjs',
      'pnpm exec vitest run scripts/x.test.mjs',
    ]);
  });

  it('runs no tests for a stylesheet', () => {
    expect(plan(['packages/textscene-core/src/a.css'], [], undefined, () => ['never.test.ts'])).toEqual([
      'pnpm exec prettier --check packages/textscene-core/src/a.css',
    ]);
  });

  it('lints a script change without the type checks', () => {
    expect(plan(['scripts/x.mjs'])).toEqual([
      'npx eslint scripts/x.mjs',
      'pnpm exec prettier --check scripts/x.mjs',
    ]);
  });

  it('type-checks a deleted TypeScript file, since its importers break', () => {
    expect(plan([], ['packages/textscene-core/src/gone.ts'])).toEqual([
      'pnpm type-check:all',
      'pnpm type-check:tests',
    ]);
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
