import { describe, expect, it } from 'vitest';
import { ftVectorLength } from './ftVector';

/** `[x, y, length]` as FreeType 2.14's `FT_Vector_Length` answers, built from Godot 4.6.3's `thirdparty/freetype`. */
const FREETYPE_LENGTHS = [
  [3, 4, 5],
  [65536, 65536, 92682],
  [32768, 16384, 36636],
  [-74565, 26505, 79136],
  [16384, 0, 16384],
  [0, -8192, 8192],
  [1, 1, 1],
  [32767, 32767, 46340],
  [1073741823, 19088743, 1073911486],
  [-5, -12, 13],
  [3072, 6656, 7331],
] as const;

describe('ftVectorLength', () => {
  it.each(FREETYPE_LENGTHS)('measures (%i, %i) as %i, as FreeType does', (x, y, length) => {
    expect(ftVectorLength({ x, y })).toBe(length);
  });
});
