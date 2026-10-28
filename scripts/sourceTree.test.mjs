import { describe, expect, it } from 'vitest';
import { isTestFile, isTestSuite } from './sourceTree.mjs';

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

describe('isTestSuite', () => {
  it.each(['a.test.ts', 'b.spec.tsx', 'd.test.mjs', 'e.spec.js'])('treats %s as a test suite', (path) => {
    expect(isTestSuite(path)).toBe(true);
  });

  it.each(['c.testkit.ts', 'linter/testing/kit.ts', 'a.ts', 'contest.ts'])(
    'treats %s as no test suite',
    (path) => {
      expect(isTestSuite(path)).toBe(false);
    }
  );
});
