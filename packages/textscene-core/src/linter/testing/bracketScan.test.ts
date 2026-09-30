/** The source scanners on synthetic text, independent of any file they read. */

import { describe, expect, it } from 'vitest';
import { balancedGroup, topLevelParts } from './bracketScan.js';

describe('topLevelParts and balancedGroup', () => {
  it('splits on top-level commas only', () => {
    expect(topLevelParts("node, 'a, b', f(1, 2)").map((s) => s.trim())).toEqual([
      'node',
      "'a, b'",
      'f(1, 2)',
    ]);
  });

  it('reads to the MATCHING bracket, not the first one', () => {
    expect(balancedGroup('call(a, f(b), c) tail', 4)).toBe('a, f(b), c');
  });
});
