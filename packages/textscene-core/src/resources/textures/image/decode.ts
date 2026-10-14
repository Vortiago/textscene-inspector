/**
 * Decodes an `Image` sub-resource, the pixels an ImageTexture or ImageTexture3D saves inline
 * (`core/io/image.cpp:3335-3358`), to RGBA8 in its own row order, top row first. No THREE.
 */

import type { ImagePixels } from '../../../r3f/controls/withImageCanvas';
import { literalText, parseGodotInt } from '../../../godot/index.js';
import { dictCallField, dictNumberField, dictStringField } from '../../../godot/variantParser.js';
import { parsePackedByteArray } from '../../shapes/packedArray';
import { warn } from '../../../logger';

/** A channel no source byte fills: 0, or 255 for alpha. */
const ZERO = -1;
const OPAQUE = -2;

interface PixelLayout {
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
const EIGHT_BIT_LAYOUTS: Readonly<Record<string, PixelLayout>> = {
  Lum8: { size: 1, rgba: [0, 0, 0, OPAQUE] },
  LumAlpha8: { size: 2, rgba: [0, 0, 0, 1] },
  Red8: { size: 1, rgba: [0, ZERO, ZERO, OPAQUE] },
  RedGreen: { size: 2, rgba: [0, 1, ZERO, OPAQUE] },
  RGB8: { size: 3, rgba: [0, 1, 2, OPAQUE] },
  RGBA8: { size: 4, rgba: [0, 1, 2, 3] },
};

/** The pixels as RGBA8, and the format they were saved in. */
export interface DecodedImage extends ImagePixels {
  data: Uint8Array;
  /** The name `Image::format_names` gives the saved format. */
  format: string;
}

const readWidth = dictNumberField('width');
const readHeight = dictNumberField('height');
const readFormat = dictStringField('format');
const readData = dictCallField('data', 'PackedByteArray');

/**
 * The image's top level as RGBA8, or null for an image Godot refuses (`_set_data` fails without
 * every key, and `initialize_data` without enough bytes) or one in a format this does not decode:
 * the float, half, 16-bit and block-compressed formats.
 */
export function decodeImage(data: Record<string, string>): DecodedImage | null {
  const dictionary = data.data ?? '';
  const width = parseGodotInt(readWidth.exec(dictionary)?.[1] ?? '');
  const height = parseGodotInt(readHeight.exec(dictionary)?.[1] ?? '');
  const formatLiteral = readFormat.exec(dictionary)?.[1];
  const body = readData(dictionary);
  if (!width || !height || width < 1 || height < 1 || !formatLiteral || body === null) return null;

  const format = literalText(formatLiteral);
  const layout = EIGHT_BIT_LAYOUTS[format];
  if (!layout) {
    warn(`[Image] the ${format} format is not decoded, so its image draws nothing`);
    return null;
  }
  const bytes = readBytes(body);
  if (!bytes || bytes.length < width * height * layout.size) return null;
  return { data: expandToRgba(bytes, width * height, layout), width, height, format };
}

/** Null for a body Godot's reader refuses, which fails the whole resource. */
function readBytes(body: string): Uint8Array | null {
  try {
    return parsePackedByteArray(`PackedByteArray(${body})`);
  } catch {
    return null;
  }
}

function expandToRgba(bytes: Uint8Array, pixelCount: number, { size, rgba }: PixelLayout): Uint8Array {
  const out = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    for (let channel = 0; channel < 4; channel++) {
      const offset = rgba[channel]!;
      out[i * 4 + channel] = offset === ZERO ? 0 : offset === OPAQUE ? 255 : bytes[i * size + offset]!;
    }
  }
  return out;
}
