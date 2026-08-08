/**
 * The `FontMetrics` (`./fontMetrics.ts`) implementation for a runtime-loaded
 * scene font — a `Theme`/`FontFile`'s real bytes, not this repo's baked Open
 * Sans atlas. Pure arithmetic ONLY: every DOM-touching concern (registering
 * the `FontFace`, building a canvas 2D context, calling `measureText`) is
 * injected as `measureWidthUnits` rather than reached for here, so this
 * module is testable with a fake measurer under vitest/happy-dom (which has
 * neither `FontFace` nor a real `CanvasRenderingContext2D` —
 * `sceneFontLoader.ts` is the one DOM-touching module in this font's
 * pipeline, and the only one gated for that reason).
 *
 * ## Why advances/kerning come from canvas, never a hand-parsed `hmtx`/`kern`
 *
 * `sfntTables.ts` deliberately reads ONLY `head`/`hhea` — the two scalars
 * with no reasonable substitute. Per-glyph advances and kerning are a
 * different matter: the registered `FontFace`'s `measureText` already
 * carries the font's REAL `hmtx` advance table AND its full OpenType `GPOS`
 * kerning/mark-positioning, exactly as the browser's own text shaper (not
 * this repo's) computes them — reimplementing a `kern`-table reader would
 * both duplicate that engine and miss `GPOS`, the table modern fonts
 * actually carry (`OPEN_SANS_METRICS`'s own doc: even the vendored Open Sans
 * has no legacy `kern` table at all, only `mark`/`mkmk` GPOS features).
 *
 * Canvas measures a CONTINUOUS width, where Godot's advance is quantized —
 * FreeType's 26.6 grid, and a whole pixel above
 * `fontUsesSubpixelPositioning`'s threshold. That is not a mismatch here:
 * this module reports DESIGN UNITS, exactly like the baked table does
 * (`sceneFontLoader.ts` measures at `fontSizePx === unitsPerEm` so the two
 * coincide), and `fontMetrics.ts`'s `getFontGlyphAdvancePx` applies the same
 * quantization to whatever units it is given. What canvas cannot supply is
 * the font's own INTEGER `hmtx` value: a browser's measurement of a single
 * character is already a float, so the units this reports can carry a
 * fraction the real table does not, and the quantized result can differ by
 * one 1/64 step from what FreeType would compute for the same glyph. That
 * residual is this path's, not the shaper's — see `sceneFontLoader.ts`'s own
 * doc for the fallback path's other measured risk (font-wide ascent/descent,
 * for a font this repo cannot table-parse at all).
 *
 * ## `getGlyphAdvanceUnits` never returns `null`
 *
 * `fontMetrics.ts`'s contract lets an implementation return `null` for "no
 * glyph for this character" so the caller substitutes `averageAdvanceUnits`.
 * A hand-parsed `hmtx`/`cmap` pair could answer that question authoritatively;
 * canvas `measureText` cannot — there is no standard "did this font actually
 * have a glyph, or did the browser substitute one" signal, and whatever
 * canvas measures IS what `fillText` will paint. Returning that measured
 * width always, rather than second-guessing it with `null`, keeps the number
 * this module reports for shaping identical to what the painter draws.
 */
import type { FontMetrics } from './fontMetrics';

/** A width measurement, design units, for an arbitrary string of one or more characters — `sceneFontLoader.ts`'s canvas binding is the only production implementation; tests inject a fake. */
export type DesignUnitWidthFn = (text: string) => number;

/** Representative sample `averageAdvanceUnits` measures over — mixed-case Latin plus digits, the same rough "typical glyph" spirit as a real font's OS/2 `xAvgCharWidth` (which this parser does not read; see `sfntTables.ts`'s own doc for why the table-directory read stays narrow). */
const AVERAGE_ADVANCE_SAMPLE = 'ABCXYZabcxyz0123456789';

export interface RuntimeFontMetricsInput {
  readonly scalars: Pick<FontMetrics, 'unitsPerEm' | 'ascent' | 'descent'>;
  /** Design-unit width of an arbitrary string, via the registered `FontFace` — see this module's own doc for the unit contract (`sceneFontLoader.ts` measures at `fontSizePx === unitsPerEm` so canvas px and design units coincide with no further scale). */
  readonly measureWidthUnits: DesignUnitWidthFn;
  /** The unique CSS font-family this font was registered under (`sceneFontLoader.ts`) — what a canvas-2D painter sets `ctx.font` to. */
  readonly cssFontFamily: string;
}

/** `FontMetrics` for a runtime-loaded scene font, painted via canvas-2D rather than the baked MSDF atlas — `fontMetrics.ts`'s `FontMetricsKind` discriminant `TextRun.tsx` dispatches on. */
export interface CanvasFontMetrics extends FontMetrics {
  readonly kind: 'canvas';
  readonly cssFontFamily: string;
}

/** Narrows a `FontMetrics` to `CanvasFontMetrics` — the ONE thing a painter needs to know before it can canvas-rasterise: which CSS family to set `ctx.font` to. */
export function isCanvasFontMetrics(metrics: FontMetrics | undefined): metrics is CanvasFontMetrics {
  return metrics?.kind === 'canvas';
}

/**
 * Builds a `CanvasFontMetrics` from raw scalars plus an injected width
 * measurer. Memoizes every per-character advance and every measured pair
 * (kerning) it is asked for — `measureWidthUnits` is a real DOM call in
 * production (`sceneFontLoader.ts`) and `textLayout.ts`'s shaper calls
 * `getGlyphAdvanceUnits`/`getKerningAdjustmentUnits` once per character/pair
 * per shape, so an unbounded document (or a re-shape on every keystroke-like
 * rect change) would otherwise re-measure the same characters repeatedly.
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
