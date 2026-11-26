import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SettledFonts } from './settledFonts';
import { useSettledFonts } from './useSettledFont';

/** Written only by the first test, which the second compares against. */
let firstTestFonts: SettledFonts | null = null;

const fontsWithNoView = () => renderHook(() => useSettledFonts()).result.current;

describe('the settled fonts of a tree with no resource loader', () => {
  it('are one store for the whole of a test', () => {
    firstTestFonts = fontsWithNoView();
    expect(fontsWithNoView()).toBe(firstTestFonts);
  });

  it('are a new store in the next test', () => {
    expect(firstTestFonts).not.toBeNull();
    expect(fontsWithNoView()).not.toBe(firstTestFonts);
  });
});
