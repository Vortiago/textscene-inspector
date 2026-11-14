/** The version a forest of font readers watches: it moves for a settle of a font the forest awaited, and reads nothing on another. */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { settleFontWork, settleUnrelatedFontLoad } from '../../../testing/settleFontWork';
import { createSettledFonts, type SettledFonts } from './settledFonts';
import { useAwaitedFontsVersion } from './useSettledFont';

const AWAITED_FONT = {};

/** `fonts` with a count of the font versions read through it. */
function countingVersionReads(fonts: SettledFonts): { fonts: SettledFonts; reads: () => number } {
  let reads = 0;
  return {
    fonts: {
      ...fonts,
      fontVersion(font) {
        reads += 1;
        return fonts.fontVersion(font);
      },
    },
    reads: () => reads,
  };
}

describe('useAwaitedFontsVersion', () => {
  it('reads no font version for a settle of a load no awaited font waits on', async () => {
    const counted = countingVersionReads(createSettledFonts());
    const { result } = renderHook(() => useAwaitedFontsVersion(counted.fonts));
    act(() => result.current.track(new Map([[AWAITED_FONT, 0]])));
    const readsBefore = counted.reads();

    await act(() => settleUnrelatedFontLoad(counted.fonts));

    expect(counted.reads()).toBe(readsBefore);
  });

  it('moves once a load an awaited font waits on settles', async () => {
    const fonts = createSettledFonts();
    let settleLoad: (outlines: null) => void = () => undefined;
    const read = () => new Promise<null>((resolve) => (settleLoad = resolve));
    const { pending } = fonts.pendingLoadsOf(() => fonts.peekOutlines({}, read));
    fonts.awaitFont(AWAITED_FONT, pending);
    const { result } = renderHook(() => useAwaitedFontsVersion(fonts));
    act(() => result.current.track(new Map([[AWAITED_FONT, fonts.fontVersion(AWAITED_FONT)]])));

    await act(async () => {
      settleLoad(null);
      await settleFontWork();
    });

    expect(result.current.version).toBe(1);
  });
});
