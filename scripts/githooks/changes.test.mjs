import { describe, expect, it } from 'vitest';
import { parseNameStatus, planForFiles } from './changes.mjs';
import { STATIC_GATE } from './prePushPlan.mjs';

describe('parseNameStatus', () => {
  it('splits the added and modified paths from the deleted ones', () => {
    expect(parseNameStatus('A\tsrc/new.ts\nM\tREADME.md\nD\tsrc/old.ts')).toEqual({
      changed: ['src/new.ts', 'README.md'],
      deleted: ['src/old.ts'],
    });
  });

  it('returns no paths for empty output', () => {
    expect(parseNameStatus('')).toEqual({ changed: [], deleted: [] });
  });

  it('keeps a path that holds a space', () => {
    expect(parseNameStatus('M\tdocs/a b.md')).toEqual({ changed: ['docs/a b.md'], deleted: [] });
  });
});

describe('planForFiles', () => {
  it('runs the tests that sit beside a changed file on disk', () => {
    const plan = planForFiles({ changed: ['scripts/githooks/changes.mjs'], deleted: [] });
    expect(plan).toContainEqual(['pnpm', 'exec', 'vitest', 'run', 'scripts/githooks/changes.test.mjs']);
  });

  it('runs the static checks over the whole repository when the base is unknown', () => {
    expect(planForFiles(undefined)).toEqual(STATIC_GATE);
  });

  it('runs nothing for files no check reads', () => {
    expect(planForFiles({ changed: [], deleted: ['docs/gone.md'] })).toEqual([]);
  });
});
