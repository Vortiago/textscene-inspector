/**
 * Builds a tiny TrueType font in memory for the outline reader's tests: the tables `openFontOutlines`
 * reads (`head`, `maxp`, `cmap`, `loca`, `glyf`) and nothing else, so a test states the glyphs it
 * needs and no more. Every coordinate is a whole design unit, written as a 16-bit delta.
 * It also reads the font fixtures of `scenes/fixtures/fonts/`.
 */

import { join } from 'node:path';
import { fileBytes } from '../../../../resources/testing/fileBytes';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';

const FIXTURE_FONTS = join(import.meta.dirname, '../../../../../../../scenes/fixtures/fonts');

export function fixtureFontBytes(name: string): ArrayBuffer {
  return fileBytes(join(FIXTURE_FONTS, name));
}

/**
 * A `FontFile` that holds `bytes`, or none, with the `fallbacks` a wrapper chains to.
 *
 * @canonical A FontFile resource fixture for a font test
 */
export function fontFile(bytes: ArrayBuffer | undefined, fallbacks: FontResource[] = []): FontFileResource {
  return { kind: 'file', bytes, mimeType: bytes ? 'font/ttf' : undefined, fallbacks, properties: {} };
}

export interface TestPoint {
  x: number;
  y: number;
  /** On the curve when true, a conic control point when false. */
  on: boolean;
}

export interface TestComponent {
  glyph: number;
  /** The x and y offset, or the point numbers to match when `matchPoints` is set. */
  dx: number;
  dy: number;
  /** `WE_HAVE_A_SCALE`, an F2Dot14 factor. */
  scale?: number;
  /** `ARGS_ARE_XY_VALUES` cleared: the parent point number and the component point number. */
  matchPoints?: readonly [number, number];
}

export type TestGlyph =
  | { kind: 'simple'; contours: readonly (readonly TestPoint[])[] }
  | { kind: 'composite'; components: readonly TestComponent[] }
  | { kind: 'empty' };

export interface TestFontInput {
  unitsPerEm: number;
  /** Glyph 0 is `.notdef`, so list it first. */
  glyphs: readonly TestGlyph[];
  /** Code point to glyph index. */
  cmap: ReadonlyMap<number, number>;
  cmapFormat: 4 | 12;
  /** `sfntVersion` of the container, TrueType by default. `'ttc'` wraps the font as the first face of a collection. */
  container?: 'true' | 'ttc';
}

/** The `sfntVersion` of each container. A collection's first face is TrueType. */
const SFNT_VERSIONS = { true: 0x74727565, OTTO: 0x4f54544f, ttc: 0x00010000 } as const;
type SfntContainer = keyof typeof SFNT_VERSIONS;

const ON_CURVE = 0x01;
const ARG_1_AND_2_ARE_WORDS = 0x0001;
const ARGS_ARE_XY_VALUES = 0x0002;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;

export class ByteWriter {
  private readonly bytes: number[] = [];

  get length(): number {
    return this.bytes.length;
  }

  u8(value: number): this {
    this.bytes.push(value & 0xff);
    return this;
  }

  u16(value: number): this {
    return this.u8(value >> 8).u8(value);
  }

  u32(value: number): this {
    return this.u16(value >>> 16).u16(value & 0xffff);
  }

  raw(other: ByteWriter | readonly number[]): this {
    this.bytes.push(...(other instanceof ByteWriter ? other.bytes : other));
    return this;
  }

  pad4(): this {
    while (this.bytes.length % 4 !== 0) this.bytes.push(0);
    return this;
  }

  toBytes(): number[] {
    return [...this.bytes];
  }
}

/** Each coordinate as its distance from the one before, as `glyf` stores a 16-bit run. */
function writeDeltas(out: ByteWriter, coordinates: readonly number[]): void {
  let previous = 0;
  for (const coordinate of coordinates) {
    out.u16(coordinate - previous);
    previous = coordinate;
  }
}

function simpleGlyphBytes(contours: readonly (readonly TestPoint[])[]): ByteWriter {
  const points = contours.flat();
  const out = new ByteWriter().u16(contours.length);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  out
    .u16(Math.min(...xs))
    .u16(Math.min(...ys))
    .u16(Math.max(...xs))
    .u16(Math.max(...ys));
  let end = -1;
  for (const contour of contours) out.u16((end += contour.length));
  out.u16(0); // instructionLength
  for (const point of points) out.u8(point.on ? ON_CURVE : 0);
  writeDeltas(out, xs);
  writeDeltas(out, ys);
  return out;
}

function compositeGlyphBytes(components: readonly TestComponent[]): ByteWriter {
  const out = new ByteWriter().u16(0xffff).u16(0).u16(0).u16(0).u16(0);
  components.forEach((component, index) => {
    const isLast = index === components.length - 1;
    const matches = component.matchPoints !== undefined;
    const hasScale = component.scale !== undefined;
    out.u16(
      ARG_1_AND_2_ARE_WORDS |
        (matches ? 0 : ARGS_ARE_XY_VALUES) |
        (hasScale ? WE_HAVE_A_SCALE : 0) |
        (isLast ? 0 : MORE_COMPONENTS)
    );
    out.u16(component.glyph);
    out.u16(component.matchPoints?.[0] ?? component.dx).u16(component.matchPoints?.[1] ?? component.dy);
    if (component.scale !== undefined) out.u16(Math.round(component.scale * 16384));
  });
  return out;
}

function glyphBytes(glyph: TestGlyph): ByteWriter {
  switch (glyph.kind) {
    case 'simple':
      return simpleGlyphBytes(glyph.contours);
    case 'composite':
      return compositeGlyphBytes(glyph.components);
    case 'empty':
      return new ByteWriter();
  }
}

function cmapFormat4(cmap: ReadonlyMap<number, number>): ByteWriter {
  const codes = [...cmap.keys()].sort((a, b) => a - b);
  const segCount = codes.length + 1;
  const out = new ByteWriter()
    .u16(4)
    .u16(16 + segCount * 8)
    .u16(0)
    .u16(segCount * 2);
  out.u16(0).u16(0).u16(0); // searchRange, entrySelector, rangeShift: unread
  for (const code of codes) out.u16(code);
  out.u16(0xffff);
  out.u16(0); // reservedPad
  for (const code of codes) out.u16(code);
  out.u16(0xffff);
  for (const code of codes) out.u16(cmap.get(code)! - code);
  out.u16(1);
  for (let i = 0; i < segCount; i++) out.u16(0);
  return out;
}

function cmapFormat12(cmap: ReadonlyMap<number, number>): ByteWriter {
  const codes = [...cmap.keys()].sort((a, b) => a - b);
  const out = new ByteWriter()
    .u16(12)
    .u16(0)
    .u32(16 + codes.length * 12)
    .u32(0)
    .u32(codes.length);
  for (const code of codes) out.u32(code).u32(code).u32(cmap.get(code)!);
  return out;
}

export function cmapTable({ cmap, cmapFormat }: Pick<TestFontInput, 'cmap' | 'cmapFormat'>): ByteWriter {
  const subtable = cmapFormat === 4 ? cmapFormat4(cmap) : cmapFormat12(cmap);
  const [platform, encoding] = cmapFormat === 4 ? [3, 1] : [3, 10];
  return new ByteWriter().u16(0).u16(1).u16(platform).u16(encoding).u32(12).raw(subtable);
}

function locaAndGlyf(glyphs: readonly TestGlyph[]): { loca: ByteWriter; glyf: ByteWriter } {
  const glyf = new ByteWriter();
  const loca = new ByteWriter().u32(0);
  for (const glyph of glyphs) {
    glyf.raw(glyphBytes(glyph)).pad4();
    loca.u32(glyf.length);
  }
  return { loca, glyf };
}

export function headTable(unitsPerEm: number): ByteWriter {
  const out = new ByteWriter().u32(0x00010000).u32(0).u32(0).u32(0x5f0f3cf5).u16(0).u16(unitsPerEm);
  for (let i = 0; i < 16; i++) out.u8(0); // created, modified
  for (let i = 0; i < 8; i++) out.u8(0); // bounding box
  out.u16(0).u16(8).u16(2); // macStyle, lowestRecPPEM, fontDirectionHint
  out.u16(1).u16(0); // indexToLocFormat: long offsets, glyphDataFormat
  return out;
}

export function maxpTable(numGlyphs: number): ByteWriter {
  return new ByteWriter().u32(0x00010000).u16(numGlyphs).raw(new Array<number>(26).fill(0));
}

/** The bytes of an sfnt file whose directory lists `tables`, each padded to four bytes. */
export function sfntFileBytes(
  tables: readonly (readonly [string, ByteWriter])[],
  container?: SfntContainer
): ArrayBuffer {
  const sfntStart = container === 'ttc' ? 16 : 0;
  const directorySize = 12 + tables.length * 16;
  const out = new ByteWriter();
  if (container === 'ttc') out.u32(0x74746366).u16(1).u16(0).u32(1).u32(sfntStart);
  out
    .u32(container ? SFNT_VERSIONS[container] : 0x00010000)
    .u16(tables.length)
    .u16(0)
    .u16(0)
    .u16(0);
  let offset = sfntStart + directorySize;
  for (const [tag, table] of tables) {
    for (const char of tag) out.u8(char.charCodeAt(0));
    out.u32(0).u32(offset).u32(table.length);
    offset += Math.ceil(table.length / 4) * 4;
  }
  for (const [, table] of tables) out.raw(table).pad4();
  return new Uint8Array(out.toBytes()).buffer;
}

/** The font's bytes, whole, with the tables in one directory and each padded to four bytes. */
export function buildTestFont(input: TestFontInput): ArrayBuffer {
  const { loca, glyf } = locaAndGlyf(input.glyphs);
  return sfntFileBytes(
    [
      ['cmap', cmapTable(input)],
      ['glyf', glyf],
      ['head', headTable(input.unitsPerEm)],
      ['loca', loca],
      ['maxp', maxpTable(input.glyphs.length)],
    ],
    input.container
  );
}
