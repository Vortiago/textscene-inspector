/**
 * The picture size a Theora identification header states, or null for a header libtheora refuses
 * (`thirdparty/libtheora/decinfo.c:51-118`, `oc_info_unpack`). Godot then finds no video stream.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { ByteReader } from '../binaryresource/byteReader';

const IDENTIFICATION_HEADER_BYTES = 42;

const FRAME_MACROBLOCK_PIXELS = 16;
/** The newest bitstream version libtheora reads: 3.2. A later subminor version is accepted. */
const SUPPORTED_MAJOR_VERSION = 3;
const SUPPORTED_MINOR_VERSION = 2;
/** Between the frame rate and the last byte: aspect ratio (6), colour space (1), bit rate (3), quality and shift (1). */
const AFTER_FRAME_RATE_BYTES = 11;
const RESERVED_PIXEL_FORMAT = 1;
const RESERVED_BITS = 3;
const PIXEL_FORMAT_MASK = 0b11;

/** The caller has checked that `packet` starts with the identification type byte and `theora`. */
export function pictureSizeOfIdentification(packet: Uint8Array): Vector2 | null {
  if (packet.length < IDENTIFICATION_HEADER_BYTES) return null;
  const reader = ByteReader.bigEndian(packet);
  reader.take(7); // type and magic
  const major = reader.u8();
  const minor = reader.u8();
  reader.take(1); // subminor version: any value is accepted
  if (
    major > SUPPORTED_MAJOR_VERSION ||
    (major === SUPPORTED_MAJOR_VERSION && minor > SUPPORTED_MINOR_VERSION)
  ) {
    return null;
  }
  const frameWidth = reader.u16() * FRAME_MACROBLOCK_PIXELS;
  const frameHeight = reader.u16() * FRAME_MACROBLOCK_PIXELS;
  const width = (reader.u8() << 16) | reader.u16();
  const height = (reader.u8() << 16) | reader.u16();
  const pictureOffsetX = reader.u8();
  const pictureOffsetY = reader.u8();
  const frameRateNumerator = reader.u32();
  const frameRateDenominator = reader.u32();
  const fitsFrame =
    frameWidth > 0 &&
    frameHeight > 0 &&
    pictureOffsetX + width <= frameWidth &&
    pictureOffsetY + height <= frameHeight;
  if (!fitsFrame || frameRateNumerator === 0 || frameRateDenominator === 0) return null;
  reader.take(AFTER_FRAME_RATE_BYTES);
  return hasReservedPixelFormatOrBits(reader.u8()) ? null : { x: width, y: height };
}

/** The last byte holds the end of the key frame shift (3 bits), the pixel format (2) and the reserved bits (3), which must be zero. */
function hasReservedPixelFormatOrBits(lastByte: number): boolean {
  const pixelFormat = (lastByte >> RESERVED_BITS) & PIXEL_FORMAT_MASK;
  return pixelFormat === RESERVED_PIXEL_FORMAT || (lastByte & ((1 << RESERVED_BITS) - 1)) !== 0;
}
