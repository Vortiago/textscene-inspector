/**
 * The picture size of an Ogg Theora file, read from its identification header. Godot makes the
 * stream's texture that size (`modules/theora/video_stream_theora.cpp:444-452`) once the file's
 * Theora stream has all three header packets (`:339-375`). Nothing here decodes a frame.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { ByteReader, ReadPastEndError } from '../binaryresource/byteReader';

const OGG_PAGE_MAGIC = 'OggS';
const OGG_FIXED_HEADER_BYTES = 27;
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

interface OggPage {
  flags: number;
  serial: number;
  /** The page's bytes cut by its lacing values. A segment shorter than 255 bytes ends a packet. */
  segments: readonly Uint8Array[];
}

function hasPrefix(bytes: Uint8Array, text: string, offset = 0): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  return true;
}

/**
 * The page at the reader's position, or null when the bytes there are not an Ogg page. A page cut
 * short throws `ReadPastEndError`.
 */
function readOggPage(reader: ByteReader): OggPage | null {
  if (reader.remaining < OGG_FIXED_HEADER_BYTES) return null;
  if (!hasPrefix(reader.take(OGG_PAGE_MAGIC.length), OGG_PAGE_MAGIC)) return null;
  reader.take(1); // stream structure version
  const flags = reader.u8();
  reader.take(8); // granule position
  const serial = reader.u32();
  reader.take(8); // page sequence number and checksum
  const lacing = reader.take(reader.u8());
  return { flags, serial, segments: Array.from(lacing, (length) => reader.take(length)) };
}

function isTheoraHeaderPacket(packet: Uint8Array): boolean {
  return packet[0]! >= HEADER_FLAG && hasPrefix(packet, THEORA_MAGIC, 1);
}

/** The picture size an identification header states, or null for a header libtheora would refuse. */
function pictureSizeOfIdentification(packet: Uint8Array): Vector2 | null {
  if (packet.length < IDENTIFICATION_HEADER_BYTES) return null;
  const reader = ByteReader.bigEndian(packet);
  reader.take(10); // type, magic and version
  const frameWidth = reader.u16() * FRAME_MACROBLOCK_PIXELS;
  const frameHeight = reader.u16() * FRAME_MACROBLOCK_PIXELS;
  const width = (reader.u8() << 16) | reader.u16();
  const height = (reader.u8() << 16) | reader.u16();
  const x = reader.u8();
  const y = reader.u8();
  const fitsFrame = frameWidth > 0 && frameHeight > 0 && x + width <= frameWidth && y + height <= frameHeight;
  return fitsFrame ? { x: width, y: height } : null;
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
    for (let page = readOggPage(reader); page; page = readOggPage(reader)) {
      const firstSegment = page.segments[0];
      if (theoraSerial === null && (page.flags & BEGINNING_OF_STREAM) !== 0 && firstSegment) {
        const isIdentification =
          firstSegment[0] === IDENTIFICATION_PACKET_TYPE && isTheoraHeaderPacket(firstSegment);
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
