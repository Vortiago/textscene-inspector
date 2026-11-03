/**
 * The hinted outline of a TrueType glyph, as FreeType's v40 interpreter leaves it when Godot loads
 * the glyph (`text_server_adv.cpp:3613`), against the contours of Godot 4.6.3 in `hinting.godot.json`.
 */

import { describe, expect, it } from 'vitest';
import reference from './hinting.godot.json';
import {
  readerContours,
  referenceGlyphTitle,
  referencePoints,
  type ReferenceGlyph,
} from '../glyphVariation.testkit';
import { openFontOutlines } from '../sfntOutlines';
import { fixtureFontBytes } from '../sfntOutlines.testkit';
import { openSfnt } from '../sfntTables';

const hintedGlyphs = reference as ReferenceGlyph[];
const cases = hintedGlyphs.map((glyph) => [referenceGlyphTitle(glyph), glyph] as const);

describe('hinted TrueType glyph contours', () => {
  it.each(cases)('match Godot for %s', async (_, glyph) => {
    const contours = await readerContours(glyph);

    expect(referencePoints(contours.points)).toEqual(glyph.points);
    expect(contours.contourEnds).toEqual(glyph.contourEnds);
  });
});

const FONT = 'open-sans-semibold-subset.ttf';
/** DEBUG, which stops a program with an error. */
const DEBUG = 0x4f;
/** SVTCA[y], PUSHB[0] 2, MDAP[rnd] and DEBUG: the program moves point 2 to the grid, then fails. */
const MOVE_THEN_FAIL = [0x00, 0xb0, 0x02, 0x2f, DEBUG];

/** A copy of the fixture font with `patch` applied to its bytes. */
function patchedFont(patch: (bytes: Uint8Array, offsetOf: (tag: string) => number) => void): ArrayBuffer {
  const font = fixtureFontBytes(FONT).slice(0);
  const { tables } = openSfnt(font)!;
  patch(new Uint8Array(font), (tag) => tables.get(tag)!.offset);
  return font;
}

/** The offset in the font of a simple glyph's instructions: after the header, the contour ends and their length. */
function glyphInstructionsOffset(font: ArrayBuffer, glyphIndex: number): number {
  const { dv, tables } = openSfnt(font)!;
  const isLongLoca = dv.getInt16(tables.get('head')!.offset + 50, false) === 1;
  const loca = tables.get('loca')!.offset;
  const glyph =
    tables.get('glyf')!.offset +
    (isLongLoca
      ? dv.getUint32(loca + glyphIndex * 4, false)
      : dv.getUint16(loca + glyphIndex * 2, false) * 2);
  const contourCount = dv.getInt16(glyph, false);
  return glyph + 10 + 2 * contourCount + 2;
}

async function hYs(font: ArrayBuffer, sizePx: number): Promise<number[]> {
  const outlines = (await openFontOutlines(font))!;
  const contours = outlines.glyphContours(outlines.glyphIndex('H'.codePointAt(0)!), sizePx)!;
  return contours.points.map(({ y }) => y + 0);
}

describe('a TrueType program that fails', () => {
  it('keeps the moves a glyph program made before its error, as Godot 4.6.3 does', async () => {
    const plain = (await openFontOutlines(fixtureFontBytes(FONT)))!;
    const hIndex = plain.glyphIndex('H'.codePointAt(0)!);
    const font = patchedFont((bytes) =>
      bytes.set(MOVE_THEN_FAIL, glyphInstructionsOffset(bytes.buffer as ArrayBuffer, hIndex))
    );

    expect(await hYs(font, 64)).toEqual([
      0, 0, -21, -20.625, 0, 0, -45.6875, -45.6875, -27, -27, -45.6875, -45.6875,
    ]);
  });

  it.each(['fpgm', 'prep'])('loads no glyph when the %s program fails, as Godot 4.6.3 does', async (tag) => {
    const font = patchedFont((bytes, offsetOf) => {
      bytes[offsetOf(tag)] = DEBUG;
    });
    const outlines = (await openFontOutlines(font))!;

    expect(outlines.glyphContours(outlines.glyphIndex('H'.codePointAt(0)!), 64)).toBeNull();
  });
});
