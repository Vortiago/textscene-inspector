/**
 * Strike tables built for the strike readers' tests: `CBLC` with its `CBDT`, and `sbix`, around
 * the images each test gives, with the `head`, `hhea`, `maxp` and `OS/2` they read.
 */
import { ByteWriter } from '../sfntOutlines.testkit';
import { sfntFileOfTables, type SfntFile } from '../sfntTables';

/** An image's bytes as the data table holds them: its metrics, if the format has them, then its pixels. */
export type TestImage = readonly number[];

/** An index subtable over glyphs `first` to `last`. A null image is a glyph with none. */
export interface TestIndexSubtable {
  readonly first: number;
  readonly last: number;
  readonly indexFormat: 1 | 2 | 3 | 4 | 5;
  readonly imageFormat: number;
  /** One per glyph from `first` to `last`. Formats 2 and 5 take images of one size. */
  readonly images: readonly (TestImage | null)[];
  /** The big metrics of formats 2 and 5: height, width, bearing x, bearing y, advance, then the vertical three. */
  readonly bigMetrics?: readonly number[];
}

export interface TestLocatorStrike {
  readonly ppem: number;
  readonly bitDepth: number;
  /** The horizontal line metrics' ascender, descender, maxBeforeBL and minAfterBL, as int8. */
  readonly ascender?: number;
  readonly descender?: number;
  readonly maxBeforeBaseline?: number;
  readonly minAfterBaseline?: number;
  readonly subtables: readonly TestIndexSubtable[];
}

/** Small metrics: height, width, bearing x, bearing y, advance. */
export function smallMetrics(width: number, height: number, bearingX: number, bearingY: number): number[] {
  return [height, width, bearingX & 0xff, bearingY & 0xff, width];
}

/** Big metrics: the small ones, then a vertical bearing x, bearing y and advance of zero. */
export function bigMetrics(width: number, height: number, bearingX: number, bearingY: number): number[] {
  return [...smallMetrics(width, height, bearingX, bearingY), 0, 0, 0];
}

/** A PNG as formats 17 to 19 hold it, after its length. */
export function pngImage(png: Uint8Array): number[] {
  return [...new ByteWriter().u32(png.length).toBytes(), ...png];
}

/** A `CBLC` locator and its `CBDT` data, at `version`. */
export function locatorTables(
  strikes: readonly TestLocatorStrike[],
  version = 0x00030000
): { locator: Uint8Array; data: Uint8Array } {
  const data = new ByteWriter().u32(version);
  const records = new ByteWriter();
  const arrays = new ByteWriter();
  const arraysStart = 8 + 48 * strikes.length;
  for (const strike of strikes) {
    const arrayOffset = arraysStart + arrays.length;
    const { array, subtables } = indexArray(strike.subtables, data);
    records
      .u32(arrayOffset)
      .u32(array.length + subtables.length)
      .u32(strike.subtables.length)
      .u32(0)
      .raw(lineMetrics(strike))
      .raw(lineMetrics({}))
      .u16(0)
      .u16(0xffff)
      .u8(strike.ppem)
      .u8(strike.ppem)
      .u8(strike.bitDepth)
      .u8(1);
    arrays.raw(array).raw(subtables);
  }
  const locator = new ByteWriter().u32(version).u32(strikes.length).raw(records).raw(arrays);
  return { locator: new Uint8Array(locator.toBytes()), data: new Uint8Array(data.toBytes()) };
}

function lineMetrics(strike: Partial<TestLocatorStrike>): number[] {
  const bytes = new Array<number>(12).fill(0);
  bytes[0] = (strike.ascender ?? 0) & 0xff;
  bytes[1] = (strike.descender ?? 0) & 0xff;
  bytes[8] = (strike.maxBeforeBaseline ?? 0) & 0xff;
  bytes[9] = (strike.minAfterBaseline ?? 0) & 0xff;
  return bytes;
}

/** The index subtable array of a strike and its subtables, whose images land in `data`. */
function indexArray(
  subtables: readonly TestIndexSubtable[],
  data: ByteWriter
): { array: ByteWriter; subtables: ByteWriter } {
  const array = new ByteWriter();
  const bodies = new ByteWriter();
  for (const subtable of subtables) {
    array
      .u16(subtable.first)
      .u16(subtable.last)
      .u32(8 * subtables.length + bodies.length);
    bodies.raw(subtableBytes(subtable, data)).pad4();
  }
  return { array, subtables: bodies };
}

function subtableBytes(subtable: TestIndexSubtable, data: ByteWriter): ByteWriter {
  const imageDataOffset = data.length;
  const out = new ByteWriter().u16(subtable.indexFormat).u16(subtable.imageFormat).u32(imageDataOffset);
  const offsets: number[] = [];
  for (const image of subtable.images) {
    offsets.push(data.length - imageDataOffset);
    if (image) data.raw(image);
  }
  offsets.push(data.length - imageDataOffset);
  const glyphs = subtable.images.map((_, i) => subtable.first + i);
  const imageSize = subtable.images.find((image) => image)?.length ?? 0;
  switch (subtable.indexFormat) {
    case 1:
      offsets.forEach((offset) => out.u32(offset));
      break;
    case 3:
      offsets.forEach((offset) => out.u16(offset));
      break;
    case 2:
      out.u32(imageSize).raw(subtable.bigMetrics!);
      break;
    case 4: {
      const present = glyphs.filter((_, i) => subtable.images[i]);
      out.u32(present.length);
      present.forEach((glyph, i) => out.u16(glyph).u16(imageSize * i));
      out.u16(0).u16(imageSize * present.length);
      break;
    }
    case 5: {
      const present = glyphs.filter((_, i) => subtable.images[i]);
      out.u32(imageSize).raw(subtable.bigMetrics!).u32(present.length);
      present.forEach((glyph) => out.u16(glyph));
      break;
    }
  }
  return out;
}

/** An `sbix` glyph record: its origin, its graphic type and its data. */
export interface TestSbixGlyph {
  readonly originX?: number;
  readonly originY?: number;
  readonly type: string;
  readonly data: readonly number[];
}

/** An `sbix` table of strikes, each with a record for every glyph up to the font's glyph count. */
export function sbixTable(
  strikes: readonly { ppem: number; glyphs: readonly (TestSbixGlyph | null)[] }[],
  flags = 1
): Uint8Array {
  const out = new ByteWriter().u16(1).u16(flags).u32(strikes.length);
  const bodies = strikes.map(({ ppem, glyphs }) => {
    const records = new ByteWriter();
    const offsets: number[] = [];
    const headerSize = 4 + 4 * (glyphs.length + 1);
    for (const glyph of glyphs) {
      offsets.push(headerSize + records.length);
      if (glyph)
        records
          .u16(glyph.originX ?? 0)
          .u16(glyph.originY ?? 0)
          .tag(glyph.type)
          .raw(glyph.data);
    }
    offsets.push(headerSize + records.length);
    const strike = new ByteWriter().u16(ppem).u16(72);
    offsets.forEach((offset) => strike.u32(offset));
    return strike.raw(records);
  });
  let offset = 8 + 4 * strikes.length;
  for (const body of bodies) {
    out.u32(offset);
    offset += body.length;
  }
  bodies.forEach((body) => out.raw(body));
  return new Uint8Array(out.toBytes());
}

/** A font of `tables` with a `head` at `unitsPerEm`, an `hhea` of the given extent, and `OS/2` of `averageWidth` where given. */
export function strikeFont(
  tables: Readonly<Record<string, Uint8Array>>,
  {
    unitsPerEm = 1000,
    ascender = 800,
    descender = -200,
    averageWidth,
    glyphCount = 10,
  }: {
    unitsPerEm?: number;
    ascender?: number;
    descender?: number;
    averageWidth?: number;
    glyphCount?: number;
  } = {}
): SfntFile {
  const head = new Uint8Array(54);
  new DataView(head.buffer).setUint16(18, unitsPerEm);
  const hhea = new Uint8Array(36);
  new DataView(hhea.buffer).setInt16(4, ascender);
  new DataView(hhea.buffer).setInt16(6, descender);
  const maxp = new Uint8Array(6);
  new DataView(maxp.buffer).setUint16(4, glyphCount);
  const all = new Map<string, Uint8Array>([
    ['head', head],
    ['hhea', hhea],
    ['maxp', maxp],
  ]);
  if (averageWidth !== undefined) {
    const os2 = new Uint8Array(78);
    new DataView(os2.buffer).setInt16(2, averageWidth);
    all.set('OS/2', os2);
  }
  for (const [tag, bytes] of Object.entries(tables)) all.set(tag, bytes);
  return sfntFileOfTables(all);
}
