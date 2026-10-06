import { describe, expect, it } from 'vitest';
import { planForFiles } from './planForFiles.mjs';
import { STATIC_GATE } from './prePushPlan.mjs';

describe('planForFiles', () => {
  it('runs the tests that sit beside a changed file on disk', () => {
    const plan = planForFiles({ changed: ['scripts/githooks/changedFiles.mjs'], deleted: [] });
    expect(plan).toContainEqual(['pnpm', 'exec', 'vitest', 'run', 'scripts/githooks/changedFiles.test.mjs']);
  });

  it('runs the static checks over the whole repository when the base is unknown', () => {
    expect(planForFiles(undefined)).toEqual(STATIC_GATE);
  });

  it('runs nothing for files no check reads', () => {
    expect(planForFiles({ changed: [], deleted: ['docs/gone.md'] })).toEqual([]);
  });
});
