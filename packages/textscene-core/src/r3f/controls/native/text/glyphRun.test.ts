/**
 * `shapeRun`: the clusters of a run and the glyphs each draws as the `GSUB` of a font shapes the run
 * whole, read off the bundled Open Sans and the contextual `rvrn` fixture.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { defaultSubstitution } from './autofit/openTypeFeatures';
import { openFontContainer } from './fontContainer';
import { characterRunShaping, sfntRunShapingFace, shapeRun, type RunShapingFace } from './glyphRun';
import { fileBytes } from '../../../../resources/testing/fileBytes';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { OUTLINE_TABLE_TAGS } from './sfntTables';

/** The glyphs Godot 4.6.3 gives these runs (`shapedRuns.godot.json`). */
const OPEN_SANS_FI = 907;
const OPEN_SANS_FFI = 909;
const RECURSIVE_SWAPPED_L = 337;

async function faceOf(bytes: ArrayBuffer): Promise<RunShapingFace> {
  const sfnt = await openFontContainer(bytes, OUTLINE_TABLE_TAGS);
  return sfntRunShapingFace(sfnt!)!;
}

const openSans = () =>
  faceOf(fileBytes(join(import.meta.dirname, '../../../../../assets/fonts/OpenSans_SemiBold.woff2')));

const shape = (face: RunShapingFace, chars: readonly string[]) =>
  shapeRun(face, chars, defaultSubstitution(face.gsub!));

/** The clusters of `text` that draw a glyph a lookup gave, with that glyph. */
const substitutedOf = (face: RunShapingFace, text: string) =>
  shape(face, [...text]).flatMap(({ start, end, glyphs }) =>
    glyphs.filter((glyph) => glyph.isSubstituted).map(({ glyph }) => ({ start, end, glyph }))
  );

describe('shapeRun', () => {
  it('draws a ligature as one cluster of its characters', async () => {
    expect(substitutedOf(await openSans(), 'office')).toEqual([{ start: 1, end: 4, glyph: OPEN_SANS_FFI }]);
  });

  it('gives a ligature the advance of its own glyph', async () => {
    const face = await openSans();
    const [cluster] = shape(face, [...'fi']);
    expect(cluster!.glyphs).toMatchObject([
      { glyph: OPEN_SANS_FI, advanceUnits: face.advanceUnits(OPEN_SANS_FI) },
    ]);
  });

  it('keeps the place of an empty string, which holds no character', async () => {
    const face = await openSans();
    const clusters = shape(face, ['x', '', 'f', 'i']);
    expect(clusters.map(({ start, end }) => [start, end])).toEqual([
      [0, 1],
      [2, 4],
    ]);
  });

  it('draws the glyph cmap gives each character of a run the lookups do not change', async () => {
    const clusters = shape(await openSans(), [...'ft']);
    expect(clusters.flatMap(({ glyphs }) => glyphs.map((glyph) => glyph.isSubstituted))).toEqual([
      false,
      false,
    ]);
  });

  it('joins a mark to the cluster of its base, as a glyph with no advance of its own', async () => {
    const [cluster] = shape(await openSans(), [...'x\u0308']);
    expect(cluster).toMatchObject({ start: 0, end: 2, glyphs: [{ isMark: false }, { isMark: true }] });
  });

  // The fixture's default instance swaps `l` for its own glyph whatever its neighbours.
  it('swaps a glyph by a lookup of the run', async () => {
    const face = await faceOf(fixtureFontBytes('recursive-contextual-rvrn.woff2'));
    expect(substitutedOf(face, 'il')).toEqual([{ start: 1, end: 2, glyph: RECURSIVE_SWAPPED_L }]);
  });
});

describe('characterRunShaping', () => {
  it('draws the composite of a base and a mark where the face has it', () => {
    const shaping = characterRunShaping((ch) => ch !== '\u0301');
    expect(shaping([...'e\u0301'])).toEqual([
      { start: 0, end: 2, glyphs: [{ char: 'é', isMark: false, isSubstituted: false }] },
    ]);
  });
});
