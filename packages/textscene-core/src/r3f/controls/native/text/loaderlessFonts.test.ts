/** The settled fonts a tree with no resource loader reads start empty in each test, so no test sees another's settles. */
import { describe, expect, it } from 'vitest';
import type { SettledFonts } from './settledFonts';
import { settledFontsOf } from './useSettledFont';

/** Written only by the first test, which the second compares against. */
let firstTestFonts: SettledFonts | null = null;

describe('the loaderless settled fonts', () => {
  it('are one store for the whole of a test', () => {
    firstTestFonts = settledFontsOf(null);
    expect(settledFontsOf(null)).toBe(firstTestFonts);
  });

  it('are a new store in the next test', () => {
    expect(firstTestFonts).not.toBeNull();
    expect(settledFontsOf(null)).not.toBe(firstTestFonts);
  });
});
