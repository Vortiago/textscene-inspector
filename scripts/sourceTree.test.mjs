import { describe, expect, it } from 'vitest';
import { isTestFile } from './sourceTree.mjs';

describe('isTestFile', () => {
  it.each(['a.test.ts', 'b.spec.tsx', 'c.testkit.ts', 'd.test.mjs', 'linter/testing/kit.ts'])(
    'treats %s as a test file',
    (path) => {
      expect(isTestFile(path)).toBe(true);
    }
  );

  it.each(['a.ts', 'testingTools.ts', 'contest.ts', 'run.mjs'])('treats %s as production', (path) => {
    expect(isTestFile(path)).toBe(false);
  });
});
