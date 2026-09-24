import { describe, expect, it } from 'vitest';
import { planChecks } from './prePushPlan.mjs';

const plan = (changed, deleted = []) => planChecks({ changed, deleted }).map((command) => command.join(' '));

describe('planChecks', () => {
  it('runs nothing for files no check reads', () => {
    expect(plan(['README.md', '.claude/skills/other/SKILL.md', 'docs/adr/0001-x.md'])).toEqual([]);
  });

  it('runs the full gate when the toolchain changes', () => {
    for (const path of ['package.json', 'apps/textscene-web/package.json', 'pnpm-lock.yaml', 'githooks/pre-push',
      'packages/textscene-core/tsconfig.tests.json', '.github/workflows/ci.yml', 'eslint.config.js']) {
      expect(plan([path])).toEqual(['pnpm validate']);
    }
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
