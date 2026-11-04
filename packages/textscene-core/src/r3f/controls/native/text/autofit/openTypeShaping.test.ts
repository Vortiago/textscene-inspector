/**
 * The GSUB shaper of the auto-hinter on malformed and deleting lookups, which HarfBuzz handles in
 * `hb-ot-layout-gsub-table.hh`. Each font is one `ccmp` lookup of one subtable under `latn`.
 */

import { describe, expect, it } from 'vitest';
import { readLayoutTable } from './openTypeLayout';
import { shapeCluster, type ShapingFace } from './openTypeShaping';

const GLYPH_A = 3;
const LIGATURE_GLYPH = 9;
const LIGATURE_LOOKUP = 4;
const MULTIPLE_LOOKUP = 2;

/** A GSUB table whose `latn` default language turns on `ccmp`, one lookup of `lookupType` over `subtable`. */
function gsubOf(lookupType: number, subtable: readonly number[]): number[] {
  const scriptList = [1, ...tag('latn'), 8, 4, 0, 0, 0xffff, 1, 0];
  const featureList = [1, ...tag('ccmp'), 8, 0, 1, 0];
  const lookupList = [1, 4, lookupType, 0, 1, 8, ...subtable];
  const scriptListAt = 10;
  const featureListAt = scriptListAt + scriptList.length * 2;
  const lookupListAt = featureListAt + featureList.length * 2;
  return [
    0x0001,
    0x0000,
    scriptListAt,
    featureListAt,
    lookupListAt,
    ...scriptList,
    ...featureList,
    ...lookupList,
  ];
}

/** A tag as the two 16-bit words it is stored in. */
function tag(name: string): [number, number] {
  const code = (i: number): number => name.charCodeAt(i);
  return [(code(0) << 8) | code(1), (code(2) << 8) | code(3)];
}

/** A face that maps every character to glyph A and has `words` as its GSUB. */
function faceOf(words: readonly number[]): ShapingFace {
  const dv = new DataView(new ArrayBuffer(words.length * 2));
  words.forEach((word, i) => dv.setUint16(i * 2, word, false));
  return { glyphIndex: () => GLYPH_A, gsub: readLayoutTable(dv, 0, dv.byteLength, true), gpos: null };
}

const glyphsOf = (face: ShapingFace, cluster: string): number[] =>
  shapeCluster(face, cluster, ['latn'], null).map((shaped) => shaped.glyph);

describe('the auto-hinter GSUB shaper', () => {
  it('skips a ligature of no components, as HarfBuzz rejects it', () => {
    // Ligature substitution: coverage of A, one set, one ligature of 0 components.
    const ligatureSubtable = [1, 8, 1, 14, 1, 1, GLYPH_A, 1, 4, LIGATURE_GLYPH, 0];
    const face = faceOf(gsubOf(LIGATURE_LOOKUP, ligatureSubtable));
    expect(glyphsOf(face, 'aa')).toEqual([GLYPH_A, GLYPH_A]);
  });

  it('visits the glyph after one that a multiple substitution deletes', () => {
    // Multiple substitution: coverage of A, one sequence of no glyphs.
    const deletingSubtable = [1, 8, 1, 14, 1, 1, GLYPH_A, 0];
    const face = faceOf(gsubOf(MULTIPLE_LOOKUP, deletingSubtable));
    expect(glyphsOf(face, 'aa')).toEqual([]);
  });
});
