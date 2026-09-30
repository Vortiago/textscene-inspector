import { describe, expect, it } from 'vitest';
import { planChecks } from './prePushPlan.mjs';

const plan = (changed, deleted = [], isNegativeFixture = () => false) =>
  planChecks({ changed, deleted, isNegativeFixture }).map((command) => command.join(' '));

/** A negative-fixture predicate over the one fixture `edge-a.tscn`, wherever it sits. */
const isEdgeA = (path) => path.split('/').at(-1) === 'edge-a.tscn';

describe('planChecks', () => {
  it('runs nothing for files no check reads', () => {
    expect(plan(['README.md', '.claude/skills/other/SKILL.md', 'docs/adr/0001-x.md'])).toEqual([]);
  });

  it('runs nothing for a workflow change, which only CI reads', () => {
    expect(plan(['.github/workflows/release.yml'], ['.github/workflows/old.yml'])).toEqual([]);
  });

  it('runs the full gate when the toolchain changes', () => {
    for (const path of ['package.json', 'apps/textscene-web/package.json', 'pnpm-lock.yaml', 'githooks/pre-push',
      'packages/textscene-core/tsconfig.tests.json', 'eslint.config.js', 'lint-staged.config.mjs']) {
      expect(plan([path])).toEqual(['pnpm validate']);
    }
  });

  it('runs the full gate when the negative-fixture loader both hooks read changes', () => {
    expect(plan(['scripts/githooks/negativeFixtures.mjs'])).toEqual(['pnpm validate']);
  });

  it('type-checks, lints and runs the related tests for a TypeScript change', () => {
    expect(plan(['packages/textscene-core/src/a.ts'])).toEqual([
      'pnpm type-check:all',
      'pnpm type-check:tests',
      'npx eslint packages/textscene-core/src/a.ts',
      'pnpm exec vitest related --run packages/textscene-core/src/a.ts',
    ]);
  });

  it('lints and tests a script change without the type checks', () => {
    expect(plan(['scripts/x.mjs'])).toEqual(['npx eslint scripts/x.mjs', 'pnpm exec vitest related --run scripts/x.mjs']);
  });

  it('type-checks a deleted TypeScript file, since its importers break', () => {
    expect(plan([], ['packages/textscene-core/src/gone.ts'])).toEqual(['pnpm type-check:all', 'pnpm type-check:tests']);
  });

  it('lints a changed scene with the built linter', () => {
    expect(plan(['scenes/fixtures/unit-a.tscn'])).toEqual(['pnpm build:linter', 'pnpm lint:tscn scenes/fixtures/unit-a.tscn']);
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
