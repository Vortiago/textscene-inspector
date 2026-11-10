import { describe, expect, it } from 'vitest';
import { outlineStrokeWidthPx } from './textOutline';

describe('the outline stroke (FreeType stroker, text_server_adv.cpp:1383)', () => {
  // `FT_Stroker_Set(stroker, (int)(fd->size.y * 16.0), ...)` takes a 26.6 radius,
  // and `fd->size.y` is the raw `outline_size` (`text_server_adv.h:406-414`). So
  // Godot's default `outline_size` 12 (`label_3d.h:126`) is 192 in 26.6, 3 px of
  // one-sided reach.
  it("gives Label3D's default outline_size a 6 px stroke, a 3 px one-sided radius", () => {
    expect(outlineStrokeWidthPx(12)).toBe(6);
  });

  it('scales linearly with outline_size and never with font_size (outline_size is an absolute pixel quantity)', () => {
    expect(outlineStrokeWidthPx(4)).toBe(2);
    expect(outlineStrokeWidthPx(32)).toBe(16);
    // No font_size parameter exists to pass: the C++ keys the stroker off
    // `fd->size.y` alone.
    expect(outlineStrokeWidthPx.length).toBe(1);
  });

  it('truncates to whole 26.6 steps, as the C++ int cast does', () => {
    // 0.5 * 16 = 8 exactly -> 8/64; 0.53 * 16 = 8.48 -> truncated to 8.
    expect(outlineStrokeWidthPx(0.53)).toBe(outlineStrokeWidthPx(0.5));
  });

  it('is 0 when outline_size is 0 (Godot skips the outline pass entirely, label_3d.cpp:610)', () => {
    expect(outlineStrokeWidthPx(0)).toBe(0);
  });

  it('is 0 for a negative outline_size (defensive; the parser never emits one)', () => {
    expect(outlineStrokeWidthPx(-1)).toBe(0);
  });
});
