/**
 * The picture size of an Ogg Theora file, read from its identification header. Godot makes the
 * stream's texture that size (`modules/theora/video_stream_theora.cpp:444-452`) once the file's
 * Theora stream has all three header packets (`:339-375`). Nothing here decodes a frame.
 */

const OGG_PAGE_MAGIC = 'OggS';
const OGG_FIXED_HEADER_BYTES = 27;
const OGG_SEGMENT_COUNT_OFFSET = 26;
const OGG_SERIAL_OFFSET = 14;
const BEGINNING_OF_STREAM = 0x02;
const CONTINUED_PACKET = 0x01;
/** A lacing value below this ends a packet. */
const FULL_SEGMENT = 255;

/** Theora's three header packets are identification, comment and setup. */
const HEADER_PACKET_COUNT = 3;
/** A header packet's first byte has its top bit set, then `theora` (Theora spec 6.1). */
const HEADER_FLAG = 0x80;
const THEORA_MAGIC = 'theora';
const IDENTIFICATION_PACKET_TYPE = 0x80;
const IDENTIFICATION_HEADER_BYTES = 42;
const FRAME_MACROBLOCK_PIXELS = 16;

export interface TheoraPictureSize {
  width: number;
  height: number;
}

interface OggPage {
  flags: number;
  serial: number;
  /** The page's bytes cut by its lacing values. A segment shorter than 255 bytes ends a packet. */
  segments: readonly Uint8Array[];
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** The page at `offset`, or null when the bytes there are not a whole Ogg page. */
function readOggPage(bytes: Uint8Array, offset: number): { page: OggPage; end: number } | null {
  if (offset + OGG_FIXED_HEADER_BYTES > bytes.length) return null;
  if (asciiAt(bytes, offset, OGG_PAGE_MAGIC.length) !== OGG_PAGE_MAGIC) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lacingCount = bytes[offset + OGG_SEGMENT_COUNT_OFFSET]!;
  const lacingStart = offset + OGG_FIXED_HEADER_BYTES;
  let cursor = lacingStart + lacingCount;
  const segments: Uint8Array[] = [];
  for (let i = 0; i < lacingCount; i++) {
    const length = bytes[lacingStart + i]!;
    if (cursor + length > bytes.length) return null;
    segments.push(bytes.subarray(cursor, cursor + length));
    cursor += length;
  }
  return {
    page: {
      flags: bytes[offset + 5]!,
      serial: view.getUint32(offset + OGG_SERIAL_OFFSET, true),
      segments,
    },
    end: cursor,
  };
}

function concatenated(parts: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return joined;
}

/** Whether `packet` opens a Theora header packet of any of the three kinds. */
function isTheoraHeaderPacket(packet: Uint8Array): boolean {
  return (packet[0]! & HEADER_FLAG) !== 0 && asciiAt(packet, 1, THEORA_MAGIC.length) === THEORA_MAGIC;
}

/** The picture size an identification header states, or null for a header libtheora would refuse. */
function pictureSizeOfIdentification(packet: Uint8Array): TheoraPictureSize | null {
  if (packet.length < IDENTIFICATION_HEADER_BYTES) return null;
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const frameWidth = view.getUint16(10) * FRAME_MACROBLOCK_PIXELS;
  const frameHeight = view.getUint16(12) * FRAME_MACROBLOCK_PIXELS;
  const width = (view.getUint8(14) << 16) | view.getUint16(15);
  const height = (view.getUint8(17) << 16) | view.getUint16(18);
  const x = view.getUint8(20);
  const y = view.getUint8(21);
  const fitsFrame = frameWidth > 0 && frameHeight > 0 && x + width <= frameWidth && y + height <= frameHeight;
  return fitsFrame ? { width, height } : null;
}

/**
 * The picture size of the first Theora stream in an Ogg file, or null when the file has none or
 * that stream lacks its three header packets, as for Godot (`video_stream_theora.cpp:414-424`).
 */
export function readTheoraPictureSize(bytes: Uint8Array): TheoraPictureSize | null {
  let theoraSerial: number | null = null;
  const headerPackets: Uint8Array[] = [];
  let openPacket: Uint8Array[] = [];
  let offset = 0;

  for (let read = readOggPage(bytes, offset); read; read = readOggPage(bytes, offset)) {
    offset = read.end;
    const { page } = read;
    if (theoraSerial === null && (page.flags & BEGINNING_OF_STREAM) !== 0) {
      const ident = concatenated(page.segments);
      if (ident.length > 0 && ident[0] === IDENTIFICATION_PACKET_TYPE && isTheoraHeaderPacket(ident)) {
        theoraSerial = page.serial;
      }
    }
    if (page.serial !== theoraSerial) continue;

    if ((page.flags & CONTINUED_PACKET) === 0) openPacket = [];
    for (const segment of page.segments) {
      openPacket.push(segment);
      if (segment.length === FULL_SEGMENT) continue;
      const packet = concatenated(openPacket);
      openPacket = [];
      if (!isTheoraHeaderPacket(packet)) return null;
      headerPackets.push(packet);
      if (headerPackets.length === HEADER_PACKET_COUNT) return pictureSizeOfIdentification(headerPackets[0]!);
    }
  }
  return null;
}
