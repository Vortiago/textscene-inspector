/**
 * The advances a shaper reads from a variable font at a `FontVariation` instance, against the
 * advances Godot 4.6.3 shapes for each character alone in `instanceAdvances.godot.json`. HarfBuzz
 * reads them unhinted from FreeType at the instance (`text_server_adv.cpp:1915-1950`).
 */

import { describe, expect, it } from 'vitest';
import reference from './instanceAdvances.godot.json';
import { fixtureFontBytes } from '../sfntOutlines.testkit';
import { openFontOutlines, type SfntOutlines } from '../sfntOutlines';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import { getFontGlyphAdvancePx, withVariation, type OpentypeCoordinates } from '../fontMetrics';

interface ReferenceAdvances {
  font: string;
  /** The `variation_opentype` axes: a numeric key is a tag, any other key a name. */
  opentype: Record<string, number>;
  sizePx: number;
  advances: Record<string, number>;
}

const rows = reference as ReferenceAdvances[];

const RECURSIVE = 'recursive-vf-subset.woff2';

/** A measured advance no font here has, so a test sees which face answered. */
const MEASURED_UNITS = 777;

const UNITS_PER_EM: Readonly<Record<string, number>> = {
  'recursive-vf-subset.woff2': 1000,
  'cascadia-code-subset.ttf': 2048,
  'recursive-no-hvar-subset.ttf': 1000,
};

/** The canvas face of `font`, measured at its own units per em as the font loader measures it. */
const canvasFaceOf = (font: string) =>
  createRuntimeFontMetrics({
    scalars: { unitsPerEm: UNITS_PER_EM[font]!, ascent: 800, descent: 200 },
    measureWidthUnits: () => MEASURED_UNITS,
    cssFontFamily: 'variable-font-test',
  });

const opentypeOf = (record: Record<string, number>): OpentypeCoordinates =>
  new Map(Object.entries(record).map(([key, value]) => [/^\d+$/.test(key) ? Number(key) : key, value]));

const outlinesOf = new Map<string, Promise<SfntOutlines>>();
async function fixtureOutlines(font: string): Promise<SfntOutlines> {
  if (!outlinesOf.has(font))
    outlinesOf.set(
      font,
      openFontOutlines(fixtureFontBytes(font)).then((outlines) => {
        if (!outlines) throw new Error(`expected outlines in ${font}, got none`);
        return outlines;
      })
    );
  return outlinesOf.get(font)!;
}

const titleOf = ({ font, opentype, sizePx }: ReferenceAdvances): string =>
  `${font} at ${JSON.stringify(opentype)}, ${sizePx} px`;

describe('the advances of a variable font at an instance', () => {
  const instanceRows = rows.filter((row) => Object.keys(row.opentype).length > 0);

  it.each(instanceRows.map((row) => [titleOf(row), row] as const))(
    'match Godot for %s',
    async (_title, row) => {
      const outlines = await fixtureOutlines(row.font);
      const face = withVariation(canvasFaceOf(row.font), { opentype: opentypeOf(row.opentype), outlines });
      const advances = Object.fromEntries(
        Object.keys(row.advances).map((ch) => [ch, getFontGlyphAdvancePx(face, ch, row.sizePx)])
      );
      expect(advances).toEqual(row.advances);
    }
  );

  it('keep the measured advance of a character the font has no glyph for', async () => {
    const outlines = await fixtureOutlines(RECURSIVE);
    const face = withVariation(canvasFaceOf(RECURSIVE), {
      opentype: opentypeOf({ 1297043023: 1 }),
      outlines,
    });
    expect(face.getGlyphAdvanceUnits('一')).toBe(MEASURED_UNITS);
  });

  it('keep the measured advances at the default instance, which draws as the font itself', async () => {
    const outlines = await fixtureOutlines(RECURSIVE);
    const face = withVariation(canvasFaceOf(RECURSIVE), {
      opentype: opentypeOf({ 1297043023: 0 }),
      outlines,
    });
    expect(face.getGlyphAdvanceUnits('m')).toBe(MEASURED_UNITS);
    expect(face.opentype).toBeUndefined();
  });

  // A `FontVariation` over another finds its face at its own axis values (`font.cpp:3120-3131`), as
  // the bold that the default theme makes of a project font does (`default_theme.cpp:1393-1394`).
  it('keep the measured advances under a variation of their own, which sets no axis', async () => {
    const outlines = await fixtureOutlines(RECURSIVE);
    const atInstance = withVariation(canvasFaceOf(RECURSIVE), {
      opentype: opentypeOf({ 1297043023: 1 }),
      outlines,
    });
    const bold = withVariation(atInstance, { embolden: 1.2 });
    expect(bold.getGlyphAdvanceUnits('m')).toBe(MEASURED_UNITS);
    expect(bold.opentype).toBeUndefined();
  });
});
