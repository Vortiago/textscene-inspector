/**
 * Builds a tiny OpenType-CFF font in memory for the CFF reader's tests: a `CFF ` or `CFF2` table
 * with the charstrings a test writes, plus the `cmap` and `head` that `parseSfntOutlines` needs.
 * `charstring` assembles Type 2 operators and operands by name.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import type { GlyphContours } from './glyphContours';
import { parseSfntOutlines } from './sfntOutlines';
import { ByteWriter, cmapTable, headTable, sfntFileBytes } from './sfntOutlines.testkit';

export type CharstringToken = number | OperatorName | { fixed: number } | { raw: readonly number[] };

const OPERATORS = {
  hstem: [1],
  vstem: [3],
  vmoveto: [4],
  rlineto: [5],
  hlineto: [6],
  vlineto: [7],
  rrcurveto: [8],
  callsubr: [10],
  return: [11],
  endchar: [14],
  vsindex: [15],
  blend: [16],
  hstemhm: [18],
  hintmask: [19],
  cntrmask: [20],
  rmoveto: [21],
  hmoveto: [22],
  vstemhm: [23],
  rcurveline: [24],
  rlinecurve: [25],
  vvcurveto: [26],
  hhcurveto: [27],
  callgsubr: [29],
  vhcurveto: [30],
  hvcurveto: [31],
  and: [12, 3],
  or: [12, 4],
  not: [12, 5],
  abs: [12, 9],
  add: [12, 10],
  sub: [12, 11],
  div: [12, 12],
  neg: [12, 14],
  eq: [12, 15],
  drop: [12, 18],
  put: [12, 20],
  get: [12, 21],
  ifelse: [12, 22],
  random: [12, 23],
  mul: [12, 24],
  sqrt: [12, 26],
  dup: [12, 27],
  exch: [12, 28],
  index: [12, 29],
  roll: [12, 30],
  hflex: [12, 34],
  flex: [12, 35],
  hflex1: [12, 36],
  flex1: [12, 37],
} as const;

type OperatorName = keyof typeof OPERATORS;

function operandBytes(value: number): number[] {
  if (value >= -107 && value <= 107) return [value + 139];
  if (value >= 108 && value <= 1131) return [((value - 108) >> 8) + 247, (value - 108) & 0xff];
  if (value <= -108 && value >= -1131) return [((-value - 108) >> 8) + 251, (-value - 108) & 0xff];
  return [28, (value >> 8) & 0xff, value & 0xff];
}

/** The bytes of a charstring written as operands (numbers, `{ fixed }` 16.16 values) and operator names. */
export function charstring(...tokens: readonly CharstringToken[]): number[] {
  return tokens.flatMap((token): number[] => {
    if (typeof token === 'number') return operandBytes(token);
    if (typeof token === 'string') return [...OPERATORS[token]];
    if ('fixed' in token) {
      const fixed = Math.round(token.fixed * 0x10000);
      return [255, (fixed >> 24) & 0xff, (fixed >> 16) & 0xff, (fixed >> 8) & 0xff, fixed & 0xff];
    }
    return [...token.raw];
  });
}

/** The Private DICT entries that place blue zones. The zone arrays are absolute values, which the DICT stores as deltas. */
export interface TestBlues {
  blueValues?: readonly number[];
  otherBlues?: readonly number[];
  familyBlues?: readonly number[];
  familyOtherBlues?: readonly number[];
  blueScale?: number;
  blueShift?: number;
  blueFuzz?: number;
  languageGroup?: number;
}

export interface TestCffFont {
  /** 1 is a `CFF ` table, 2 a `CFF2` table. */
  version?: 1 | 2;
  unitsPerEm: number;
  /** The charstring of each glyph, `.notdef` first. */
  glyphs: readonly (readonly number[])[];
  cmap: ReadonlyMap<number, number>;
  globalSubrs?: readonly (readonly number[])[];
  /** Local subroutines, one list for each font dict. */
  localSubrs?: readonly (readonly (readonly number[])[])[];
  /** The font dict of each glyph, as an `FDSelect` format 3 holds it. One font dict when absent. */
  fdSelect?: readonly number[];
  /** CFF 1: the string id of glyph 1 onward, as a charset holds them: format 0 unless `charsetFormat` says 1 or 2. A 3 writes the range form under a format no CFF defines. */
  charset?: readonly number[];
  charsetFormat?: 0 | 1 | 2 | 3;
  /** CFF 1: names the predefined Expert (1) or Expert Subset (2) charset instead of listing one. */
  predefinedCharset?: 1 | 2;
  /** The blue zones of every font dict. */
  blues?: TestBlues;
  /** CFF2: the region count of each ItemVariationData, and the `vsindex` of the Private DICT. */
  variation?: { regionCounts: readonly number[]; vsindex?: number };
}

const DICT_OPS = {
  blend: [23],
  blueValues: [6],
  otherBlues: [7],
  familyBlues: [8],
  familyOtherBlues: [9],
  blueScale: [12, 9],
  blueShift: [12, 10],
  blueFuzz: [12, 11],
  languageGroup: [12, 17],
  charset: [15],
  charStrings: [17],
  private: [18],
  subrs: [19],
  vsindex: [22],
  varStore: [24],
  ros: [12, 30],
  fdArray: [12, 36],
  fdSelect: [12, 37],
} as const;

/**
 * A DICT operand. An offset is a plain integer of five bytes, so a DICT's size does not depend on
 * the offsets it holds. A value that can be negative is a `small` integer, which takes as few bytes as
 * it can: FreeType on a 64-bit target reads a negative five-byte integer as a large positive one.
 */
type DictOperand = number | { small: number } | { real: number };

type DictEntry = readonly [keyof typeof DICT_OPS, readonly DictOperand[]];

/** The packed-nibble bytes of a real (Technical Note 5176 Table 5), the `30` operator included. */
function realBytes(value: number): number[] {
  const nibbles = [...String(value)].map((char) => (char === '.' ? 0xa : char === '-' ? 0xe : Number(char)));
  nibbles.push(0xf);
  if (nibbles.length % 2 === 1) nibbles.push(0xf);
  const bytes = [30];
  for (let i = 0; i < nibbles.length; i += 2) bytes.push((nibbles[i]! << 4) | nibbles[i + 1]!);
  return bytes;
}

function dict(entries: readonly DictEntry[]): ByteWriter {
  const out = new ByteWriter();
  for (const [name, operands] of entries) {
    for (const operand of operands) {
      if (typeof operand === 'number') out.u8(29).u32(operand >>> 0);
      else {
        for (const byte of 'real' in operand ? realBytes(operand.real) : operandBytes(operand.small))
          out.u8(byte);
      }
    }
    for (const byte of DICT_OPS[name]) out.u8(byte);
  }
  return out;
}

const deltas = (values: readonly number[]) => values.map((value, i) => value - (values[i - 1] ?? 0));

/**
 * The Private DICT entries for `blues`. With `regions` (CFF2), each zone array is a `blend` of
 * its values, every region's delta 0, and the array operator then takes the blended values.
 */
function blueEntries(blues: TestBlues = {}, regions?: number): DictEntry[] {
  const entries: DictEntry[] = [];
  const arrays = ['blueValues', 'otherBlues', 'familyBlues', 'familyOtherBlues'] as const;
  for (const name of arrays) {
    const values = blues[name];
    if (!values) continue;
    const operands = deltas(values).map((small) => ({ small }));
    if (regions === undefined) {
      entries.push([name, operands]);
    } else {
      const noDeltas = Array.from({ length: values.length * regions }, () => ({ small: 0 }));
      entries.push(['blend', [...operands, ...noDeltas, { small: values.length }]], [name, []]);
    }
  }
  if (blues.blueScale !== undefined) entries.push(['blueScale', [{ real: blues.blueScale }]]);
  for (const name of ['blueShift', 'blueFuzz', 'languageGroup'] as const) {
    if (blues[name] !== undefined) entries.push([name, [{ small: blues[name] }]]);
  }
  return entries;
}

function index(entries: readonly (readonly number[])[], isCff2: boolean): ByteWriter {
  const out = new ByteWriter();
  if (isCff2) out.u32(entries.length);
  else out.u16(entries.length);
  if (entries.length === 0) return out;
  out.u8(4);
  let offset = 1;
  out.u32(offset);
  for (const entry of entries) out.u32((offset += entry.length));
  for (const entry of entries) out.raw(entry);
  return out;
}

/** A charset of `format`: one string id for each glyph from 1, or ranges of consecutive ids. */
function charsetTable(sids: readonly number[], format: 0 | 1 | 2 | 3): ByteWriter {
  const out = new ByteWriter().u8(format);
  if (format === 0) {
    for (const sid of sids) out.u16(sid);
    return out;
  }
  for (let i = 0; i < sids.length;) {
    let left = 0;
    while (i + left + 1 < sids.length && sids[i + left + 1] === sids[i]! + left + 1) left++;
    out.u16(sids[i]!);
    if (format === 2) out.u16(left);
    else out.u8(left);
    i += left + 1;
  }
  return out;
}

function fdSelectFormat3(fdSelect: readonly number[]): ByteWriter {
  const ranges: [number, number][] = [];
  fdSelect.forEach((fd, glyph) => {
    if (ranges.at(-1)?.[1] !== fd) ranges.push([glyph, fd]);
  });
  const out = new ByteWriter().u8(3).u16(ranges.length);
  for (const [first, fd] of ranges) out.u16(first).u8(fd);
  return out.u16(fdSelect.length);
}

function varStore(regionCounts: readonly number[]): ByteWriter {
  const datas = regionCounts.map((count) => {
    const data = new ByteWriter().u16(0).u16(0).u16(count);
    for (let i = 0; i < count; i++) data.u16(i);
    return data;
  });
  const header = 2 + 4 + 2 + datas.length * 4;
  const regionList = new ByteWriter().u16(1).u16(Math.max(0, ...regionCounts));
  for (let i = 0; i < Math.max(0, ...regionCounts); i++) regionList.u16(0).u16(0x4000).u16(0x4000);
  const store = new ByteWriter().u16(1).u32(header).u16(datas.length);
  let offset = header + regionList.length;
  for (const data of datas) {
    store.u32(offset);
    offset += data.length;
  }
  store.raw(regionList);
  for (const data of datas) store.raw(data);
  return new ByteWriter().u16(store.length).raw(store);
}

/** Where each part of the table starts, relative to the table. */
interface Positions {
  charset: number;
  charStrings: number;
  fdSelect: number;
  fdArray: number;
  varStore: number;
  privates: number[];
}

const ZERO_POSITIONS: Positions = {
  charset: 0,
  charStrings: 0,
  fdSelect: 0,
  fdArray: 0,
  varStore: 0,
  privates: [],
};
const DICT_ENTRY_SIZE = 6;

function fontDictCount(font: TestCffFont): number {
  return Math.max(1, font.localSubrs?.length ?? 0, ...(font.fdSelect ?? []).map((fd) => fd + 1));
}

/** A Private DICT, and the local subroutines that follow it. */
function privateParts(font: TestCffFont, fd: number): { dict: ByteWriter; subrs: ByteWriter } {
  const subrs = font.localSubrs?.[fd];
  const vsindex = font.version === 2 ? font.variation?.vsindex : undefined;
  const entries = blueEntries(
    font.blues,
    font.version === 2 ? font.variation?.regionCounts[vsindex ?? 0] : undefined
  );
  if (vsindex !== undefined) entries.push(['vsindex', [vsindex]]);
  // The offset of the local subroutines is the size of the whole Private DICT, their own entry the last of it.
  const withSubrs: DictEntry[] = [...entries, ['subrs', [dict(entries).length + DICT_ENTRY_SIZE]]];
  return {
    dict: dict(subrs ? withSubrs : entries),
    subrs: subrs ? index(subrs, font.version === 2) : new ByteWriter(),
  };
}

/** The `CFF ` or `CFF2` table with its offsets taken from `at`, and where its parts then start. */
function assemble(font: TestCffFont, at: Positions): { table: ByteWriter; positions: Positions } {
  const isCff2 = font.version === 2;
  const fdCount = fontDictCount(font);
  const hasFdArray = isCff2 || font.fdSelect !== undefined;
  const privates = Array.from({ length: fdCount }, (_, fd) => privateParts(font, fd));
  const privateSize = (fd: number) => privates[fd]!.dict.length;

  const topEntries: DictEntry[] = [];
  if (!isCff2 && font.charset) topEntries.push(['charset', [at.charset]]);
  if (!isCff2 && font.predefinedCharset) topEntries.push(['charset', [font.predefinedCharset]]);
  topEntries.push(['charStrings', [at.charStrings]]);
  if (hasFdArray)
    topEntries.push(
      ...(isCff2 ? [] : [['ros', [391, 391, 0]] as DictEntry]),
      ['fdArray', [at.fdArray]],
      ['fdSelect', [at.fdSelect]]
    );
  else topEntries.push(['private', [privateSize(0), at.privates[0] ?? 0]]);
  if (isCff2 && font.variation) topEntries.push(['varStore', [at.varStore]]);
  const top = dict(topEntries);

  const header = new ByteWriter();
  const afterTop = new ByteWriter();
  if (isCff2) {
    header.u8(2).u8(0).u8(5).u16(top.length).raw(top);
  } else {
    header.u8(1).u8(0).u8(4).u8(4);
    header
      .raw(index([[0x54]], false))
      .raw(index([top.toBytes()], false))
      .raw(index([], false));
  }
  afterTop.raw(index(font.globalSubrs ?? [], isCff2));

  const blobs: ByteWriter[] = [];
  const positions: Positions = { ...ZERO_POSITIONS, privates: [] };
  let cursor = header.length + afterTop.length;
  const place = (key: 'charset' | 'charStrings' | 'fdSelect' | 'fdArray' | 'varStore', blob: ByteWriter) => {
    positions[key] = cursor;
    blobs.push(blob);
    cursor += blob.length;
  };
  if (!isCff2 && font.charset) place('charset', charsetTable(font.charset, font.charsetFormat ?? 0));
  place('charStrings', index(font.glyphs, isCff2));
  if (hasFdArray) {
    place('fdSelect', fdSelectFormat3(font.fdSelect ?? new Array<number>(font.glyphs.length).fill(0)));
    const fontDicts = privates.map((_, fd) =>
      dict([['private', [privateSize(fd), at.privates[fd] ?? 0]]]).toBytes()
    );
    place('fdArray', index(fontDicts, isCff2));
  }
  if (isCff2 && font.variation) place('varStore', varStore(font.variation.regionCounts));
  privates.forEach(({ dict: privateDict, subrs }) => {
    positions.privates.push(cursor);
    blobs.push(privateDict, subrs);
    cursor += privateDict.length + subrs.length;
  });
  return { table: new ByteWriter().raw(header).raw(afterTop).raw(concat(blobs)), positions };
}

function concat(blobs: readonly ByteWriter[]): ByteWriter {
  return blobs.reduce((all, blob) => all.raw(blob), new ByteWriter());
}

/** The tables FreeType needs beside the outlines to open a font, so Godot can read a test font too. */
function metricTables(font: TestCffFont): [string, ByteWriter][] {
  const hhea = new ByteWriter().u32(0x00010000);
  for (let i = 0; i < 15; i++) hhea.u16(0); // ascender to caretOffset, the reserved words and metricDataFormat
  hhea.u16(font.glyphs.length);
  const hmtx = new ByteWriter();
  for (let i = 0; i < font.glyphs.length; i++) hmtx.u16(font.unitsPerEm).u16(0);
  return [
    ['hhea', hhea],
    ['hmtx', hmtx],
    ['maxp', new ByteWriter().u32(0x00005000).u16(font.glyphs.length)],
  ];
}

/** The font's bytes: an OpenType-CFF file with the `CFF ` or `CFF2` table and the tables around it. */
export function buildTestCffFont(font: TestCffFont): ArrayBuffer {
  // A DICT holds five-byte integers, so its size is the same whatever the offsets: one pass finds the offsets, the next writes them.
  const { positions } = assemble(font, ZERO_POSITIONS);
  const { table } = assemble(font, positions);
  return sfntFileBytes(
    [
      [font.version === 2 ? 'CFF2' : 'CFF ', table],
      ['cmap', cmapTable({ cmap: font.cmap, cmapFormat: 4 })],
      ['head', headTable(font.unitsPerEm)],
      ...metricTables(font),
    ],
    'OTTO'
  );
}

/** The contours as text: the points of a contour in order as `x,y`, a cubic control point as `~x,y`. */
export function contourText(contours: GlyphContours): string[] {
  let first = 0;
  return contours.contourEnds.map((end) => {
    const points = contours.points.slice(first, end + 1);
    first = end + 1;
    return points.map((p) => `${p.tag === ContourPointTag.OFF_CUBIC ? '~' : ''}${p.x},${p.y}`).join(' ');
  });
}

/** What glyph `glyphIndex` of `font` draws at `fontSizePx`, as `contourText`, or null when it draws nothing. */
export function drawnAt(font: TestCffFont, glyphIndex: number, fontSizePx: number): string[] | null {
  const contours = parseSfntOutlines(buildTestCffFont(font))?.glyphContours(glyphIndex, fontSizePx);
  return contours ? contourText(contours) : null;
}
