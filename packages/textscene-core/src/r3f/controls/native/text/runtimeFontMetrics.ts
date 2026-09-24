/**
 * The `FontMetrics` for a runtime-loaded scene font, as pure arithmetic. The DOM calls arrive as
 * the injected `measureWidthUnits`, so the module runs under happy-dom with a fake measurer.
 */

// Advances and kerning come from canvas, not a hand-parsed `hmtx` or `kern`: `measureText` carries
// the real `hmtx` table and the OpenType `GPOS` kerning, which a `kern` reader misses. A measured
// float can differ by one 1/64 step from the integer `hmtx` value after quantisation.
import type { FontMetrics } from './fontMetrics';

/** A width in design units for a string of one or more characters. `sceneFontLoader.ts` binds it to canvas. */
export type DesignUnitWidthFn = (text: string) => number;

/** Mixed-case Latin plus digits, standing in for the OS/2 `xAvgCharWidth` that `sfntTables.ts` does not read. */
const AVERAGE_ADVANCE_SAMPLE = 'ABCXYZabcxyz0123456789';

export interface RuntimeFontMetricsInput {
  readonly scalars: Pick<FontMetrics, 'unitsPerEm' | 'ascent' | 'descent'>;
  /** Measured at `fontSizePx === unitsPerEm`, so canvas px and design units coincide. */
  readonly measureWidthUnits: DesignUnitWidthFn;
  /** The unique CSS font family the font was registered under, which a canvas-2D painter sets `ctx.font` to. */
  readonly cssFontFamily: string;
}

/** `FontMetrics` painted with canvas-2D rather than the baked MSDF atlas. `TextRun.tsx` dispatches on `kind`. */
export interface CanvasFontMetrics extends FontMetrics {
  readonly kind: 'canvas';
  readonly cssFontFamily: string;
}

/** Narrows a `FontMetrics` to `CanvasFontMetrics`, which names the CSS family a painter sets `ctx.font` to. */
export function isCanvasFontMetrics(metrics: FontMetrics | undefined): metrics is CanvasFontMetrics {
  return metrics?.kind === 'canvas';
}

/**
 * Builds a `CanvasFontMetrics` from raw scalars and an injected width measurer. It memoises each
 * advance and pair, because the measurer is a DOM call and the shaper asks once per character and
 * pair on every shape.
 */
export function createRuntimeFontMetrics(input: RuntimeFontMetricsInput): CanvasFontMetrics {
  const { scalars, measureWidthUnits, cssFontFamily } = input;

  const advanceCache = new Map<string, number>();
  const kerningCache = new Map<string, number>();
  let averageAdvanceUnitsCache: number | undefined;

  function measureChar(ch: string): number {
    let width = advanceCache.get(ch);
    if (width === undefined) {
      width = measureWidthUnits(ch);
      advanceCache.set(ch, width);
    }
    return width;
  }

  return {
    kind: 'canvas',
    cssFontFamily,
    unitsPerEm: scalars.unitsPerEm,
    ascent: scalars.ascent,
    descent: scalars.descent,

    // Never `null`: canvas has no "no glyph" signal, and the measured width is what `fillText` paints.
    getGlyphAdvanceUnits(ch: string): number {
      return measureChar(ch);
    },

    getKerningAdjustmentUnits(a: string, b: string): number {
      const key = `${a}\0${b}`;
      let adjustment = kerningCache.get(key);
      if (adjustment === undefined) {
        adjustment = measureWidthUnits(a + b) - measureChar(a) - measureChar(b);
        kerningCache.set(key, adjustment);
      }
      return adjustment;
    },

    get averageAdvanceUnits(): number {
      if (averageAdvanceUnitsCache === undefined) {
        averageAdvanceUnitsCache = measureWidthUnits(AVERAGE_ADVANCE_SAMPLE) / AVERAGE_ADVANCE_SAMPLE.length;
      }
      return averageAdvanceUnitsCache;
    },
  };
}
