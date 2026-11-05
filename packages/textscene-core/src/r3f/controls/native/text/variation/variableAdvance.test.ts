/**
 * The advance of a glyph of a variable font at a `FontVariation` instance, as the shaper places it:
 * the default advance plus the `HVAR` delta through FreeType's and HarfBuzz's fixed-point chain, or the
 * phantom points that `gvar` moves in a font with no `HVAR`.
 * It is checked against the advance that Godot 4.6.3 shapes for each character alone
 * (`variableAdvance.godot.json` and `variableAdvanceNoHvar.godot.json`, from `/mnt/project-files/variable-font-1297/oracle.gd`).
 */

import { describe, expect, it } from 'vitest';
import hvarReference from './variableAdvance.godot.json';
import gvarReference from './variableAdvanceNoHvar.godot.json';
import { getFontGlyphAdvancePx, withVariation, type FontMetrics } from '../fontMetrics';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import { openFontOutlines } from '../sfntOutlines';
import { fixtureFontBytes } from '../sfntOutlines.testkit';
import { opentypeOf } from '../glyphVariation.testkit';

interface ReferenceAdvance {
  font: string;
  char: string;
  sizePx: number;
  opentype: Record<string, number>;
  advancePx: number;
}

/** Canvas measures the default instance. It answers 0, so a result that holds it shows the instance is ignored. */
const defaultInstanceMetrics = createRuntimeFontMetrics({
  scalars: { unitsPerEm: 2048, ascent: 2189, descent: 600 },
  measureWidthUnits: () => 0,
  cssFontFamily: 'open-sans-variable',
});

async function metricsAt(glyph: ReferenceAdvance): Promise<FontMetrics> {
  const outlines = await openFontOutlines(fixtureFontBytes(glyph.font));
  return withVariation(defaultInstanceMetrics, { opentype: opentypeOf(glyph.opentype), outlines });
}

const title = (glyph: ReferenceAdvance): string =>
  `${glyph.char} at ${glyph.sizePx} px, variation_opentype ${JSON.stringify(glyph.opentype)}`;

describe.each([
  ['with HVAR', hvarReference as unknown as ReferenceAdvance[]],
  ['without HVAR', gvarReference as unknown as ReferenceAdvance[]],
])('glyph advance of a variable font %s at an instance', (_, advances) => {
  it.each(advances.map((glyph) => [title(glyph), glyph] as const))(
    'matches Godot for %s',
    async (_, glyph) => {
      const metrics = await metricsAt(glyph);

      expect(getFontGlyphAdvancePx(metrics, glyph.char, glyph.sizePx)).toBe(glyph.advancePx);
    }
  );
});
