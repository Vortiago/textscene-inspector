/**
 * The kerning of a variable font whose `GPOS` `FeatureVariations` swap the `kern` lookups, at a
 * `FontVariation` instance, against the kerning Godot 4.6.3 shapes (`instanceGposVariations.godot.json`,
 * from `scripts/fonts/variable-advance-oracle/`). The font is Recursive with a record that adds a lookup
 * kerning AV by -300 units where `CASL` is 0.5 or more (`scripts/fonts/gpos-feature-variations/`).
 */

import { describe, expect, it } from 'vitest';
import reference from './instanceGposVariations.godot.json';
import { getFontKerningAdjustmentPx, withVariation } from '../fontMetrics';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import { openFontOutlines } from '../sfntOutlines';
import { fixtureFontBytes } from '../sfntOutlines.testkit';
import { opentypeOf } from '../glyphVariation.testkit';

interface ReferenceKerning {
  font: string;
  pair?: string;
  sizePx: number;
  opentype: Record<string, number>;
  kerningPx: number;
}

/** The pairs at an instance. Canvas measures the default instance, so only an instance reads the table. */
const instancedPairs = (reference as unknown as ReferenceKerning[]).filter(
  (row) => row.pair !== undefined && Object.keys(row.opentype).length > 0
);

/** HarfBuzz scales a `GPOS` value to whole 1/64 px, where this shaper keeps the scaled float. */
const HARFBUZZ_STEP_PX = 1 / 64;

const canvasFace = createRuntimeFontMetrics({
  hasGlyph: () => true,
  scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
  measureWidthUnits: () => 0,
  cssFontFamily: 'gpos-feature-variations-test',
});

describe('the kerning of a font with GPOS feature variations at an instance', () => {
  it.each(
    instancedPairs.map(
      (row) => [`${row.pair} at ${row.sizePx} px, ${JSON.stringify(row.opentype)}`, row] as const
    )
  )('matches Godot for %s', async (_, row) => {
    const outlines = await openFontOutlines(fixtureFontBytes(row.font));
    if (!outlines) throw new Error(`expected outlines in ${row.font}, got none`);
    const face = withVariation(canvasFace, { opentype: opentypeOf(row.opentype), outlines });

    const ours = getFontKerningAdjustmentPx(face, row.pair![0]!, row.pair![1]!, row.sizePx);

    expect(Math.abs(ours - row.kerningPx)).toBeLessThanOrEqual(HARFBUZZ_STEP_PX);
  });
});
