/**
 * Rebuilds the `glyf` and `loca` tables of a font from the transformed `glyf` table of a WOFF2 file
 * (W3C WOFF 2.0, §5.1 "Transformed glyf table format" and §5.2 "Triplet encoding"). The transform
 * splits each glyph over seven streams: the contour counts, the point counts, the point flags, the
 * coordinates, the composite records, the bounding boxes and the instructions.
 */

import { ByteReader } from '../../../../resources/formats/binaryresource/byteReader';

const HEADER_STREAM_COUNT = 7;

const COMPOSITE_CONTOUR_COUNT = -1;

// A composite glyph's component flags (OpenType spec, "Composite Glyph Description").
const COMPONENT_ARGS_ARE_WORDS = 0x0001;
const COMPONENT_HAS_SCALE = 0x0008;
const COMPONENT_MORE = 0x0020;
const COMPONENT_HAS_XY_SCALE = 0x0040;
const COMPONENT_HAS_2X2 = 0x0080;
const COMPONENT_HAS_INSTRUCTIONS = 0x0100;
const GLYPH_INDEX_BYTES = 2;

// The glyph header and the point flags of a simple glyph (OpenType spec, "Simple Glyph Description").
const POINT_ON_CURVE = 0x01;
const POINT_X_SHORT = 0x02;
const POINT_Y_SHORT = 0x04;
const POINT_X_SAME_OR_POSITIVE = 0x10;
const POINT_Y_SAME_OR_POSITIVE = 0x20;
const MAX_SHORT_DELTA = 255;

/** `255UInt16`'s first byte: 253 is followed by a `UInt16`, 254 and 255 by one byte added to their base. */
const WORD_CODE = 253;
const ONE_MORE_BYTE_CODE_2 = 254;
const ONE_MORE_BYTE_CODE_1 = 255;
const ONE_MORE_BYTE_BASE_2 = 506;

/** The triplet flag byte: bit 7 set is an off-curve point, bits 0-6 pick the coordinate encoding (§5.2). */
const TRIPLET_OFF_CURVE = 0x80;
const TRIPLET_ENCODING_MASK = 0x7f;

/** The glyph offsets are kept on four-byte boundaries, as the reference decoder writes them. */
const GLYPH_ALIGNMENT = 4;
const SHORT_LOCA_FORMAT = 0;
const LONG_LOCA_FORMAT = 1;
/** A short `loca` holds `offset / 2` in a `UInt16`. */
const MAX_SHORT_LOCA_OFFSET = 0xffff * 2;

export interface RebuiltGlyf {
  glyf: Uint8Array;
  /** In the format of the transform's `indexFormat`, which `head.indexToLocFormat` repeats. */
  loca: Uint8Array;
}

interface Point {
  dx: number;
  dy: number;
  isOnCurve: boolean;
}

interface GlyphBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/** The bytes of a glyph under construction. */
class GlyphBytes {
  readonly bytes: number[] = [];

  u8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  u16(value: number): void {
    this.u8(value >> 8);
    this.u8(value);
  }

  append(data: Uint8Array): void {
    for (const byte of data) this.bytes.push(byte);
  }
}

function int16(reader: ByteReader): number {
  const value = reader.u16();
  return value >= 0x8000 ? value - 0x10000 : value;
}

/** `255UInt16` (§"255UInt16 Data Type"). */
function read255UInt16(reader: ByteReader): number {
  const code = reader.u8();
  switch (code) {
    case WORD_CODE:
      return reader.u16();
    case ONE_MORE_BYTE_CODE_1:
      return WORD_CODE + reader.u8();
    case ONE_MORE_BYTE_CODE_2:
      return ONE_MORE_BYTE_BASE_2 + reader.u8();
    default:
      return code;
  }
}

const signed = (flag: number, magnitude: number): number => (flag & 1 ? magnitude : -magnitude);

/** One point's `dx` and `dy` from the triplet encoding of §5.2, reading its data bytes from `reader`. */
function readTriplet(encoding: number, reader: ByteReader): { dx: number; dy: number } {
  if (encoding < 10) {
    return { dx: 0, dy: signed(encoding, ((encoding & 14) << 7) + reader.u8()) };
  }
  if (encoding < 20) {
    return { dx: signed(encoding, (((encoding - 10) & 14) << 7) + reader.u8()), dy: 0 };
  }
  if (encoding < 84) {
    const high = encoding - 20;
    const packed = reader.u8();
    return {
      dx: signed(encoding, 1 + (high & 0x30) + (packed >> 4)),
      dy: signed(encoding >> 1, 1 + ((high & 0x0c) << 2) + (packed & 0x0f)),
    };
  }
  if (encoding < 120) {
    const high = encoding - 84;
    const x = reader.u8();
    const y = reader.u8();
    return {
      dx: signed(encoding, 1 + (Math.floor(high / 12) << 8) + x),
      dy: signed(encoding >> 1, 1 + (((high % 12) >> 2) << 8) + y),
    };
  }
  if (encoding < 124) {
    const x = reader.u8();
    const shared = reader.u8();
    const y = reader.u8();
    return {
      dx: signed(encoding, (x << 4) + (shared >> 4)),
      dy: signed(encoding >> 1, ((shared & 0x0f) << 8) + y),
    };
  }
  const x = reader.u16();
  const y = reader.u16();
  return { dx: signed(encoding, x), dy: signed(encoding >> 1, y) };
}

function readPoints(count: number, flags: ByteReader, glyphStream: ByteReader): Point[] {
  return Array.from({ length: count }, () => {
    const flag = flags.u8();
    return {
      isOnCurve: (flag & TRIPLET_OFF_CURVE) === 0,
      ...readTriplet(flag & TRIPLET_ENCODING_MASK, glyphStream),
    };
  });
}

/** The box of the points, which a glyph without a stored box takes. */
function boxOf(points: readonly Point[]): GlyphBox {
  let x = 0;
  let y = 0;
  const box = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  points.forEach((point, index) => {
    x += point.dx;
    y += point.dy;
    box.xMin = index === 0 ? x : Math.min(box.xMin, x);
    box.yMin = index === 0 ? y : Math.min(box.yMin, y);
    box.xMax = index === 0 ? x : Math.max(box.xMax, x);
    box.yMax = index === 0 ? y : Math.max(box.yMax, y);
  });
  return box;
}

function writeHeader(glyph: GlyphBytes, contourCount: number, box: GlyphBox): void {
  glyph.u16(contourCount);
  for (const edge of [box.xMin, box.yMin, box.xMax, box.yMax]) glyph.u16(edge);
}

/** The deltas of one axis, each as a byte, a word, or nothing for a delta of 0. */
function writeAxis(glyph: GlyphBytes, deltas: readonly number[], isShort: (delta: number) => boolean): void {
  for (const delta of deltas) {
    if (delta === 0) continue;
    if (isShort(delta)) glyph.u8(Math.abs(delta));
    else glyph.u16(delta);
  }
}

const fitsInByte = (delta: number): boolean => Math.abs(delta) <= MAX_SHORT_DELTA;

function writeSimpleGlyph(
  glyph: GlyphBytes,
  contourEnds: readonly number[],
  points: readonly Point[],
  instructions: Uint8Array
): void {
  for (const end of contourEnds) glyph.u16(end);
  glyph.u16(instructions.length);
  glyph.append(instructions);
  for (const { dx, dy, isOnCurve } of points) {
    let flag = isOnCurve ? POINT_ON_CURVE : 0;
    if (dx === 0) flag |= POINT_X_SAME_OR_POSITIVE;
    else if (fitsInByte(dx)) flag |= POINT_X_SHORT | (dx > 0 ? POINT_X_SAME_OR_POSITIVE : 0);
    if (dy === 0) flag |= POINT_Y_SAME_OR_POSITIVE;
    else if (fitsInByte(dy)) flag |= POINT_Y_SHORT | (dy > 0 ? POINT_Y_SAME_OR_POSITIVE : 0);
    glyph.u8(flag);
  }
  writeAxis(
    glyph,
    points.map((point) => point.dx),
    fitsInByte
  );
  writeAxis(
    glyph,
    points.map((point) => point.dy),
    fitsInByte
  );
}

function argumentByteCount(flags: number): number {
  return flags & COMPONENT_ARGS_ARE_WORDS ? 4 : 2;
}

function transformByteCount(flags: number): number {
  if (flags & COMPONENT_HAS_SCALE) return 2;
  if (flags & COMPONENT_HAS_XY_SCALE) return 4;
  return flags & COMPONENT_HAS_2X2 ? 8 : 0;
}

/** The component records of a composite glyph, up to the one without `MORE_COMPONENTS`, and whether instructions follow. */
function readComponents(composite: ByteReader): { records: Uint8Array[]; hasInstructions: boolean } {
  const records: Uint8Array[] = [];
  let hasInstructions = false;
  let flags = COMPONENT_MORE;
  while (flags & COMPONENT_MORE) {
    flags = composite.u16();
    const record = new GlyphBytes();
    record.u16(flags);
    record.append(composite.take(GLYPH_INDEX_BYTES + argumentByteCount(flags) + transformByteCount(flags)));
    records.push(Uint8Array.from(record.bytes));
    hasInstructions ||= (flags & COMPONENT_HAS_INSTRUCTIONS) !== 0;
  }
  return { records, hasInstructions };
}

interface Streams {
  contourCounts: ByteReader;
  pointCounts: ByteReader;
  flags: ByteReader;
  /** The triplet-coded coordinates, then each simple glyph's instruction length (§5.1 "glyphStream"). */
  glyphStream: ByteReader;
  composites: ByteReader;
  boxes: ByteReader;
  instructions: ByteReader;
}

function readStoredBox(boxes: ByteReader): GlyphBox {
  return { xMin: int16(boxes), yMin: int16(boxes), xMax: int16(boxes), yMax: int16(boxes) };
}

function simpleGlyph(contourCount: number, storedBox: GlyphBox | null, streams: Streams): Uint8Array {
  const contourEnds: number[] = [];
  let pointCount = 0;
  for (let contour = 0; contour < contourCount; contour++) {
    pointCount += read255UInt16(streams.pointCounts);
    contourEnds.push(pointCount - 1);
  }
  const points = readPoints(pointCount, streams.flags, streams.glyphStream);
  const instructionLength = read255UInt16(streams.glyphStream);

  const glyph = new GlyphBytes();
  writeHeader(glyph, contourCount, storedBox ?? boxOf(points));
  writeSimpleGlyph(glyph, contourEnds, points, streams.instructions.take(instructionLength));
  return Uint8Array.from(glyph.bytes);
}

function compositeGlyph(box: GlyphBox, streams: Streams): Uint8Array {
  const { records, hasInstructions } = readComponents(streams.composites);
  const glyph = new GlyphBytes();
  writeHeader(glyph, COMPOSITE_CONTOUR_COUNT, box);
  for (const record of records) glyph.append(record);
  if (hasInstructions) {
    const instructions = streams.instructions.take(read255UInt16(streams.glyphStream));
    glyph.u16(instructions.length);
    glyph.append(instructions);
  }
  return Uint8Array.from(glyph.bytes);
}

/** The glyphs whose box the font stores: the bit of glyph `index` in the bitmap, most significant bit first. */
function hasStoredBox(bitmap: Uint8Array, index: number): boolean {
  return (bitmap[index >> 3]! & (0x80 >> (index & 7))) !== 0;
}

function glyphAt(index: number, bitmap: Uint8Array, streams: Streams): Uint8Array {
  const contourCount = int16(streams.contourCounts);
  const isBoxStored = hasStoredBox(bitmap, index);
  if (contourCount === 0) {
    if (isBoxStored) throw new Error(`expected glyph ${index} with no contours to have no stored box`);
    return new Uint8Array(0);
  }
  if (contourCount === COMPOSITE_CONTOUR_COUNT) {
    if (!isBoxStored) throw new Error(`expected composite glyph ${index} to have a stored box`);
    return compositeGlyph(readStoredBox(streams.boxes), streams);
  }
  if (contourCount < 0)
    throw new Error(`expected glyph ${index} to have -1 or more contours, got ${contourCount}`);
  return simpleGlyph(contourCount, isBoxStored ? readStoredBox(streams.boxes) : null, streams);
}

/** The glyphs laid end to end, each padded to the alignment, and the offset each starts at, with the end last. */
function joinGlyphs(glyphs: readonly Uint8Array[]): { glyf: Uint8Array; offsets: number[] } {
  const padded = glyphs.map((glyph) => Math.ceil(glyph.length / GLYPH_ALIGNMENT) * GLYPH_ALIGNMENT);
  const offsets = [0];
  for (const length of padded) offsets.push(offsets[offsets.length - 1]! + length);
  const glyf = new Uint8Array(offsets[offsets.length - 1]!);
  glyphs.forEach((glyph, index) => glyf.set(glyph, offsets[index]));
  return { glyf, offsets };
}

function locaOf(offsets: readonly number[], format: number): Uint8Array {
  const long = format === LONG_LOCA_FORMAT;
  if (!long && offsets[offsets.length - 1]! > MAX_SHORT_LOCA_OFFSET) {
    throw new Error(
      `expected glyph data within ${MAX_SHORT_LOCA_OFFSET} bytes for a short loca, got ${offsets[offsets.length - 1]}`
    );
  }
  const loca = new DataView(new ArrayBuffer(offsets.length * (long ? 4 : 2)));
  offsets.forEach((offset, index) => {
    if (long) loca.setUint32(index * 4, offset, false);
    else loca.setUint16(index * 2, offset / 2, false);
  });
  return new Uint8Array(loca.buffer);
}

/** Throws on a table that does not hold the streams its header counts, or a glyph the streams do not describe. */
export function rebuildGlyfTables(transformed: Uint8Array): RebuiltGlyf {
  const header = new ByteReader(transformed);
  header.isLittleEndian = false;
  header.u16(); // reserved
  header.u16(); // optionFlags: bit 0 adds an overlap bitmap after the streams, which no reader here needs
  const glyphCount = header.u16();
  const locaFormat = header.u16();
  if (locaFormat !== SHORT_LOCA_FORMAT && locaFormat !== LONG_LOCA_FORMAT) {
    throw new Error(`expected an indexFormat of 0 or 1, got ${locaFormat}`);
  }
  const sizes = Array.from({ length: HEADER_STREAM_COUNT }, () => header.u32());
  const [contourCounts, pointCounts, flags, glyphStream, composites, boxes, instructions] = sizes.map(
    (size) => {
      const stream = new ByteReader(header.take(size));
      stream.isLittleEndian = false;
      return stream;
    }
  ) as [ByteReader, ByteReader, ByteReader, ByteReader, ByteReader, ByteReader, ByteReader];

  // The bitmap sits at the start of the box stream, one bit for each glyph, in whole four-byte words.
  const bitmap = boxes.take(((glyphCount + 31) >> 5) << 2);
  const streams: Streams = {
    contourCounts,
    pointCounts,
    flags,
    glyphStream,
    composites,
    boxes,
    instructions,
  };
  const glyphs = Array.from({ length: glyphCount }, (_, index) => glyphAt(index, bitmap, streams));

  const { glyf, offsets } = joinGlyphs(glyphs);
  return { glyf, loca: locaOf(offsets, locaFormat) };
}
