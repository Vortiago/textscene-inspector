/**
 * Reads the descriptor of an AngelCode BMFont, text or binary, as `FontFile::_load_bitmap_font`
 * does (`scene/resources/font.cpp:1463-2073`). The parse takes bytes, so it runs without a file or
 * an image: the pages it names are decoded apart (`pageFill.ts`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { stringToInt } from '../../../godot/string/string';
import type { BitmapGlyph } from '../../fonts/font/types';
import { OEM_TO_UNICODE } from './oemTables';

/** The fixed size of a descriptor whose `info size` is 0 or absent (`font.cpp:1478`). */
const DEFAULT_FIXED_SIZE = 16;

/** The encoding number Godot gives a descriptor with no OEM charset: no mapping (`font.cpp:1497,1807`). */
const NO_OEM_ENCODING = 9;

/** The `info` charset names a text descriptor accepts, by encoding number (`font.cpp:1831-1851`). */
const OEM_ENCODING_BY_CHARSET_NAME: Readonly<Record<string, number>> = {
  '': 2,
  ASCII: 2,
  ANSI: 2,
  ARABIC: 6,
  BALTIC: 7,
  EASTEUROPE: 0,
  GREEK: 3,
  HEBREW: 5,
  RUSSIAN: 1,
  TURKISH: 4,
  VIETNAMESE: 8,
};

/** The charset byte of a binary `info` block, by encoding number (`font.cpp:1526-1566`). */
const OEM_ENCODING_BY_CHARSET_BYTE: Readonly<Record<number, number>> = {
  0x00: 2,
  0xb2: 6,
  0xba: 7,
  0xee: 0,
  0xa1: 3,
  0xb1: 5,
  0xcc: 1,
  0xa2: 4,
  0xa3: 8,
};

export type DescriptorFormat = 'text' | 'binary';

/** How a page image is read: the channel settings of the `common` line when the page was named. */
export interface PageLayout {
  /** Which format named the page: the text loader has one more colour layout (`font.cpp:1893`). */
  format: DescriptorFormat;
  packed: boolean;
  /** `common` `redChnl`, `greenChnl`, `blueChnl`, `alphaChnl`: 0 glyph, 1 outline, 2 both, 3 zero, 4 one. */
  channels: readonly [number, number, number, number];
  outline: number;
  /** The first channel that holds the glyph (value 0), or -1. In RGBA order. */
  firstGlyphChannel: number;
  /** The first channel that holds the outline (value 1), or -1. */
  firstOutlineChannel: number;
  /** The first channel that holds both (value 2), or -1. */
  firstCombinedChannel: number;
}

export interface BmfontPage {
  id: number;
  /** The file name as the descriptor spells it, relative to the descriptor's folder. */
  file: string;
  layout: PageLayout;
}

export interface BmfontDescriptor {
  fixedSize: number;
  ascent: number;
  descent: number;
  glyphs: Map<number, BitmapGlyph>;
  kerning: Map<number, number>;
  pages: BmfontPage[];
}

/** The key of a kerning pair: `first` and `second` are Unicode codepoints, at most 21 bits each. */
export function kerningKey(first: number, second: number): number {
  return first * 0x200000 + second;
}

/** `info` as both formats give it. */
interface InfoBlock {
  size: number;
  outline: number | undefined;
  encoding: number;
}

/** `common` as both formats give it. */
interface CommonBlock {
  height: number | undefined;
  ascent: number | undefined;
  packed: boolean | undefined;
  /** In `redChnl`, `greenChnl`, `blueChnl`, `alphaChnl` order; an absent key is undefined. */
  channels: readonly (number | undefined)[];
}

interface GlyphRow {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
  page: number;
  channel: number;
}

/**
 * The state `_load_bitmap_font` carries between lines and blocks. Each format feeds it the same
 * calls, so the two share the charset mapping, the baseline offset and the page layout rules.
 */
class DescriptorBuilder {
  constructor(private readonly format: DescriptorFormat) {}

  private fixedSize = DEFAULT_FIXED_SIZE;
  private height = 0;
  private ascent = 0;
  private outline = 0;
  private encoding = NO_OEM_ENCODING;
  private packed = false;
  private channels: [number, number, number, number] = [0, 0, 0, 0];
  private firstGlyph = -1;
  private firstOutline = -1;
  private firstCombined = -1;
  private readonly glyphs = new Map<number, BitmapGlyph>();
  private readonly kerning = new Map<number, number>();
  private readonly pages: BmfontPage[] = [];

  /** `size` is the file's, so 0 and a sign are read here. A negative size is its magnitude. */
  setInfo({ size, outline, encoding }: InfoBlock): void {
    this.fixedSize = Math.abs(size) || DEFAULT_FIXED_SIZE;
    if (outline !== undefined) this.outline = outline;
    this.encoding = encoding;
  }

  setCommon({ height, ascent, packed, channels }: CommonBlock): void {
    if (height !== undefined) this.height = height;
    if (ascent !== undefined) this.ascent = ascent;
    if (packed !== undefined) this.packed = packed;
    channels.forEach((value, index) => {
      if (value !== undefined) this.channels[index] = value;
    });
    this.channels.forEach((value, index) => {
      if (value === 0 && this.firstGlyph === -1) this.firstGlyph = index;
      if (value === 1 && this.firstOutline === -1) {
        this.firstOutline = index;
        if (this.outline === 0) this.outline = 1;
      }
      if (value === 2 && this.firstCombined === -1) this.firstCombined = index;
    });
  }

  addPage(id: number, file: string): void {
    this.pages.push({
      id,
      file,
      layout: {
        format: this.format,
        packed: this.packed,
        channels: [...this.channels],
        outline: this.outline,
        firstGlyphChannel: this.firstGlyph,
        firstOutlineChannel: this.firstOutline,
        firstCombinedChannel: this.firstCombined,
      },
    });
  }

  addGlyph(row: GlyphRow): void {
    const advance = row.xadvance < 0 ? row.width + 1 : row.xadvance;
    this.glyphs.set(this.toUnicode(row.id), {
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      offsetX: row.xoffset,
      offsetY: row.yoffset - this.ascent,
      advance,
      fillIndex: row.page * (this.packed ? 4 : 1) + this.channelOffset(row.channel),
    });
  }

  addKerning(first: number, second: number, amount: number): void {
    this.kerning.set(kerningKey(this.toUnicode(first), this.toUnicode(second)), amount);
  }

  /** `chnl` selects one of the four textures of a packed page (`font.cpp:1636-1657`). */
  private channelOffset(channel: number): number {
    if (!this.packed) return 0;
    switch (channel) {
      case 1:
        return 2;
      case 2:
        return 1;
      case 8:
        return 3;
      default:
        return 0;
    }
  }

  /** A character code through the OEM table of a non-Unicode descriptor; a code past 0xFF reads as 0. */
  private toUnicode(code: number): number {
    if (this.encoding >= NO_OEM_ENCODING) return code;
    if (code >= 0x80 && code <= 0xff) return OEM_TO_UNICODE[this.encoding]![code - 0x80]!;
    return code > 0xff ? 0 : code;
  }

  build(): BmfontDescriptor {
    return {
      fixedSize: this.fixedSize,
      ascent: this.ascent,
      descent: this.height - this.ascent,
      glyphs: this.glyphs,
      kerning: this.kerning,
      pages: this.pages,
    };
  }
}

const BINARY_MAGIC = 'BMF';
const BINARY_VERSION = 3;
/** `BMF` and the version byte. */
const BINARY_HEADER_SIZE = 4;
/** A block's type byte and its 32-bit size. */
const BLOCK_HEADER_SIZE = 5;

/** Bytes of a BMFont: `BMF` and a version byte for the binary format, else text. Throws on a file Godot refuses. */
export function parseDescriptor(bytes: ArrayBuffer): BmfontDescriptor {
  const view = new Uint8Array(bytes);
  const isBinary = BINARY_MAGIC.split('').every((char, index) => view[index] === char.charCodeAt(0));
  const builder = new DescriptorBuilder(isBinary ? 'binary' : 'text');
  if (isBinary) parseBinary(bytes, builder);
  else parseText(new TextDecoder().decode(bytes), builder);
  return builder.build();
}

/** The bytes after a binary block's header: `version`, then blocks of a type byte, a size and a body. */
function parseBinary(bytes: ArrayBuffer, builder: DescriptorBuilder): void {
  const view = new DataView(bytes);
  if (bytes.byteLength < BINARY_HEADER_SIZE)
    throw new Error('A binary BMFont needs a version byte after BMF.');
  const version = view.getUint8(3);
  if (version !== BINARY_VERSION) {
    throw new Error(`Version ${version} of BMFont is not supported (should be ${BINARY_VERSION}).`);
  }
  let position = BINARY_HEADER_SIZE;
  while (position < bytes.byteLength) {
    const headerLeft = bytes.byteLength - position;
    if (headerLeft < BLOCK_HEADER_SIZE) {
      throw new Error(
        `BMFont block header at byte ${position} needs ${BLOCK_HEADER_SIZE} bytes, but only ${headerLeft} remain.`
      );
    }
    const type = view.getUint8(position);
    const size = view.getUint32(position + 1, true);
    const body = position + BLOCK_HEADER_SIZE;
    if (body + size > bytes.byteLength) {
      throw new Error(
        `BMFont block ${type} needs ${size} bytes, but only ${bytes.byteLength - body} remain.`
      );
    }
    const reader = BINARY_BLOCK_READERS[type];
    if (!reader) throw new Error(`Invalid BMFont block type ${type}.`);
    reader(view, body, size, builder);
    position = body + size;
  }
}

/** The `info` block (`font.cpp:1503-1578`): a binary descriptor's charset byte names an OEM code page unless the font is Unicode. */
function readInfoBlock(view: DataView, body: number, size: number, builder: DescriptorBuilder): void {
  if (size < 15) throw new Error('Invalid BMFont info block size.');
  const flags = view.getUint8(body + 2);
  const isUnicode = (flags & (1 << 6)) !== 0;
  const charset = view.getUint8(body + 3);
  builder.setInfo({
    size: view.getInt16(body, true),
    outline: view.getUint8(body + 13),
    encoding: isUnicode ? NO_OEM_ENCODING : (OEM_ENCODING_BY_CHARSET_BYTE[charset] ?? NO_OEM_ENCODING),
  });
}

/** The `common` block (`font.cpp:1580-1603`): the four channel bytes follow the flags as alpha, red, green, blue. */
function readCommonBlock(view: DataView, body: number, size: number, builder: DescriptorBuilder): void {
  if (size !== 15) throw new Error('Invalid BMFont common block size.');
  builder.setCommon({
    height: view.getUint16(body, true),
    ascent: view.getUint16(body + 2, true),
    packed: (view.getUint8(body + 10) & 1) !== 0,
    channels: [
      view.getUint8(body + 12),
      view.getUint8(body + 13),
      view.getUint8(body + 14),
      view.getUint8(body + 11),
    ],
  });
}

/** The `pages` block: null-terminated file names, one per page. */
function readPagesBlock(view: DataView, body: number, size: number, builder: DescriptorBuilder): void {
  const names = new TextDecoder().decode(new Uint8Array(view.buffer, body, size));
  names
    .split('\0')
    .slice(0, -1)
    .forEach((file, id) => builder.addPage(id, file));
}

const CHAR_RECORD_BYTES = 20;

/** The `chars` block: 20 bytes a character (`font.cpp:1626-1698`). */
function readCharsBlock(view: DataView, body: number, size: number, builder: DescriptorBuilder): void {
  for (let at = body; at + CHAR_RECORD_BYTES <= body + size; at += CHAR_RECORD_BYTES) {
    builder.addGlyph({
      id: view.getUint32(at, true),
      x: view.getInt16(at + 4, true),
      y: view.getInt16(at + 6, true),
      width: view.getInt16(at + 8, true),
      height: view.getInt16(at + 10, true),
      xoffset: view.getInt16(at + 12, true),
      yoffset: view.getInt16(at + 14, true),
      xadvance: view.getInt16(at + 16, true),
      page: view.getUint8(at + 18),
      channel: view.getUint8(at + 19),
    });
  }
}

const KERNING_RECORD_BYTES = 10;

/** The `kerning` block: 10 bytes a pair. */
function readKerningBlock(view: DataView, body: number, size: number, builder: DescriptorBuilder): void {
  for (let at = body; at + KERNING_RECORD_BYTES <= body + size; at += KERNING_RECORD_BYTES) {
    builder.addKerning(view.getUint32(at, true), view.getUint32(at + 4, true), view.getInt16(at + 8, true));
  }
}

const BINARY_BLOCK_READERS: Readonly<
  Record<number, (view: DataView, body: number, size: number, builder: DescriptorBuilder) => void>
> = { 1: readInfoBlock, 2: readCommonBlock, 3: readPagesBlock, 4: readCharsBlock, 5: readKerningBlock };

/**
 * The `key=value` pairs of one text line after its type word. A quoted value ends at the next quote,
 * and an unquoted one at the next space, which the value keeps (`font.cpp:1779-1805`).
 */
function parseKeys(line: string, start: number): Map<string, string> {
  const keys = new Map<string, string>();
  let position = start;
  while (line[position] === ' ') position++;
  while (position < line.length) {
    const equals = line.indexOf('=', position);
    if (equals === -1) break;
    const key = line.slice(position, equals);
    let value: string;
    if (line[equals + 1] === '"') {
      const end = line.indexOf('"', equals + 2);
      if (end === -1) break;
      value = line.slice(equals + 2, end);
      position = end + 1;
    } else {
      const space = line.indexOf(' ', equals + 1);
      const end = space === -1 ? line.length : space;
      value = line.slice(equals + 1, end + 1);
      position = end;
    }
    while (line[position] === ' ') position++;
    keys.set(key, value);
  }
  return keys;
}

/** The integer of `key`, or undefined for a key the line lacks. */
function intOf(keys: Map<string, string>, key: string): number | undefined {
  const value = keys.get(key);
  return value === undefined ? undefined : stringToInt(value);
}

/** Undefined when the line does not name `packed`, so the font keeps the layout it has. */
function packedFlag(keys: Map<string, string>): boolean | undefined {
  const packed = intOf(keys, 'packed');
  return packed === undefined ? undefined : packed === 1;
}

/** The OEM encoding a text `info` line names, `NO_OEM_ENCODING` for a Unicode font or a name Godot does not know. */
function textEncoding(keys: Map<string, string>): number {
  if (intOf(keys, 'unicode')) return NO_OEM_ENCODING;
  const charset = keys.get('charset');
  if (charset === undefined) return OEM_ENCODING_BY_CHARSET_NAME['']!;
  return OEM_ENCODING_BY_CHARSET_NAME[charset.toUpperCase()] ?? NO_OEM_ENCODING;
}

/** The line types the text loader reads (`font.cpp:1796-2030`). */
const TEXT_LINE_TYPES: ReadonlySet<string> = new Set(['info', 'common', 'page', 'char', 'kerning']);

function parseText(text: string, builder: DescriptorBuilder): void {
  for (const rawLine of text.split('\n')) {
    const space = rawLine.indexOf(' ');
    const type = space === -1 ? rawLine : rawLine.slice(0, space);
    // `chars` and `kernings` lines, and any other type the loader ignores, build no key map.
    if (!TEXT_LINE_TYPES.has(type)) continue;
    const keys = parseKeys(rawLine.replace(/\r/g, '').split('\0')[0]!, space + 1);
    switch (type) {
      case 'info':
        builder.setInfo({
          size: intOf(keys, 'size') ?? DEFAULT_FIXED_SIZE,
          outline: intOf(keys, 'outline'),
          encoding: textEncoding(keys),
        });
        break;
      case 'common':
        builder.setCommon({
          height: intOf(keys, 'lineHeight'),
          ascent: intOf(keys, 'base'),
          packed: packedFlag(keys),
          channels: ['redChnl', 'greenChnl', 'blueChnl', 'alphaChnl'].map((key) => intOf(keys, key)),
        });
        break;
      case 'page':
        if (keys.has('file')) builder.addPage(intOf(keys, 'id') ?? 0, keys.get('file')!);
        break;
      case 'char':
        builder.addGlyph({
          id: intOf(keys, 'id') ?? 0,
          x: intOf(keys, 'x') ?? 0,
          y: intOf(keys, 'y') ?? 0,
          width: intOf(keys, 'width') ?? 0,
          height: intOf(keys, 'height') ?? 0,
          xoffset: intOf(keys, 'xoffset') ?? 0,
          yoffset: intOf(keys, 'yoffset') ?? 0,
          xadvance: intOf(keys, 'xadvance') ?? 0,
          page: intOf(keys, 'page') ?? -1,
          channel: intOf(keys, 'chnl') ?? 15,
        });
        break;
      case 'kerning':
        if (keys.has('amount')) {
          builder.addKerning(intOf(keys, 'first') ?? 0, intOf(keys, 'second') ?? 0, intOf(keys, 'amount')!);
        }
        break;
    }
  }
}
