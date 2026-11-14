/**
 * The PNG image of an embedded bitmap glyph, decoded as FreeType's `Load_SBit_Png` reads it through
 * libpng (`pngshim.c:259-430`): every colour type and bit depth expanded to 8-bit RGBA, then each
 * pixel premultiplied by its alpha into BGRA (`pngshim.c:52-171`).
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import type { EnumValue } from '../../../../../godot/classdb/enumNames';

/** A decoded image: blue, green, red and alpha of each pixel, row by row from the top, the colour premultiplied. */
export interface PngImage {
  readonly width: number;
  readonly height: number;
  readonly bgra: Uint8Array;
}

/** Inflates a zlib stream whole, or throws for a stream that does not inflate. */
export type ZlibInflate = (stream: Uint8Array) => Uint8Array;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** libpng's default `user_width_max` and `user_height_max` (`pnglibconf.h`): a larger image is an error. */
const USER_SIZE_MAX = 1_000_000;

/** The PNG colour types (PNG specification 11.2.2). */
const ColourType = {
  Grey: 0,
  Rgb: 2,
  Palette: 3,
  GreyAlpha: 4,
  RgbAlpha: 6,
} as const;

type ColourTypeValue = EnumValue<typeof ColourType>;

/** The bit depths the PNG specification allows for each colour type (11.2.2). */
const BIT_DEPTHS: ReadonlyMap<number, readonly number[]> = new Map([
  [ColourType.Grey, [1, 2, 4, 8, 16]],
  [ColourType.Rgb, [8, 16]],
  [ColourType.Palette, [1, 2, 4, 8]],
  [ColourType.GreyAlpha, [8, 16]],
  [ColourType.RgbAlpha, [8, 16]],
]);

const CHANNELS: ReadonlyMap<number, number> = new Map([
  [ColourType.Grey, 1],
  [ColourType.Rgb, 3],
  [ColourType.Palette, 1],
  [ColourType.GreyAlpha, 2],
  [ColourType.RgbAlpha, 4],
]);

interface Header {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colourType: ColourTypeValue;
  readonly isInterlaced: boolean;
}

/** The chunks the decode reads. */
interface Chunks {
  readonly header: Header;
  readonly palette: Palette | null;
  /** The alpha of each palette entry, or the 16-bit colour key of a grey or RGB image. */
  readonly transparency: Uint8Array | null;
  readonly imageData: Uint8Array;
}

/**
 * The image of `bytes`, or null where libpng or FreeType fails the read: a broken signature, header,
 * chunk CRC or image data, a missing `IEND`, or an image wider or taller than `0x7FFF`
 * (`pngshim.c:318-323`).
 */
export function decodePng(bytes: Uint8Array, inflate: ZlibInflate): PngImage | null {
  const decoded = decodeStraight(bytes, inflate);
  if (!decoded) return null;
  const { header } = decoded.chunks;
  return {
    width: header.width,
    height: header.height,
    bgra: premultipliedBgra(decoded.rgba, decoded.chunks),
  };
}

/** The straight RGBA of `bytes`, top row first, and the chunks it read. */
function decodeStraight(
  bytes: Uint8Array,
  inflate: ZlibInflate
): { chunks: Chunks; rgba: Uint8Array } | null {
  const chunks = readChunks(bytes);
  if (!chunks || chunks.header.width > 0x7fff || chunks.header.height > 0x7fff) return null;
  let filtered: Uint8Array;
  try {
    filtered = inflate(chunks.imageData);
  } catch {
    // libpng's `png_error` on a broken zlib stream fails the read (`pngshim.c:280-284`).
    return null;
  }
  const samples = unfilteredSamples(filtered, chunks.header);
  return samples && { chunks, rgba: rgbaOf(samples, chunks) };
}

/** The chunks of `bytes`, or null for a file libpng stops on. */
function readChunks(bytes: Uint8Array): Chunks | null {
  if (bytes.length < SIGNATURE.length || SIGNATURE.some((byte, i) => bytes[i] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let header: Header | null = null;
  let palette: Palette | null = null;
  let transparency: Uint8Array | null = null;
  const imageData: Uint8Array[] = [];
  for (let at = SIGNATURE.length; ;) {
    if (at + 12 > bytes.length) return null;
    const length = view.getUint32(at);
    if (length > 0x7fffffff || at + 12 + length > bytes.length) return null;
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    const isCritical = (bytes[at + 4]! & 0x20) === 0;
    const isIntact = crc32(bytes.subarray(at + 4, at + 8 + length)) === view.getUint32(at + 8 + length);
    at += 12 + length;
    // libpng fails a critical chunk with a bad CRC, and drops an ancillary one (`png_crc_finish`).
    if (!isIntact) {
      if (isCritical) return null;
      continue;
    }
    if (!header) {
      if (type !== 'IHDR') return null;
      header = readHeader(body);
      if (!header) return null;
      continue;
    }
    if (type === 'IHDR') return null;
    if (type === 'IEND') {
      if (imageData.length === 0) return null;
      return { header, palette, transparency, imageData: joined(imageData) };
    }
    if (type === 'IDAT') {
      // libpng fails a palette image whose data comes before its palette (`png_handle_IDAT`).
      if (header.colourType === ColourType.Palette && !palette) return null;
      imageData.push(body);
    } else if (type === 'PLTE' && imageData.length === 0) {
      const read = readPalette(body, header);
      if (read === undefined) return null;
      palette = read;
    } else if (type === 'tRNS' && imageData.length === 0)
      transparency = readTransparency(body, header, palette);
    else if (isCritical) return null;
  }
}

function readHeader(body: Uint8Array): Header | null {
  if (body.length !== 13) return null;
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const bitDepth = body[8]!;
  const colourType = body[9]! as ColourTypeValue;
  const interlace = body[12]!;
  if (width === 0 || height === 0 || width > USER_SIZE_MAX || height > USER_SIZE_MAX) return null;
  if (!BIT_DEPTHS.get(colourType)?.includes(bitDepth)) return null;
  if (body[10] !== 0 || body[11] !== 0 || interlace > 1) return null;
  return { width, height, bitDepth, colourType, isInterlaced: interlace === 1 };
}

/** A palette as libpng keeps it: 256 RGB entries, black past the file's own, and the file's count. */
interface Palette {
  readonly entries: Uint8Array;
  readonly count: number;
}

/**
 * The palette of a palette image (`png_handle_PLTE`), null where libpng ignores one, and undefined
 * where it fails the read: no entries or a length that is not whole entries. Entries past what the
 * bit depth reaches are dropped.
 */
function readPalette(body: Uint8Array, { colourType, bitDepth }: Header): Palette | null | undefined {
  if (colourType !== ColourType.Palette) return null;
  if (body.length === 0 || body.length > 256 * 3 || body.length % 3 !== 0) return undefined;
  const count = Math.min(body.length / 3, 1 << bitDepth);
  const entries = new Uint8Array(256 * 3);
  entries.set(body.subarray(0, count * 3));
  return { entries, count };
}

/** The `tRNS` body that libpng keeps, or null for one it drops as invalid (`png_handle_tRNS`). */
function readTransparency(
  body: Uint8Array,
  { colourType }: Header,
  palette: Palette | null
): Uint8Array | null {
  switch (colourType) {
    case ColourType.Grey:
      return body.length === 2 ? body : null;
    case ColourType.Rgb:
      return body.length === 6 ? body : null;
    case ColourType.Palette:
      return palette && body.length > 0 && body.length <= palette.count ? body : null;
    default:
      return null;
  }
}

/** The samples of each pass, unfiltered, as one image of `header`'s size: null where the data runs short. */
function unfilteredSamples(filtered: Uint8Array, header: Header): Uint16Array | null {
  const channels = CHANNELS.get(header.colourType)!;
  const samples = new Uint16Array(header.width * header.height * channels);
  let at = 0;
  for (const pass of passesOf(header)) {
    const width = Math.ceil((header.width - pass.x) / pass.dx);
    const height = Math.ceil((header.height - pass.y) / pass.dy);
    if (width <= 0 || height <= 0) continue;
    const rowBytes = Math.ceil((width * channels * header.bitDepth) / 8);
    const pixelBytes = Math.max(1, (channels * header.bitDepth) / 8);
    let previous: Uint8Array = new Uint8Array(rowBytes);
    for (let row = 0; row < height; row++) {
      if (at + 1 + rowBytes > filtered.length) return null;
      const line = unfilteredRow(
        filtered[at]!,
        filtered.subarray(at + 1, at + 1 + rowBytes),
        previous,
        pixelBytes
      );
      if (!line) return null;
      at += 1 + rowBytes;
      const y = pass.y + row * pass.dy;
      for (let column = 0; column < width; column++) {
        const x = pass.x + column * pass.dx;
        for (let channel = 0; channel < channels; channel++) {
          samples[(y * header.width + x) * channels + channel] = sampleAt(
            line,
            column * channels + channel,
            header.bitDepth
          );
        }
      }
      previous = line;
    }
  }
  return samples;
}

/** The passes of an image: Adam7's seven for an interlaced one (PNG specification, 8.2), else one. */
function passesOf({ isInterlaced }: Header): readonly { x: number; y: number; dx: number; dy: number }[] {
  if (!isInterlaced) return [{ x: 0, y: 0, dx: 1, dy: 1 }];
  return [
    { x: 0, y: 0, dx: 8, dy: 8 },
    { x: 4, y: 0, dx: 8, dy: 8 },
    { x: 0, y: 4, dx: 4, dy: 8 },
    { x: 2, y: 0, dx: 4, dy: 4 },
    { x: 0, y: 2, dx: 2, dy: 4 },
    { x: 1, y: 0, dx: 2, dy: 2 },
    { x: 0, y: 1, dx: 1, dy: 2 },
  ];
}

/** One row with its filter undone (PNG specification, 9.2), or null for a filter type past 4, which libpng fails. */
function unfilteredRow(
  filter: number,
  raw: Uint8Array,
  previous: Uint8Array,
  pixelBytes: number
): Uint8Array | null {
  if (filter > 4) return null;
  const line = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const left = i >= pixelBytes ? line[i - pixelBytes]! : 0;
    const up = previous[i]!;
    const upLeft = i >= pixelBytes ? previous[i - pixelBytes]! : 0;
    line[i] = (raw[i]! + predictor(filter, left, up, upLeft)) & 0xff;
  }
  return line;
}

function predictor(filter: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4:
      return paeth(left, up, upLeft);
    default:
      return 0;
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** Sample `index` of a row of `bitDepth`-bit samples, packed from the high bit. */
function sampleAt(line: Uint8Array, index: number, bitDepth: number): number {
  if (bitDepth === 16) return (line[index * 2]! << 8) | line[index * 2 + 1]!;
  if (bitDepth === 8) return line[index]!;
  const perByte = 8 / bitDepth;
  const shift = 8 - bitDepth * ((index % perByte) + 1);
  return (line[Math.floor(index / perByte)]! >> shift) & ((1 << bitDepth) - 1);
}

/**
 * The image as straight 8-bit RGBA, after the transforms `Load_SBit_Png` sets (`pngshim.c:336-370`):
 * a palette expands to RGB, low grey depths scale to 8 bits, `tRNS` becomes alpha, 16 bits strip to
 * the high byte, grey copies to RGB, and an image with no alpha gets 255.
 */
function rgbaOf(samples: Uint16Array, { header, palette, transparency }: Chunks): Uint8Array {
  const { colourType, bitDepth } = header;
  const pixels = header.width * header.height;
  const rgba = new Uint8Array(pixels * 4);
  const channels = CHANNELS.get(colourType)!;
  const to8 = (sample: number) => (bitDepth === 16 ? sample >> 8 : sample * (255 / ((1 << bitDepth) - 1)));
  const key = colourKeyOf(transparency, header);
  for (let i = 0; i < pixels; i++) {
    const s = i * channels;
    const out = i * 4;
    switch (colourType) {
      case ColourType.Palette: {
        const index = samples[s]!;
        rgba.set(palette!.entries.subarray(index * 3, index * 3 + 3), out);
        rgba[out + 3] = transparency && index < transparency.length ? transparency[index]! : 255;
        break;
      }
      case ColourType.Grey:
      case ColourType.GreyAlpha: {
        const grey = to8(samples[s]!);
        rgba.fill(grey, out, out + 3);
        if (colourType === ColourType.GreyAlpha) rgba[out + 3] = to8(samples[s + 1]!);
        else rgba[out + 3] = key && samples[s] === key[0] ? 0 : 255;
        break;
      }
      default: {
        for (let channel = 0; channel < 3; channel++) rgba[out + channel] = to8(samples[s + channel]!);
        if (colourType === ColourType.RgbAlpha) rgba[out + 3] = to8(samples[s + 3]!);
        else rgba[out + 3] = key && key.every((value, c) => samples[s + c] === value) ? 0 : 255;
      }
    }
  }
  return rgba;
}

/**
 * The colour key of a grey or RGB `tRNS`, masked to the bit depth as libpng masks it before it
 * compares (`png_do_expand`).
 */
function colourKeyOf(transparency: Uint8Array | null, { colourType, bitDepth }: Header): number[] | null {
  if (!transparency || colourType === ColourType.Palette) return null;
  const mask = bitDepth === 16 ? 0xffff : (1 << bitDepth) - 1;
  const key: number[] = [];
  for (let at = 0; at < transparency.length; at += 2)
    key.push(((transparency[at]! << 8) | transparency[at + 1]!) & mask);
  return key;
}

/**
 * FreeType's BGRA from straight RGBA: an image with alpha premultiplies each pixel and clears a
 * transparent one (`premultiply_data`), and an image with none keeps its colour at 255
 * (`convert_bytes_to_data`). `tRNS` gives an image alpha (`pngshim.c:357-358`).
 */
function premultipliedBgra(rgba: Uint8Array, { header, transparency }: Chunks): Uint8Array {
  const hasAlpha =
    header.colourType === ColourType.GreyAlpha ||
    header.colourType === ColourType.RgbAlpha ||
    transparency !== null;
  const bgra = new Uint8Array(rgba.length);
  for (let at = 0; at < rgba.length; at += 4) {
    const alpha = hasAlpha ? rgba[at + 3]! : 255;
    if (alpha === 0) continue;
    bgra[at] = multiplyAlpha(alpha, rgba[at + 2]!);
    bgra[at + 1] = multiplyAlpha(alpha, rgba[at + 1]!);
    bgra[at + 2] = multiplyAlpha(alpha, rgba[at]!);
    bgra[at + 3] = alpha;
  }
  return bgra;
}

/** `multiply_alpha` (`pngshim.c:41-48`): `alpha * colour / 255`, rounded. */
function multiplyAlpha(alpha: number, colour: number): number {
  const product = alpha * colour + 0x80;
  return (product + (product >> 8)) >> 8;
}

function joined(parts: readonly Uint8Array[]): Uint8Array {
  const whole = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let at = 0;
  for (const part of parts) {
    whole.set(part, at);
    at += part.length;
  }
  return whole;
}

/** The CRC-32 of the PNG specification (annex D), of each byte value. Built on the first chunk. */
let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
