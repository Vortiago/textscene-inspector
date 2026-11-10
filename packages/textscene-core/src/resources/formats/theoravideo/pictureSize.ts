/**
 * The picture size of an Ogg Theora file, read from its identification header. Godot makes the
 * stream's texture that size (`modules/theora/video_stream_theora.cpp:444-452`) once the file's
 * Theora stream has all three header packets (`:339-375`). Every page read passes its checksum. Nothing
 * here decodes a frame.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { ByteReader, ReadPastEndError, hasAsciiPrefix } from '../binaryresource/byteReader';

const OGG_PAGE_MAGIC = 'OggS';
const OGG_FIXED_HEADER_BYTES = 27;
const CHECKSUM_OFFSET = 22;
const CHECKSUM_BYTES = 4;
const OGG_CHECKSUM_POLYNOMIAL = 0x04c11db7;
const BEGINNING_OF_STREAM = 0x02;
const CONTINUED_PACKET = 0x01;
/** A lacing value below this ends a packet. */
const FULL_SEGMENT = 255;

/** Theora's three header packets are identification, comment and setup. */
const HEADER_PACKET_COUNT = 3;
/** A header packet starts with a type byte whose top bit is set, then `theora` (Theora spec 6.1). */
const HEADER_FLAG = 0x80;
/** The identification header's type byte: the header flag with kind 0. */
const IDENTIFICATION_PACKET_TYPE = 0x80;
const THEORA_MAGIC = 'theora';
const IDENTIFICATION_HEADER_BYTES = 42;
const FRAME_MACROBLOCK_PIXELS = 16;
/** The newest bitstream version libtheora reads: 3.2. A later subminor version is accepted. */
const SUPPORTED_MAJOR_VERSION = 3;
const SUPPORTED_MINOR_VERSION = 2;
/** Between the frame rate and the last byte: aspect ratio (6), colour space (1), bit rate (3), quality and shift (1). */
const AFTER_FRAME_RATE_BYTES = 11;
const RESERVED_PIXEL_FORMAT = 1;
const RESERVED_BITS = 3;

interface OggPage {
  flags: number;
  serial: number;
  /** The page's bytes cut by its lacing values. A segment shorter than 255 bytes ends a packet. */
  segments: readonly Uint8Array[];
}

/** The CRC-32 table for the Ogg polynomial, built once at import and never written again. */
const CHECKSUM_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let register = byte << 24;
  for (let bit = 0; bit < 8; bit++)
    register = register & 0x80000000 ? (register << 1) ^ OGG_CHECKSUM_POLYNOMIAL : register << 1;
  return register >>> 0;
});

/** The Ogg checksum of a page, its checksum field read as zero (libogg `framing.c:255-275`). */
function oggChecksum(page: Uint8Array): number {
  let register = 0;
  page.forEach((byte, index) => {
    const checksumByte = index >= CHECKSUM_OFFSET && index < CHECKSUM_OFFSET + CHECKSUM_BYTES ? 0 : byte;
    register = ((register << 8) ^ CHECKSUM_TABLE[((register >>> 24) ^ checksumByte) & 0xff]!) >>> 0;
  });
  return register;
}

/**
 * The page at the reader's position, or null when the bytes there are not an Ogg page or the page
 * fails its checksum, which leaves Godot without a video stream (`framing.c:671-696`, measured).
 * A page cut short throws `ReadPastEndError`.
 */
function readOggPage(bytes: Uint8Array, reader: ByteReader): OggPage | null {
  if (reader.remaining < OGG_FIXED_HEADER_BYTES) return null;
  const start = reader.position;
  if (!hasAsciiPrefix(reader.take(OGG_PAGE_MAGIC.length), OGG_PAGE_MAGIC)) return null;
  reader.take(1); // stream structure version
  const flags = reader.u8();
  reader.take(8); // granule position
  const serial = reader.u32();
  reader.take(4); // page sequence number
  const checksum = reader.u32();
  const lacing = reader.take(reader.u8());
  const segments = Array.from(lacing, (length) => reader.take(length));
  if (oggChecksum(bytes.subarray(start, reader.position)) !== checksum) return null;
  return { flags, serial, segments };
}

function isTheoraHeaderPacket(packet: Uint8Array): boolean {
  return packet[0]! >= HEADER_FLAG && hasAsciiPrefix(packet, THEORA_MAGIC, 1);
}

/**
 * The picture size an identification header states, or null for a header libtheora refuses
 * (`thirdparty/libtheora/decinfo.c:51-118`, `oc_info_unpack`), which leaves the stream without video.
 */
function pictureSizeOfIdentification(packet: Uint8Array): Vector2 | null {
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
  const x = reader.u8();
  const y = reader.u8();
  const frameRateNumerator = reader.u32();
  const frameRateDenominator = reader.u32();
  const fitsFrame = frameWidth > 0 && frameHeight > 0 && x + width <= frameWidth && y + height <= frameHeight;
  if (!fitsFrame || frameRateNumerator === 0 || frameRateDenominator === 0) return null;
  reader.take(AFTER_FRAME_RATE_BYTES);
  const pixelFormatAndReservedBits = reader.u8();
  return hasReservedPixelFormatOrBits(pixelFormatAndReservedBits) ? null : { x: width, y: height };
}

/** The last byte holds the end of the key frame shift (3 bits), the pixel format (2) and the reserved bits (3), which must be zero. */
function hasReservedPixelFormatOrBits(lastByte: number): boolean {
  const pixelFormat = (lastByte >> RESERVED_BITS) & 0b11;
  return pixelFormat === RESERVED_PIXEL_FORMAT || (lastByte & ((1 << RESERVED_BITS) - 1)) !== 0;
}

/**
 * The picture size of the first Theora stream in an Ogg file, or null when the file has none or
 * that stream lacks its three header packets, as for Godot (`video_stream_theora.cpp:414-424`).
 */
export function readTheoraPictureSize(bytes: Uint8Array): Vector2 | null {
  const reader = new ByteReader(bytes);
  let theoraSerial: number | null = null;
  let identification: Uint8Array | null = null;
  let packetCount = 0;
  // The first segment of the packet in progress: its type byte and magic are all a header check reads.
  let packetHead: Uint8Array | null = null;

  try {
    for (let page = readOggPage(bytes, reader); page; page = readOggPage(bytes, reader)) {
      // The identification header is 42 bytes, so one segment holds it whole.
      const firstSegment = page.segments[0];
      if (theoraSerial === null) {
        // Godot stops looking for a stream at the first page that does not begin one (`:306-312`).
        if ((page.flags & BEGINNING_OF_STREAM) === 0) return null;
        const isIdentification =
          firstSegment !== undefined &&
          firstSegment[0] === IDENTIFICATION_PACKET_TYPE &&
          isTheoraHeaderPacket(firstSegment);
        if (isIdentification) theoraSerial = page.serial;
      }
      if (page.serial !== theoraSerial) continue;

      if ((page.flags & CONTINUED_PACKET) === 0) packetHead = null;
      for (const segment of page.segments) {
        packetHead ??= segment;
        if (segment.length === FULL_SEGMENT) continue;
        if (!isTheoraHeaderPacket(packetHead)) return null;
        identification ??= packetHead;
        packetHead = null;
        packetCount++;
        if (packetCount === HEADER_PACKET_COUNT) return pictureSizeOfIdentification(identification);
      }
    }
  } catch (error) {
    if (error instanceof ReadPastEndError) return null;
    throw error;
  }
  return null;
}
