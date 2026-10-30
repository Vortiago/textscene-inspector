import { describe, expect, it } from 'vitest';
import { ByteWriter } from './sfntOutlines.testkit';
import { rebuildGlyfTables } from './woff2Glyf';

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

interface Streams {
  contourCounts?: readonly number[];
  pointCounts?: readonly number[];
  flags?: readonly number[];
  glyphStream?: readonly number[];
  composites?: readonly number[];
  boxes?: readonly number[];
  instructions?: readonly number[];
}

/** A transformed `glyf` table (WOFF2 §5.1): the 36-byte header, then the seven streams end to end. */
function transformedGlyf(glyphCount: number, indexFormat: number, streams: Streams): Uint8Array {
  const ordered = [
    streams.contourCounts,
    streams.pointCounts,
    streams.flags,
    streams.glyphStream,
    streams.composites,
    streams.boxes,
    streams.instructions,
  ].map((stream) => stream ?? []);
  const out = new ByteWriter().u16(0).u16(0).u16(glyphCount).u16(indexFormat);
  for (const stream of ordered) out.u32(stream.length);
  for (const stream of ordered) out.raw(stream);
  return Uint8Array.from(out.toBytes());
}

const u16 = (value: number): number[] => [value >> 8, value & 0xff];

/**
 * Three glyphs, with every number below worked out by hand from §5.1 and §5.2.
 * Glyph 0 is empty. Glyph 1 is a simple glyph of five points, one for each triplet encoding width,
 * whose box is not stored. Glyph 2 is a composite with a stored box, a scale and instructions.
 */
const SIMPLE_AND_COMPOSITE: Streams = {
  contourCounts: [...u16(0), ...u16(1), ...u16(0xffff)],
  pointCounts: [5],
  // Encodings 11 (dx 7), 21 (dx 3, dy -2), 100 (dx -262, dy -266), 121 (dx 291, dy -1110)
  // and 125 off the curve (dx 258, dy -3).
  flags: [11, 21, 100, 121, 125 | 0x80],
  glyphStream: [0x07, 0x21, 0x05, 0x09, 0x12, 0x34, 0x56, 0x01, 0x02, 0x00, 0x03, 0x02, 0x03],
  composites: [
    ...u16(0x002b),
    ...u16(1),
    ...u16(0x10),
    ...u16(0x20),
    ...u16(0x4000),
    ...u16(0x0102),
    ...u16(1),
    0x03,
    0x04,
  ],
  boxes: [0x20, 0, 0, 0, ...u16(0xfffb), ...u16(0xfffa), ...u16(70), ...u16(80)],
  instructions: [0xb0, 0x01, 0x01, 0x02, 0x03],
};

const SIMPLE_GLYPH =
  // header: 1 contour, box (-252, -1381) to (297, 0)
  '0001' +
  'ff04' +
  'fa9b' +
  '0129' +
  '0000' +
  // end point 4, then 2 instruction bytes
  '0004' +
  '0002' +
  'b001' +
  // flags: on and x short and y same / on, x short, y short negative / on / on / off and y short negative
  '33' +
  '17' +
  '01' +
  '01' +
  '04' +
  // x: 7, 3, -262, 291, 258
  '07' +
  '03' +
  'fefa' +
  '0123' +
  '0102' +
  // y: -2, -266, -1110, -3 (the first point has dy 0 and no byte)
  '02' +
  'fef6' +
  'fbaa' +
  '03' +
  // padding to four bytes
  '00';

const COMPOSITE_GLYPH =
  'ffff' +
  'fffb' +
  'fffa' +
  '0046' +
  '0050' +
  '002b' +
  '0001' +
  '0010' +
  '0020' +
  '4000' +
  '0102' +
  '0001' +
  '0304' +
  '0003' +
  '010203' +
  // padding to four bytes
  '00';

describe('rebuildGlyfTables', () => {
  it('writes each glyph on a four-byte boundary and none for an empty glyph', () => {
    const { glyf } = rebuildGlyfTables(transformedGlyf(3, 1, SIMPLE_AND_COMPOSITE));

    expect(hex(glyf)).toBe(SIMPLE_GLYPH + COMPOSITE_GLYPH);
  });

  it('writes the offsets as 32-bit values for an indexFormat of 1', () => {
    const { loca } = rebuildGlyfTables(transformedGlyf(3, 1, SIMPLE_AND_COMPOSITE));

    expect(hex(loca)).toBe('00000000' + '00000000' + '00000024' + '00000044');
  });

  it('writes the offsets halved as 16-bit values for an indexFormat of 0', () => {
    const { loca } = rebuildGlyfTables(transformedGlyf(3, 0, SIMPLE_AND_COMPOSITE));

    expect(hex(loca)).toBe('0000' + '0000' + '0012' + '0022');
  });

  describe('two composite glyphs of 18 bytes each', () => {
    const component = [...u16(0x0008), ...u16(1), 0x03, 0x04, ...u16(0x4000)];
    const twoScaled: Streams = {
      contourCounts: [...u16(0xffff), ...u16(0xffff)],
      composites: [...component, ...component],
      boxes: [0xc0, 0, 0, 0, ...new Array<number>(16).fill(0)],
    };

    it('keeps the glyphs of a short loca on two-byte boundaries, so padding cannot outgrow the offsets', () => {
      const { glyf, loca } = rebuildGlyfTables(transformedGlyf(2, 0, twoScaled));

      expect(glyf.length).toBe(36);
      expect(hex(loca)).toBe('0000' + '0009' + '0012');
    });

    it('keeps the glyphs of a long loca on four-byte boundaries', () => {
      const { glyf, loca } = rebuildGlyfTables(transformedGlyf(2, 1, twoScaled));

      expect(glyf.length).toBe(40);
      expect(hex(loca)).toBe('00000000' + '00000014' + '00000028');
    });
  });

  it('keeps a stored box in place of the box of the points', () => {
    const stored: Streams = {
      contourCounts: u16(1),
      pointCounts: [1],
      flags: [0],
      glyphStream: [0x00, 0x00],
      boxes: [0x80, 0, 0, 0, ...u16(1), ...u16(2), ...u16(3), ...u16(4)],
    };

    const { glyf } = rebuildGlyfTables(transformedGlyf(1, 1, stored));

    expect(hex(glyf).slice(0, 20)).toBe('0001' + '0001' + '0002' + '0003' + '0004');
  });

  describe('the length of the instructions of a glyph', () => {
    const onePointGlyph = (instructionLength: readonly number[], length: number): Streams => ({
      contourCounts: u16(1),
      pointCounts: [1],
      flags: [0],
      glyphStream: [0x00, ...instructionLength],
      boxes: [0, 0, 0, 0],
      instructions: new Array<number>(length).fill(0),
    });
    const instructionLengthOf = (glyf: Uint8Array) => (glyf[12]! << 8) | glyf[13]!;

    it.each([
      ['a single byte below 253', [100], 100],
      ['the word code 253 and two bytes', [253, 0x01, 0x2c], 300],
      ['the code 255 and one byte added to 253', [255, 47], 300],
      ['the code 254 and one byte added to 506', [254, 4], 510],
    ])('reads %s', (_form, encoded, length) => {
      const { glyf } = rebuildGlyfTables(transformedGlyf(1, 1, onePointGlyph(encoded, length)));

      expect(instructionLengthOf(glyf)).toBe(length);
    });
  });

  it('throws for an empty glyph that has a stored box', () => {
    const streams: Streams = { contourCounts: u16(0), boxes: [0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };

    expect(() => rebuildGlyfTables(transformedGlyf(1, 1, streams))).toThrow(/no stored box/);
  });

  it('throws for a composite glyph without a stored box', () => {
    const streams: Streams = { contourCounts: u16(0xffff), boxes: [0, 0, 0, 0] };

    expect(() => rebuildGlyfTables(transformedGlyf(1, 1, streams))).toThrow(/stored box/);
  });

  it('throws for an indexFormat other than 0 or 1', () => {
    expect(() => rebuildGlyfTables(transformedGlyf(0, 2, {}))).toThrow(/indexFormat of 0 or 1, got 2/);
  });

  it('throws for a table that stops inside a stream', () => {
    const whole = transformedGlyf(3, 1, SIMPLE_AND_COMPOSITE);

    expect(() => rebuildGlyfTables(whole.slice(0, whole.length - 8))).toThrow();
  });
});
