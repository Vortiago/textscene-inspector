import { describe, expect, it } from 'vitest';
import { createRuntimeFontMetrics, type DesignUnitWidthFn } from './runtimeFontMetrics';

/** A fake measurer over a tiny, fully-known "font": each character's own width, no ligatures, one deliberate kerning-like pair (AV narrower than A+V). */
function fakeMeasurer(): DesignUnitWidthFn {
  const solo: Record<string, number> = { A: 100, V: 90, x: 50, y: 55 };
  const pairs: Record<string, number> = { AV: 160 }; // narrower than 100 + 90
  return (text: string) => {
    if (text.length === 1) return solo[text] ?? text.length * 60;
    if (pairs[text] !== undefined) return pairs[text];
    // No special-cased multi-char width: sum of each character's own solo width.
    return [...text].reduce((sum, ch) => sum + (solo[ch] ?? 60), 0);
  };
}

describe('createRuntimeFontMetrics', () => {
  it('exposes the injected scalars and a canvas kind/family for the painter to dispatch on', () => {
    const metrics = createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      measureWidthUnits: fakeMeasurer(),
      cssFontFamily: 'scene-font-1',
    });
    expect(metrics.kind).toBe('canvas');
    expect(metrics.cssFontFamily).toBe('scene-font-1');
    expect(metrics.unitsPerEm).toBe(1000);
    expect(metrics.ascent).toBe(950);
    expect(metrics.descent).toBe(250);
  });

  it('getGlyphAdvanceUnits returns the measurer’s own per-character width', () => {
    const metrics = createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      measureWidthUnits: fakeMeasurer(),
      cssFontFamily: 'scene-font-1',
    });
    expect(metrics.getGlyphAdvanceUnits('A')).toBe(100);
    expect(metrics.getGlyphAdvanceUnits('V')).toBe(90);
  });

  it('memoizes per-character measurement: the measurer is called at most once per distinct character', () => {
    let calls = 0;
    const measure: DesignUnitWidthFn = (text) => {
      calls++;
      return text.length * 42;
    };
    const metrics = createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      measureWidthUnits: measure,
      cssFontFamily: 'scene-font-1',
    });
    metrics.getGlyphAdvanceUnits('Q');
    metrics.getGlyphAdvanceUnits('Q');
    metrics.getGlyphAdvanceUnits('Q');
    expect(calls).toBe(1);
  });

  it('getKerningAdjustmentUnits is width(ab) - width(a) - width(b)', () => {
    const metrics = createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      measureWidthUnits: fakeMeasurer(),
      cssFontFamily: 'scene-font-1',
    });
    // 160 - 100 - 90 = -30
    expect(metrics.getKerningAdjustmentUnits('A', 'V')).toBe(-30);
  });

  it('getKerningAdjustmentUnits is 0 for a pair the measurer treats as purely additive', () => {
    const metrics = createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      measureWidthUnits: fakeMeasurer(),
      cssFontFamily: 'scene-font-1',
    });
    // x (50) + y (55) = 105, and the fake measurer has no special pair entry.
    expect(metrics.getKerningAdjustmentUnits('x', 'y')).toBe(0);
  });

  it('averageAdvanceUnits is the mean per-character width of the sample string, measured once and cached', () => {
    let calls = 0;
    const metrics = createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      measureWidthUnits: (text) => {
        calls++;
        return text.length * 60; // every character is exactly 60 units wide
      },
      cssFontFamily: 'scene-font-1',
    });
    const first = metrics.averageAdvanceUnits;
    const second = metrics.averageAdvanceUnits;
    expect(first).toBe(60);
    expect(second).toBe(60);
    expect(calls).toBe(1);
  });

  it('getGlyphAdvanceUnits never returns null: canvas measureText has no reliable "no glyph" signal, so every character gets the browser’s own measured width', () => {
    const metrics = createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      measureWidthUnits: fakeMeasurer(),
      cssFontFamily: 'scene-font-1',
    });
    // A character outside the fake measurer's explicit table still returns
    // its fallback measured value (60 * 1), not null.
    expect(metrics.getGlyphAdvanceUnits('Z')).toBe(60);
  });
});
