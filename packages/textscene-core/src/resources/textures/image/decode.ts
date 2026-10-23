/**
 * Decodes an `Image` sub-resource, the pixels an ImageTexture or ImageTexture3D saves inline
 * (`core/io/image.cpp:3335-3358`), in its own row order, top row first. No THREE.
 */

import type { TscnInternalResource } from '../../../parser/types';
import type { ImageSize } from '../../formats/image/imagePixels';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { literalText } from '../../../godot/string/string.js';
import { parseGodotInt } from '../../../godot/variant/intReader.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { parsePackedByteArrayBody } from '../../../godot/variant/packedBytes.js';
import {
  dictBoolField,
  dictCallField,
  dictNumberField,
  dictStringField,
} from '../../../godot/variant/variantParser.js';
import { warn } from '../../../logger';
import { lowerLevelSizes } from '../../processing/mipChain';
import { BLOCK_FORMATS, blockBytes, decodeBlocks } from './blocks/decodeBlocks';

/** A channel no source byte fills: 0, or 255 for alpha. */
const ZERO = -1;
const OPAQUE = -2;

interface ByteLayout {
  /** Bytes per pixel. */
  size: number;
  /** The source byte offset of red, green, blue and alpha, or {@link ZERO} or {@link OPAQUE}. */
  rgba: readonly [number, number, number, number];
}

/**
 * Each 8-bit format, by the name `Image::format_names` gives it (`core/io/image.cpp:41-47`). The
 * rendering device uploads Lum8 and LumAlpha8 as R8 and RG8 swizzled to `rrr1` and `rrrg`, so a
 * reader of red sees the luminance.
 */
const BYTE_LAYOUTS: Readonly<Record<string, ByteLayout>> = {
  Lum8: { size: 1, rgba: [0, 0, 0, OPAQUE] },
  LumAlpha8: { size: 2, rgba: [0, 0, 0, 1] },
  Red8: { size: 1, rgba: [0, ZERO, ZERO, OPAQUE] },
  RedGreen: { size: 2, rgba: [0, 1, ZERO, OPAQUE] },
  RGB8: { size: 3, rgba: [0, 1, 2, OPAQUE] },
  RGBA8: { size: 4, rgba: [0, 1, 2, 3] },
};

/** Writes one pixel's RGBA at `at`, read from the little-endian bytes at `offset`. */
type PixelReader = (bytes: DataView, offset: number, out: Float32Array, at: number) => void;

interface FloatLayout {
  /** Bytes per pixel. */
  size: number;
  read: PixelReader;
}

/**
 * Each uncompressed format that is not one byte a channel, unpacked as `Image::_get_color_at_ofs` unpacks it
 * (`core/io/image.cpp:3382-3406`, `:3451-3525`) and as the rendering device samples it
 * (`renderer_rd/storage_rd/texture_storage.cpp:1899-1996`, `:2326-2382`): a missing colour
 * channel reads 0 and a missing alpha 1.
 */
const FLOAT_LAYOUTS: Readonly<Record<string, FloatLayout>> = {
  RGBA4444: { size: 2, read: readRgba4444 },
  RGBA5551: { size: 2, read: readRgb565 },
  RFloat: channels(1, 4, readFloat32),
  RGFloat: channels(2, 4, readFloat32),
  RGBFloat: channels(3, 4, readFloat32),
  RGBAFloat: channels(4, 4, readFloat32),
  RHalf: channels(1, 2, readHalf),
  RGHalf: channels(2, 2, readHalf),
  RGBHalf: channels(3, 2, readHalf),
  RGBAHalf: channels(4, 2, readHalf),
  RGBE9995: { size: 4, read: readRgbe9995 },
  R16: channels(1, 2, readUnorm16),
  RG16: channels(2, 2, readUnorm16),
  RGB16: channels(3, 2, readUnorm16),
  RGBA16: channels(4, 2, readUnorm16),
};

/**
 * The pixels of one level. The 8-bit and block formats decode to RGBA8. The rest decode to the
 * raw RGBA floats Godot samples, which can pass 1.
 */
export interface DecodedLevel extends ImageSize {
  data: Uint8Array | Float32Array;
}

/** The top level and the format it was saved in. */
export interface DecodedImage extends DecodedLevel {
  /** The name `Image::format_names` gives the saved format. */
  format: string;
}

/**
 * An image with the Stored mip chain: the levels below the top one, largest first, down to
 * 1 × 1, as saved. Godot never rebuilds them. Empty for an image saved without mipmaps, and for
 * one whose bytes end before its last level.
 */
export interface MipmappedImage extends DecodedImage {
  levels: DecodedLevel[];
}

const readWidth = dictNumberField('width');
const readHeight = dictNumberField('height');
const readFormat = dictStringField('format');
const readMipmaps = dictBoolField('mipmaps');
const readData = dictCallField('data', 'PackedByteArray');

/** The top level of the `Image` sub-resource `ref` names. Null for a reference to anything else. */
export function decodeImageRef(
  ref: string | undefined,
  resources: readonly TscnInternalResource[]
): DecodedImage | null {
  return openImageRef(ref, resources)?.image ?? null;
}

/**
 * The `Image` sub-resource `ref` names, with the levels it stores below the top one. Unlike
 * `initialize_data`, it accepts bytes short of the levels, and keeps the top level alone.
 */
export function decodeMipmappedImageRef(
  ref: string | undefined,
  resources: readonly TscnInternalResource[]
): MipmappedImage | null {
  const open = openImageRef(ref, resources);
  if (!open) return null;
  const { image, reader, bytes, hasMipmaps } = open;
  return { ...image, levels: hasMipmaps ? decodeLevels(bytes, image, reader) : [] };
}

/** The size of the `Image` sub-resource `ref` names, read without its pixels. */
export function imageRefSize(
  ref: string | undefined,
  resources: readonly TscnInternalResource[]
): ImageSize | null {
  const image = resolveSubResourceRef(ref, resources);
  const header = image?.type === 'Image' ? readHeader(image.data.data ?? '') : null;
  return header && { width: header.width, height: header.height };
}

interface ImageHeader extends ImageSize {
  format: string;
  /** The text between the data's `PackedByteArray(…)` parentheses. */
  body: string;
}

/** Null without every key, where `_set_data` fails, or with a size below one texel. */
function readHeader(dictionary: string): ImageHeader | null {
  const width = parseGodotInt(readWidth.exec(dictionary)?.[1] ?? '');
  const height = parseGodotInt(readHeight.exec(dictionary)?.[1] ?? '');
  const format = readFormat.exec(dictionary)?.[1];
  const body = readData(dictionary);
  if (!width || !height || width < 1 || height < 1 || !format || body === null) return null;
  return { width, height, format: literalText(format), body };
}

/** An `Image` whose top level is decoded, with what a read of its lower levels needs. */
interface OpenImage {
  image: DecodedImage;
  reader: FormatReader;
  bytes: Uint8Array;
  hasMipmaps: boolean;
}

/**
 * Null for a reference to anything but an `Image`, for an image Godot refuses (`initialize_data`
 * fails without enough bytes) or for one in a format this does not decode: the integer formats,
 * which a float sampler cannot read, and the block formats no decoder handles.
 */
function openImageRef(ref: string | undefined, resources: readonly TscnInternalResource[]): OpenImage | null {
  const resource = resolveSubResourceRef(ref, resources);
  const dictionary = resource?.type === 'Image' ? (resource.data.data ?? '') : null;
  const header = dictionary === null ? null : readHeader(dictionary);
  if (dictionary === null || !header) return null;
  const { width, height, format, body } = header;
  const reader = formatReader(format);
  if (!reader) {
    warn(`[Image] the ${format} format is not decoded, so its image draws nothing`);
    return null;
  }
  const bytes = parsePackedByteArrayBody(body);
  if (!bytes) return null;
  const pixels = reader.decode(bytes, { width, height });
  if (!pixels) return null;
  const hasMipmaps = boolSlotValue(readMipmaps.exec(dictionary)?.[1]) === true;
  return { image: { data: pixels, width, height, format }, reader, bytes, hasMipmaps };
}

/**
 * The levels below the top one. Each follows the level above in the bytes and takes whole blocks
 * of the format (`_get_mipmap_offset_and_size`, `image.cpp:336-362`). All or none: a texture
 * with a level missing is incomplete, so bytes that end early leave the top level alone.
 */
function decodeLevels(bytes: Uint8Array, top: ImageSize, reader: FormatReader): DecodedLevel[] {
  let end = reader.byteLength(top);
  const spans = lowerLevelSizes(top).map((size) => {
    const start = end;
    end += reader.byteLength(size);
    return { size, start, end };
  });
  // Checked before any decode, so a short image wastes no level.
  if (bytes.length < end) return [];
  return spans.map(({ size, start, end: stop }) => ({
    data: reader.decode(bytes.subarray(start, stop), size)!,
    ...size,
  }));
}

/** Decodes a level, or gives null for data shorter than it. */
type PixelDecoder = (bytes: Uint8Array, size: ImageSize) => Uint8Array | Float32Array | null;

interface FormatReader {
  /** The bytes one level of this size takes (`_get_dst_image_size`, `image.cpp:1885-1945`). */
  byteLength: (size: ImageSize) => number;
  decode: PixelDecoder;
}

/** The bytes of a level of `pixelSize`-byte texels. */
const texelBytes =
  (pixelSize: number) =>
  ({ width, height }: ImageSize) =>
    width * height * pixelSize;

function formatReader(format: string): FormatReader | null {
  const byteLayout = BYTE_LAYOUTS[format];
  if (byteLayout) {
    return {
      byteLength: texelBytes(byteLayout.size),
      decode: (bytes, size) => expandBytes(bytes, size, byteLayout),
    };
  }
  const floatLayout = FLOAT_LAYOUTS[format];
  if (floatLayout) {
    return {
      byteLength: texelBytes(floatLayout.size),
      decode: (bytes, size) => unpackFloats(bytes, size, floatLayout),
    };
  }
  const blockFormat = BLOCK_FORMATS[format];
  if (blockFormat) {
    return {
      byteLength: (size) => blockBytes(size, blockFormat),
      decode: (bytes, size) => decodeBlocks(bytes, size, blockFormat),
    };
  }
  return null;
}

function expandBytes(
  bytes: Uint8Array,
  { width, height }: ImageSize,
  { size, rgba }: ByteLayout
): Uint8Array | null {
  const pixelCount = width * height;
  if (bytes.length < pixelCount * size) return null;
  const out = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    for (let channel = 0; channel < 4; channel++) {
      const offset = rgba[channel]!;
      out[i * 4 + channel] = offset === ZERO ? 0 : offset === OPAQUE ? 255 : bytes[i * size + offset]!;
    }
  }
  return out;
}

function unpackFloats(
  bytes: Uint8Array,
  { width, height }: ImageSize,
  { size, read }: FloatLayout
): Float32Array | null {
  const pixelCount = width * height;
  if (bytes.length < pixelCount * size) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) read(view, i * size, out, i * 4);
  return out;
}

/** A layout of `count` channels of `width` bytes each, in RGBA order. */
function channels(
  count: number,
  width: number,
  readChannel: (bytes: DataView, offset: number) => number
): FloatLayout {
  return {
    size: count * width,
    read: (bytes, offset, out, at) => {
      for (let channel = 0; channel < 3; channel++) {
        out[at + channel] = channel < count ? readChannel(bytes, offset + channel * width) : 0;
      }
      out[at + 3] = count === 4 ? readChannel(bytes, offset + 3 * width) : 1;
    },
  };
}

function readFloat32(bytes: DataView, offset: number): number {
  return bytes.getFloat32(offset, true);
}

function readUnorm16(bytes: DataView, offset: number): number {
  return bytes.getUint16(offset, true) / 65535;
}

/** IEEE half precision, as `Math::half_to_float` reads it (`core/math/math_funcs.h:744`). */
function readHalf(bytes: DataView, offset: number): number {
  const half = bytes.getUint16(offset, true);
  const sign = half & 0x8000 ? -1 : 1;
  const exponent = (half >> 10) & 0x1f;
  const mantissa = half & 0x3ff;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 0x1f) return mantissa ? NaN : sign * Infinity;
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
}

/** `color_from_rgba4444` (`core/io/image.cpp:3382-3388`): red in the top nibble. */
function readRgba4444(bytes: DataView, offset: number, out: Float32Array, at: number): void {
  const packed = bytes.getUint16(offset, true);
  out[at] = ((packed >> 12) & 0xf) / 15;
  out[at + 1] = ((packed >> 8) & 0xf) / 15;
  out[at + 2] = ((packed >> 4) & 0xf) / 15;
  out[at + 3] = (packed & 0xf) / 15;
}

/** `color_from_rgb565` (`core/io/image.cpp:3401-3406`), which Godot names RGBA5551. */
function readRgb565(bytes: DataView, offset: number, out: Float32Array, at: number): void {
  const packed = bytes.getUint16(offset, true);
  out[at] = ((packed >> 11) & 0x1f) / 31;
  out[at + 1] = ((packed >> 5) & 0x3f) / 63;
  out[at + 2] = (packed & 0x1f) / 31;
  out[at + 3] = 1;
}

/** `Color::from_rgbe9995` (`core/math/color.cpp:464-476`): three 9-bit mantissas, one exponent. */
function readRgbe9995(bytes: DataView, offset: number, out: Float32Array, at: number): void {
  const packed = bytes.getUint32(offset, true);
  const scale = 2 ** ((packed >>> 27) - 15 - 9);
  out[at] = (packed & 0x1ff) * scale;
  out[at + 1] = ((packed >> 9) & 0x1ff) * scale;
  out[at + 2] = ((packed >> 18) & 0x1ff) * scale;
  out[at + 3] = 1;
}
