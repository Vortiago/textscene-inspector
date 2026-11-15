/**
 * The bitmap of a glyph in a `CBLC` or `EBLC` strike, decoded as FreeType's sbit decoder decodes it
 * (`ttsbit.c:473-1440`): the index subtable of formats 1 to 5 that locates it, and its image in
 * `CBDT` or `EBDT` formats 1, 2, 5, 6, 7, 8 and 9, or the PNG of formats 17, 18 and 19.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import { bytesView } from '../../../../../utils/bytesView';
import { toInt8 } from '../../../../../godot/variant/intWidth';
import { orOnRangeError } from '../sfntCmap';
import { decodePng, type ZlibInflate } from './png';
import type { SbitStrike, SbitTables } from './sbitStrikes';
import { pixelLayoutOf, type StrikeBitmap, type StrikePixelMode } from './strikeBitmap';

/** `TT_SBit_MetricsRec`: the decoder's one metrics record, which a compound glyph's components overwrite. */
interface SbitMetrics {
  width: number;
  height: number;
  horiBearingX: number;
  horiBearingY: number;
}

/** The bitmap the decoder writes into, allocated at the first image it reaches. */
interface DecodedBitmap {
  readonly pixelMode: StrikePixelMode;
  readonly width: number;
  readonly rows: number;
  readonly pitch: number;
  readonly buffer: Uint8Array;
}

/** `TT_SBitDecoderRec`. */
interface Decoder {
  readonly locator: Uint8Array;
  readonly data: Uint8Array;
  readonly indexArray: number;
  readonly indexCount: number;
  readonly bitDepth: number;
  readonly inflate: ZlibInflate;
  readonly metrics: SbitMetrics;
  isMetricsLoaded: boolean;
  bitmap: DecodedBitmap | null;
}

/** FreeType's failure of a glyph load: the glyph has no bitmap, whatever the cause. */
class NoBitmap extends Error {}

/** FreeType's limit on nested compound glyphs (`ttsbit.c:1252`). */
const MAX_RECURSION = 100;

/** The bitmap of `glyph` in `strike`, or null where FreeType's load fails (`tt_face_load_sbit_image`). */
export function readLocatorGlyph(
  tables: SbitTables,
  strike: SbitStrike,
  glyph: number,
  inflate: ZlibInflate
): StrikeBitmap | null {
  const decoder = decoderOf(tables, strike, inflate);
  if (!decoder) return null;
  const isLoaded = orOnRangeError(() => {
    try {
      loadImage(decoder, glyph, 0, 0, 0);
      return true;
    } catch (error) {
      if (error instanceof NoBitmap) return false;
      throw error;
    }
  }, false);
  const { bitmap, metrics } = decoder;
  if (!isLoaded) return null;
  if (!bitmap) return null;
  return { ...bitmap, left: metrics.horiBearingX, top: metrics.horiBearingY };
}

/** `tt_sbit_decoder_init` (`ttsbit.c:473-534`), or null for a strike record past the locator. */
function decoderOf(
  { locator, data }: SbitTables,
  { tableIndex }: SbitStrike,
  inflate: ZlibInflate
): Decoder | null {
  if (8 + 48 * tableIndex + 3 * 4 + 34 + 1 > locator.length) return null;
  const view = bytesView(locator);
  const record = 8 + 48 * tableIndex;
  const indexArray = view.getUint32(record);
  const indexCount = view.getUint32(record + 8);
  if (indexArray > locator.length || indexCount > Math.floor((locator.length - indexArray) / 8)) return null;
  return {
    locator,
    data,
    indexArray,
    indexCount,
    bitDepth: locator[record + 46]!,
    inflate,
    metrics: { width: 0, height: 0, horiBearingX: 0, horiBearingY: 0 },
    isMetricsLoaded: false,
    bitmap: null,
  };
}

/** `tt_sbit_decoder_load_image` (`ttsbit.c:1233-1440`): finds the glyph's image and decodes it at `(x, y)`. */
function loadImage(decoder: Decoder, glyph: number, x: number, y: number, depth: number): void {
  if (depth > MAX_RECURSION) throw new NoBitmap();
  const { locator, indexArray } = decoder;
  const view = bytesView(locator);
  let range = indexArray;
  let first = -1;
  for (let left = decoder.indexCount; left > 0; left--, range += 8) {
    const start = view.getUint16(range);
    const end = view.getUint16(range + 2);
    if (glyph >= start && glyph <= end) {
      first = start;
      break;
    }
  }
  if (first < 0) throw new NoBitmap();
  const subtableOffset = view.getUint32(range + 4);
  if (subtableOffset > locator.length - indexArray) throw new NoBitmap();
  const at = indexArray + subtableOffset;
  if (at + 8 > locator.length) throw new NoBitmap();
  const indexFormat = view.getUint16(at);
  const imageFormat = view.getUint16(at + 2);
  const imageOffset = view.getUint32(at + 4);
  const { start, end } = imageSpan(decoder, indexFormat, at + 8, glyph - first, glyph);
  if (start > end) throw new NoBitmap();
  loadBitmap(decoder, imageFormat, imageOffset + start, end - start, x, y, depth);
}

/** Where the glyph's image starts and ends past the subtable's image offset, by the index format. */
function imageSpan(
  decoder: Decoder,
  indexFormat: number,
  at: number,
  rangeIndex: number,
  glyph: number
): { start: number; end: number } {
  const { locator } = decoder;
  const view = bytesView(locator);
  const limit = locator.length;
  switch (indexFormat) {
    case 1: {
      const entry = at + 4 * rangeIndex;
      if (entry + 8 > limit) throw new NoBitmap();
      const span = { start: view.getUint32(entry), end: view.getUint32(entry + 4) };
      if (span.start === span.end) throw new NoBitmap();
      return span;
    }
    case 2: {
      if (at + 12 > limit) throw new NoBitmap();
      const imageSize = view.getUint32(at);
      if (!loadMetrics(decoder, locator, at + 4, limit, true)) throw new NoBitmap();
      return { start: imageSize * rangeIndex, end: imageSize * rangeIndex + imageSize };
    }
    case 3: {
      const entry = at + 2 * rangeIndex;
      if (entry + 4 > limit) throw new NoBitmap();
      const span = { start: view.getUint16(entry), end: view.getUint16(entry + 2) };
      if (span.start === span.end) throw new NoBitmap();
      return span;
    }
    case 4: {
      if (at + 4 > limit) throw new NoBitmap();
      const count = view.getUint32(at);
      const pairs = at + 4;
      if (pairs + 4 > limit || count > ((limit - pairs) >> 2) - 1) throw new NoBitmap();
      for (let i = 0; i < count; i++) {
        if (view.getUint16(pairs + 4 * i) === glyph)
          return { start: view.getUint16(pairs + 4 * i + 2), end: view.getUint16(pairs + 4 * i + 6) };
      }
      throw new NoBitmap();
    }
    case 5:
    case 19: {
      if (at + 16 > limit) throw new NoBitmap();
      const imageSize = view.getUint32(at);
      if (!loadMetrics(decoder, locator, at + 4, limit, true)) throw new NoBitmap();
      const count = view.getUint32(at + 12);
      const codes = at + 16;
      if (count > (limit - codes) >> 1) throw new NoBitmap();
      for (let i = 0; i < count; i++) {
        if (view.getUint16(codes + 2 * i) === glyph)
          return { start: imageSize * i, end: imageSize * i + imageSize };
      }
      throw new NoBitmap();
    }
    default:
      throw new NoBitmap();
  }
}

/**
 * `tt_sbit_decoder_load_metrics` (`ttsbit.c:615-662`): small metrics, or big ones, of which the
 * vertical part goes unread here. False for metrics past `limit`.
 */
function loadMetrics(
  decoder: Decoder,
  bytes: Uint8Array,
  at: number,
  limit: number,
  isBig: boolean
): boolean {
  if (at + 5 > limit || (isBig && at + 8 > limit)) return false;
  const { metrics } = decoder;
  metrics.height = bytes[at]!;
  metrics.width = bytes[at + 1]!;
  metrics.horiBearingX = toInt8(bytes[at + 2]!);
  metrics.horiBearingY = toInt8(bytes[at + 3]!);
  decoder.isMetricsLoaded = true;
  return true;
}

/** Bytes of metrics before the image of each image format: small 5, big 8, or none. */
const METRICS_SIZE: Readonly<Record<number, number>> = { 1: 5, 2: 5, 8: 5, 17: 5, 6: 8, 7: 8, 9: 8, 18: 8 };

/** `tt_sbit_decoder_load_bitmap` (`ttsbit.c:1083-1231`): the image of `size` bytes at `start` in the data. */
function loadBitmap(
  decoder: Decoder,
  imageFormat: number,
  start: number,
  size: number,
  x: number,
  y: number,
  depth: number
): void {
  if (size === 0 || start + size > decoder.data.length) throw new NoBitmap();
  const image = decoder.data.subarray(start, start + size);
  let at = 0;
  const metricsSize = METRICS_SIZE[imageFormat];
  if (metricsSize !== undefined) {
    if (!loadMetrics(decoder, image, 0, image.length, metricsSize === 8)) throw new NoBitmap();
    at = metricsSize;
  }
  const load = imageLoader(decoder, imageFormat, image, at);
  if (imageFormat === 8) {
    if (at + 1 > image.length) throw new NoBitmap();
    at += 1;
  }
  if (!decoder.bitmap) decoder.bitmap = allocatedBitmap(decoder);
  load(decoder, image.subarray(at), x, y, depth);
}

type ImageLoader = (decoder: Decoder, image: Uint8Array, x: number, y: number, depth: number) => void;

/** The loader of an image format, or a failure for a format FreeType does not decode. */
function imageLoader(decoder: Decoder, imageFormat: number, image: Uint8Array, at: number): ImageLoader {
  switch (imageFormat) {
    case 1:
    case 6:
      return loadByteAligned;
    case 2:
    case 7: {
      // FreeType reads a bit-aligned format holding exactly a byte-aligned image's bytes as
      // byte-aligned, as one Apple font labels it wrongly (`ttsbit.c:1137-1159`).
      const { width, height } = decoder.metrics;
      const bitSize = (width * height + 7) >> 3;
      const byteSize = height * ((width + 7) >> 3);
      return bitSize < byteSize && byteSize === image.length - at ? loadByteAligned : loadBitAligned;
    }
    case 5:
      return loadBitAligned;
    case 8:
    case 9:
      return loadCompound;
    case 17:
    case 18:
    case 19:
      return loadPng;
    default:
      throw new NoBitmap();
  }
}

/** `tt_sbit_decoder_alloc_bitmap` (`ttsbit.c:543-612`): a cleared bitmap of the metrics loaded so far. */
function allocatedBitmap({ isMetricsLoaded, metrics, bitDepth }: Decoder): DecodedBitmap {
  if (!isMetricsLoaded) throw new NoBitmap();
  const layout = pixelLayoutOf(bitDepth, metrics.width);
  if (!layout) throw new NoBitmap();
  return {
    ...layout,
    width: metrics.width,
    rows: metrics.height,
    buffer: new Uint8Array(layout.pitch * metrics.height),
  };
}

/** The bitmap and the image's place in it, or a failure where the image does not fit (`ttsbit.c:706-722`). */
function placedImage(decoder: Decoder, x: number, y: number): { bitmap: DecodedBitmap; lineBits: number } {
  const bitmap = decoder.bitmap!;
  const { width, height } = decoder.metrics;
  if (x < 0 || x + width > bitmap.width || y < 0 || y + height > bitmap.rows) throw new NoBitmap();
  return { bitmap, lineBits: width * decoder.bitDepth };
}

/** `tt_sbit_decoder_load_byte_aligned` (`ttsbit.c:683-825`): rows padded to whole bytes, ORed in at `(x, y)`. */
function loadByteAligned(decoder: Decoder, image: Uint8Array, x: number, y: number): void {
  const { bitmap, lineBits } = placedImage(decoder, x, y);
  const { height } = decoder.metrics;
  if (((lineBits + 7) >> 3) * height > image.length) throw new NoBitmap();
  const { buffer, pitch } = bitmap;
  let line = y * pitch + (x >> 3);
  const shift = x & 7;
  let p = 0;
  for (let h = height; h > 0; h--, line += pitch) {
    let write = line;
    let w = lineBits;
    if (shift === 0) {
      for (; w >= 8; w -= 8) buffer[write++]! |= image[p++]!;
      if (w > 0) buffer[write]! |= image[p++]! & (0xff00 >> w);
      continue;
    }
    let value = 0;
    for (; w >= 8; w -= 8) {
      value |= image[p++]!;
      buffer[write++]! |= (value >> shift) & 0xff;
      value = (value << 8) >>> 0;
    }
    if (w > 0) value |= image[p++]! & (0xff00 >> w);
    buffer[write]! |= (value >> shift) & 0xff;
    if (shift + w > 8) {
      write++;
      value = (value << 8) >>> 0;
      buffer[write]! |= (value >> shift) & 0xff;
    }
  }
}

/**
 * `tt_sbit_decoder_load_bit_aligned` (`ttsbit.c:828-958`): rows packed bit to bit, ORed in at
 * `(x, y)`. `value` is FreeType's 16-bit `rval`, whose high byte buffers the next bits.
 */
function loadBitAligned(decoder: Decoder, image: Uint8Array, x: number, y: number): void {
  const { bitmap, lineBits } = placedImage(decoder, x, y);
  const { height } = decoder.metrics;
  if ((lineBits * height + 7) >> 3 > image.length) throw new NoBitmap();
  if (lineBits === 0 || height === 0) return;
  const { buffer, pitch } = bitmap;
  let line = y * pitch + (x >> 3);
  const shift = x & 7;
  let value = 0;
  let bits = 0;
  let p = 0;
  const next = () => (p < image.length ? image[p++]! : 0);
  for (let h = height; h > 0; h--, line += pitch) {
    let write = line;
    let w = lineBits;
    if (shift) {
      w = lineBits < 8 - shift ? lineBits : 8 - shift;
      if (h === height) {
        value = image[p++]!;
        bits = shift;
      } else if (bits < w) {
        value |= next();
        bits += 8 - w;
      } else {
        value >>= 8;
        bits -= w;
      }
      buffer[write++]! |= (value >> bits) & 0xff & ((~(0xff << w) & 0xff) << (8 - w - shift));
      value = (value << 8) & 0xffff;
      w = lineBits - w;
    }
    for (; w >= 8; w -= 8) {
      value |= image[p++]!;
      buffer[write++]! |= (value >> bits) & 0xff;
      value = (value << 8) & 0xffff;
    }
    if (w > 0) {
      if (bits < w) {
        value |= next();
        buffer[write]! |= (value >> bits) & 0xff & (0xff00 >> w);
        bits += 8 - w;
        value = (value << 8) & 0xffff;
      } else {
        buffer[write]! |= (value >> bits) & 0xff & (0xff00 >> w);
        bits -= w;
      }
    }
  }
}

/**
 * `tt_sbit_decoder_load_compound` (`ttsbit.c:961-1031`): each component glyph at its offset, then the
 * compound's own metrics back, at the size of the whole bitmap.
 */
function loadCompound(decoder: Decoder, image: Uint8Array, x: number, y: number, depth: number): void {
  const { metrics } = decoder;
  const own = { ...metrics };
  if (image.length < 2) throw new NoBitmap();
  const view = bytesView(image);
  const count = view.getUint16(0);
  if (2 + 4 * count > image.length) throw new NoBitmap();
  for (let i = 0; i < count; i++) {
    const at = 2 + 4 * i;
    loadImage(decoder, view.getUint16(at), x + toInt8(image[at + 2]!), y + toInt8(image[at + 3]!), depth + 1);
  }
  Object.assign(metrics, own, { width: decoder.bitmap!.width & 0xff, height: decoder.bitmap!.rows & 0xff });
}

/**
 * `tt_sbit_decoder_load_png` and `Load_SBit_Png` into a strike's bitmap (`ttsbit.c:1034-1081`,
 * `pngshim.c:259-298`). An image of another size than its metrics leaves the bitmap clear, and
 * loads.
 */
function loadPng(decoder: Decoder, image: Uint8Array, x: number, y: number): void {
  if (image.length < 4) throw new NoBitmap();
  const length = bytesView(image).getUint32(0);
  if (image.length - 4 < length) throw new NoBitmap();
  const bitmap = decoder.bitmap!;
  const { width, height } = decoder.metrics;
  if (x < 0 || y < 0) throw new NoBitmap();
  if (
    x + width > bitmap.width ||
    y + height > bitmap.rows ||
    decoder.bitDepth !== 32 ||
    bitmap.pixelMode !== 'bgra'
  )
    throw new NoBitmap();
  const png = decodePng(image.subarray(4, 4 + length), decoder.inflate);
  if (!png) throw new NoBitmap();
  if (png.width !== width || png.height !== height) return;
  for (let row = 0; row < height; row++) {
    bitmap.buffer.set(
      png.bgra.subarray(row * width * 4, (row + 1) * width * 4),
      (y + row) * bitmap.pitch + x * 4
    );
  }
}
