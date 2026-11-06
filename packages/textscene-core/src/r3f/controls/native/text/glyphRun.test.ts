/**
 * `shapedRunClusters`: the clusters of a run that the `GSUB` of a font draws as a glyph of their
 * own, read off the bundled Open Sans and the contextual `rvrn` fixture.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { defaultSubstitution } from './autofit/openTypeFeatures';
import { openFontContainer } from './fontContainer';
import { sfntRunShapingFace, shapedRunClusters, type RunShapingFace } from './glyphRun';
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

const clustersOf = (face: RunShapingFace, text: string) =>
  shapedRunClusters(face, [...text], defaultSubstitution(face.gsub!)).map(({ start, end, glyph }) => ({
    start,
    end,
    glyph,
  }));

describe('shapedRunClusters', () => {
  it('draws a ligature as one cluster of its characters', async () => {
    expect(clustersOf(await openSans(), 'office')).toEqual([{ start: 1, end: 4, glyph: OPEN_SANS_FFI }]);
  });

  it('gives a ligature the advance of its own glyph', async () => {
    const face = await openSans();
    const [cluster] = shapedRunClusters(face, [...'fi'], defaultSubstitution(face.gsub!));
    expect(cluster!.advanceUnits).toBe(face.advanceUnits(OPEN_SANS_FI));
  });

  it('keeps the place of an empty string, which holds no character', async () => {
    const face = await openSans();
    const clusters = shapedRunClusters(face, ['x', '', 'f', 'i'], defaultSubstitution(face.gsub!));
    expect(clusters.map(({ start, end }) => [start, end])).toEqual([[2, 4]]);
  });

  it('leaves out a run the lookups do not change', async () => {
    expect(clustersOf(await openSans(), 'ft')).toEqual([]);
  });

  // The fixture's default instance swaps `l` for its own glyph whatever its neighbours.
  it('swaps a glyph by a lookup of the run', async () => {
    const face = await faceOf(fixtureFontBytes('recursive-contextual-rvrn.woff2'));
    expect(clustersOf(face, 'il')).toEqual([{ start: 1, end: 2, glyph: RECURSIVE_SWAPPED_L }]);
  });
});
