import { describe, expect, it } from 'vitest';
import { readLocatorGlyph } from './locatorGlyph';
import { encodePng, inflate } from './png.testkit';
import { readSbitTables } from './sbitStrikes';
import {
  bigMetrics,
  locatorTables,
  pngImage,
  smallMetrics,
  strikeFont,
  type TestIndexSubtable,
} from './sbit.testkit';

/** A 2 × 1 PNG of an opaque red pixel and a half-transparent blue one. */
const RED_BLUE = encodePng({ width: 2, height: 1, colourType: 6, samples: [255, 0, 0, 255, 0, 0, 255, 128] });
const RED_BLUE_BGRA = [0, 0, 255, 255, 128, 0, 0, 128];

/** The bitmap of glyph `glyph` in a strike of `bitDepth` holding `subtables`. */
function glyphOf(glyph: number, bitDepth: number, subtables: readonly TestIndexSubtable[]) {
  const { locator, data } = locatorTables([{ ppem: 20, bitDepth, subtables }]);
  const tables = readSbitTables(strikeFont({ CBLC: locator, CBDT: data }))!;
  return readLocatorGlyph(tables, tables.strikes[0]!, glyph, inflate);
}

const one = (
  indexFormat: TestIndexSubtable['indexFormat'],
  imageFormat: number,
  image: readonly number[],
  extra: Partial<TestIndexSubtable> = {}
): TestIndexSubtable => ({ first: 3, last: 3, indexFormat, imageFormat, images: [image], ...extra });

describe('readLocatorGlyph', () => {
  it('reads a PNG with small metrics (format 17) through 4-byte offsets (index format 1)', () => {
    const bitmap = glyphOf(3, 32, [one(1, 17, [...smallMetrics(2, 1, -1, 7), ...pngImage(RED_BLUE)])]);
    expect(bitmap).toMatchObject({ pixelMode: 'bgra', width: 2, rows: 1, pitch: 8, left: -1, top: 7 });
    expect([...bitmap!.buffer]).toEqual(RED_BLUE_BGRA);
  });

  it('reads a PNG with big metrics (format 18) through 2-byte offsets (index format 3)', () => {
    const bitmap = glyphOf(3, 32, [one(3, 18, [...bigMetrics(2, 1, 2, 9), ...pngImage(RED_BLUE)])]);
    expect(bitmap).toMatchObject({ width: 2, rows: 1, left: 2, top: 9 });
    expect([...bitmap!.buffer]).toEqual(RED_BLUE_BGRA);
  });

  it('reads a PNG whose metrics the index gives (format 19, index format 2)', () => {
    const bitmap = glyphOf(3, 32, [one(2, 19, pngImage(RED_BLUE), { bigMetrics: bigMetrics(2, 1, 0, 5) })]);
    expect(bitmap).toMatchObject({ width: 2, rows: 1, left: 0, top: 5 });
    expect([...bitmap!.buffer]).toEqual(RED_BLUE_BGRA);
  });

  it('finds a glyph of a sparse range by its code (index format 5)', () => {
    const subtable: TestIndexSubtable = {
      first: 3,
      last: 5,
      indexFormat: 5,
      imageFormat: 19,
      images: [pngImage(RED_BLUE), null, pngImage(RED_BLUE)],
      bigMetrics: bigMetrics(2, 1, 0, 5),
    };
    expect([...glyphOf(5, 32, [subtable])!.buffer]).toEqual(RED_BLUE_BGRA);
    expect(glyphOf(4, 32, [subtable])).toBeNull();
  });

  it('finds a glyph of a sparse range by its pair (index format 4)', () => {
    const image = [...smallMetrics(2, 1, 0, 5), ...pngImage(RED_BLUE)];
    const subtable: TestIndexSubtable = {
      first: 3,
      last: 5,
      indexFormat: 4,
      imageFormat: 17,
      images: [null, null, image],
    };
    expect([...glyphOf(5, 32, [subtable])!.buffer]).toEqual(RED_BLUE_BGRA);
    expect(glyphOf(3, 32, [subtable])).toBeNull();
  });

  it('leaves the bitmap clear where the PNG is of another size than its metrics', () => {
    const bitmap = glyphOf(3, 32, [one(1, 17, [...smallMetrics(3, 1, 0, 5), ...pngImage(RED_BLUE)])]);
    expect(bitmap).toMatchObject({ width: 3, rows: 1 });
    expect([...bitmap!.buffer]).toEqual(new Array(12).fill(0));
  });

  it('fails a PNG in a strike that is not 32 bits deep', () => {
    expect(glyphOf(3, 8, [one(1, 17, [...smallMetrics(2, 1, 0, 5), ...pngImage(RED_BLUE)])])).toBeNull();
  });

  it('fails a PNG whose metrics nothing gives (format 19 through index format 1)', () => {
    expect(glyphOf(3, 32, [one(1, 19, pngImage(RED_BLUE))])).toBeNull();
  });

  it('reads byte-aligned rows of 1-bit coverage (format 1)', () => {
    const bitmap = glyphOf(3, 1, [
      one(1, 1, [...smallMetrics(10, 2, 0, 2), 0b10110000, 0b01000000, 0xff, 0xc0]),
    ]);
    expect(bitmap).toMatchObject({ pixelMode: 'mono', width: 10, rows: 2, pitch: 2 });
    expect([...bitmap!.buffer]).toEqual([0b10110000, 0b01000000, 0xff, 0xc0]);
  });

  it('reads bit-aligned rows (format 2), the next row starting at the next bit', () => {
    // Two rows of 5 bits: 10110 and 01101, packed as 1011 0011 01.
    const bitmap = glyphOf(3, 1, [one(1, 2, [...smallMetrics(5, 2, 0, 2), 0b10110011, 0b01000000])]);
    expect([...bitmap!.buffer]).toEqual([0b10110000, 0b01101000]);
  });

  it('reads bit-aligned rows whose metrics the index gives (format 5)', () => {
    const bitmap = glyphOf(3, 1, [
      one(2, 5, [0b10110011, 0b01000000], { bigMetrics: bigMetrics(5, 2, 0, 2) }),
    ]);
    expect([...bitmap!.buffer]).toEqual([0b10110000, 0b01101000]);
  });

  it('reads byte-aligned rows with big metrics (format 6)', () => {
    const bitmap = glyphOf(3, 8, [one(1, 6, [...bigMetrics(2, 1, 1, 4), 17, 250])]);
    expect(bitmap).toMatchObject({ pixelMode: 'gray', left: 1, top: 4 });
    expect([...bitmap!.buffer]).toEqual([17, 250]);
  });

  it('reads byte-aligned bitmaps a font labels bit-aligned (format 7)', () => {
    // A 3 × 2 image: bit-aligned it takes 1 byte, byte-aligned 2, and the image holds 2.
    const bitmap = glyphOf(3, 1, [one(1, 7, [...bigMetrics(3, 2, 0, 2), 0b10100000, 0b01000000])]);
    expect([...bitmap!.buffer]).toEqual([0b10100000, 0b01000000]);
  });

  it('reads raw 32-bit pixels as BGRA (format 1)', () => {
    const bitmap = glyphOf(3, 32, [one(1, 1, [...smallMetrics(1, 1, 0, 1), 10, 20, 30, 40])]);
    expect(bitmap).toMatchObject({ pixelMode: 'bgra' });
    expect([...bitmap!.buffer]).toEqual([10, 20, 30, 40]);
  });

  it("lays a compound glyph's components at their offsets (format 9)", () => {
    const component: TestIndexSubtable = {
      first: 4,
      last: 4,
      indexFormat: 1,
      imageFormat: 6,
      images: [[...bigMetrics(1, 1, 0, 1), 0x80]],
    };
    const compound: TestIndexSubtable = {
      first: 6,
      last: 6,
      indexFormat: 1,
      imageFormat: 9,
      // Two components of glyph 4, at (1, 1) and (3, 0).
      images: [[...bigMetrics(4, 2, 0, 2), 0, 2, 0, 4, 1, 1, 0, 4, 3, 0]],
    };
    const bitmap = glyphOf(6, 1, [component, compound]);
    expect(bitmap).toMatchObject({ width: 4, rows: 2, left: 0, top: 2 });
    expect([...bitmap!.buffer]).toEqual([0b00010000, 0b01000000]);
  });

  it('has no bitmap for a glyph outside every range', () => {
    expect(glyphOf(9, 32, [one(1, 17, [...smallMetrics(2, 1, 0, 5), ...pngImage(RED_BLUE)])])).toBeNull();
  });

  it('has no bitmap for a glyph whose offsets hold no image', () => {
    const subtable: TestIndexSubtable = {
      first: 3,
      last: 4,
      indexFormat: 1,
      imageFormat: 17,
      images: [null, null],
    };
    expect(glyphOf(3, 32, [subtable])).toBeNull();
  });
});
