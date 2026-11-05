/**
 * A variable font whose variation tables run past its bytes: each reader at an instance falls back to
 * the default instance, as `orOnRangeError` does for the font's other tables.
 */
import { describe, expect, it, vi } from 'vitest';
import { openFontOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

vi.mock('./variation/fontInstance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./variation/fontInstance')>()),
  fontInstanceOf: () => {
    throw new RangeError('Offset is outside the bounds of the DataView');
  },
}));

const MONO_INSTANCE = new Map([[1297043023, 1]]);

describe('openFontOutlines — variation tables past the bytes', () => {
  it('reads no advance at the instance, in place of a throw', async () => {
    const outlines = await openFontOutlines(fixtureFontBytes('recursive-vf-subset.woff2'));
    const glyphIndex = outlines!.glyphIndex('m'.codePointAt(0)!);
    expect(outlines!.advanceAtInstance!(glyphIndex, 16, MONO_INSTANCE)).toBeNull();
  });
});
