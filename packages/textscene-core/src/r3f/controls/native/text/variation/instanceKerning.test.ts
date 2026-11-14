/**
 * The pair kerning a shaper reads from a variable font at a `FontVariation` instance, against the
 * kerning Godot 4.6.3 shapes in `instanceKerning.godot.json`: the shaped advance of a pair's first
 * glyph less its advance alone. HarfBuzz applies the `GPOS` `kern` feature at the instance, with
 * the deltas of its device tables.
 */

import { describe, expect, it } from 'vitest';
import reference from './instanceKerning.godot.json';
import { fixtureFontBytes } from '../sfntOutlines.testkit';
import { openFontOutlines, type SfntOutlines } from '../sfntOutlines';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import { getFontKerningAdjustmentPx, withVariation } from '../fontMetrics';
import { opentypeOf } from '../glyphVariation.testkit';

interface ReferenceKerning {
  font: string;
  /** The `variation_opentype` axes: a numeric key is a tag, any other key a name. */
  opentype: Record<string, number>;
  sizePx: number;
  kerning: Record<string, number>;
}

const rows = (reference as unknown as ReferenceKerning[]).filter(
  (row) => Object.keys(row.opentype).length > 0
);

const RECURSIVE = 'recursive-vf-subset.woff2';

/** A measured kerning no pair here has, so a test sees which face answered. */
const MEASURED_KERNING_UNITS = 99;

const UNITS_PER_EM = 1000;
/** At the face's units per em, a kerning in px equals the kerning in design units. */
const UNIT_SIZE_PX = UNITS_PER_EM;

const canvasFace = createRuntimeFontMetrics({
  hasGlyph: () => true,
  scalars: { unitsPerEm: UNITS_PER_EM, ascent: 800, descent: 200 },
  measureWidthUnits: (text) => (text.length === 2 ? 1000 + MEASURED_KERNING_UNITS : 500),
  cssFontFamily: 'variable-font-test',
});

async function recursiveOutlines(): Promise<SfntOutlines> {
  const outlines = await openFontOutlines(fixtureFontBytes(RECURSIVE));
  if (!outlines) throw new Error(`expected outlines in ${RECURSIVE}, got none`);
  return outlines;
}

describe('the kerning of a variable font at an instance', () => {
  it.each(rows.map((row) => [`${JSON.stringify(row.opentype)}, ${row.sizePx} px`, row] as const))(
    'matches Godot at %s',
    async (_title, row) => {
      const face = withVariation(canvasFace, {
        opentype: opentypeOf(row.opentype),
        outlines: await recursiveOutlines(),
      });
      for (const [pair, kerningPx] of Object.entries(row.kerning)) {
        const ours = getFontKerningAdjustmentPx(face, { char: pair[0]! }, { char: pair[1]! }, row.sizePx);
        expect(ours, pair).toBe(kerningPx);
      }
    }
  );

  it('keeps the measured kerning of a pair the font has no glyph for', async () => {
    const face = withVariation(canvasFace, {
      opentype: opentypeOf({ 1297043023: 0.5 }),
      outlines: await recursiveOutlines(),
    });
    expect(getFontKerningAdjustmentPx(face, { char: 'A' }, { char: '一' }, UNIT_SIZE_PX)).toBe(
      MEASURED_KERNING_UNITS
    );
  });
});
