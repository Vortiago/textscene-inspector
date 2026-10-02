import { describe, expect, it } from 'vitest';
import { testsBeside } from './colocatedTests.mjs';

describe('testsBeside', () => {
  it('finds the plain and the aspect tests named for the source file', () => {
    const siblings = ['Parser.ts', 'Parser.test.ts', 'Parser.perf.test.ts', 'Parser.view.test.tsx'];
    expect(testsBeside('src/Parser.ts', siblings)).toEqual([
      'src/Parser.test.ts',
      'src/Parser.perf.test.ts',
      'src/Parser.view.test.tsx',
    ]);
  });

  it('skips a test named for a longer stem', () => {
    expect(testsBeside('src/Parser.ts', ['Parser.ts', 'ParserCore.test.ts'])).toEqual([]);
  });

  it('returns a changed test file as its own test', () => {
    expect(testsBeside('scripts/x.test.mjs', ['x.mjs', 'x.test.mjs'])).toEqual(['scripts/x.test.mjs']);
  });

  it('returns nothing for a source file without tests', () => {
    expect(testsBeside('src/types.ts', ['types.ts', 'index.ts'])).toEqual([]);
  });
});
