/**
 * Decodes an `Image` sub-resource, the pixels an ImageTexture or ImageTexture3D saves inline
 * (`core/io/image.cpp:3335-3358`), in its own row order, top row first. No THREE.
 */

import type { TscnInternalResource } from '../../../parser/types';
import type { ImageSize } from '../../../r3f/controls/withImageCanvas';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { literalText, parseGodotInt } from '../../../godot/index.js';
import { parsePackedByteArrayBody } from '../../../godot/packedBytes.js';
import { dictCallField, dictNumberField, dictStringField } from '../../../godot/variantParser.js';
import { warn } from '../../../logger';

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
 * The pixels and the format they were saved in. The 8-bit formats decode to RGBA8. The rest decode
 * to the raw RGBA floats Godot samples, which can pass 1.
 */
export interface DecodedImage extends ImageSize {
  data: Uint8Array | Float32Array;
  /** The name `Image::format_names` gives the saved format. */
  format: string;
}

const readWidth = dictNumberField('width');
const readHeight = dictNumberField('height');
const readFormat = dictStringField('format');
const readData = dictCallField('data', 'PackedByteArray');

/** The `Image` sub-resource `ref` names, decoded. Null for a reference to anything else. */
export function decodeImageRef(
  ref: string | undefined,
  resources: readonly TscnInternalResource[]
): DecodedImage | null {
  const image = resolveSubResourceRef(ref, resources);
  return image?.type === 'Image' ? decodeImage(image.data) : null;
}

/** The size of the `Image` sub-resource `ref` names, read without its pixels. */
export function imageRefSize(
  ref: string | undefined,
  resources: readonly TscnInternalResource[]
): ImageSize | null {
  const image = resolveSubResourceRef(ref, resources);
  const header = image?.type === 'Image' ? readHeader(image.data) : null;
  return header && { width: header.width, height: header.height };
}

interface ImageHeader extends ImageSize {
  format: string;
  /** The text between the data's `PackedByteArray(…)` parentheses. */
  body: string;
}

/** Null without every key, where `_set_data` fails, or with a size below one texel. */
function readHeader(data: Record<string, string>): ImageHeader | null {
  const dictionary = data.data ?? '';
  const width = parseGodotInt(readWidth.exec(dictionary)?.[1] ?? '');
  const height = parseGodotInt(readHeight.exec(dictionary)?.[1] ?? '');
  const format = readFormat.exec(dictionary)?.[1];
  const body = readData(dictionary);
  if (!width || !height || width < 1 || height < 1 || !format || body === null) return null;
  return { width, height, format: literalText(format), body };
}

/**
 * The image's top level, or null for an image Godot refuses (`initialize_data` fails without
 * enough bytes) or one in a format this does not decode: the
 * integer formats, which a float sampler cannot read, and the block-compressed formats.
 */
function decodeImage(data: Record<string, string>): DecodedImage | null {
  const header = readHeader(data);
  if (!header) return null;
  const { width, height, format, body } = header;
  const layout = BYTE_LAYOUTS[format] ?? FLOAT_LAYOUTS[format];
  if (!layout) {
    warn(`[Image] the ${format} format is not decoded, so its image draws nothing`);
    return null;
  }
  const bytes = parsePackedByteArrayBody(body);
  const pixelCount = width * height;
  if (!bytes || bytes.length < pixelCount * layout.size) return null;
  const pixels =
    'rgba' in layout ? expandBytes(bytes, pixelCount, layout) : unpackFloats(bytes, pixelCount, layout);
  return { data: pixels, width, height, format };
}

function expandBytes(bytes: Uint8Array, pixelCount: number, { size, rgba }: ByteLayout): Uint8Array {
  const out = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    for (let channel = 0; channel < 4; channel++) {
      const offset = rgba[channel]!;
      out[i * 4 + channel] = offset === ZERO ? 0 : offset === OPAQUE ? 255 : bytes[i * size + offset]!;
    }
  }
  return out;
}

function unpackFloats(bytes: Uint8Array, pixelCount: number, { size, read }: FloatLayout): Float32Array {
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
