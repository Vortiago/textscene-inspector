/**
 * One page of an Ogg container, read with the checksum libogg demands. A page that fails its
 * checksum is not a page, as for Godot's `ogg_sync_pageout`.
 */

import { ByteReader, hasAsciiPrefix } from '../binaryresource/byteReader';

export interface OggPage {
  flags: number;
  serial: number;
  /** The page's bytes cut by its lacing values. A segment shorter than `FULL_SEGMENT` ends a packet. */
  segments: readonly Uint8Array[];
}

export const BEGINNING_OF_STREAM = 0x02;
export const CONTINUED_PACKET = 0x01;
/** A lacing value below this ends a packet. */
export const FULL_SEGMENT = 255;

const OGG_PAGE_MAGIC = 'OggS';
const OGG_FIXED_HEADER_BYTES = 27;
const STREAM_STRUCTURE_VERSION_BYTES = 1;
const GRANULE_POSITION_BYTES = 8;
const PAGE_SEQUENCE_NUMBER_BYTES = 4;
const CHECKSUM_OFFSET = 22;
const CHECKSUM_BYTES = 4;
const CHECKSUM_END = CHECKSUM_OFFSET + CHECKSUM_BYTES;
const OGG_CHECKSUM_POLYNOMIAL = 0x04c11db7;

/** The CRC-32 table for the Ogg polynomial, built once at import and never written again. */
const CHECKSUM_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let register = byte << 24;
  for (let bit = 0; bit < 8; bit++) {
    register = register & 0x80000000 ? (register << 1) ^ OGG_CHECKSUM_POLYNOMIAL : register << 1;
  }
  return register >>> 0;
});

/** The Ogg checksum of a page, its checksum field read as zero (libogg `framing.c:255-275`). */
function oggChecksum(page: Uint8Array): number {
  let register = 0;
  for (let index = 0; index < page.length; index++) {
    const byte = index >= CHECKSUM_OFFSET && index < CHECKSUM_END ? 0 : page[index]!;
    register = (register << 8) ^ CHECKSUM_TABLE[((register >>> 24) ^ byte) & 0xff]!;
  }
  return register >>> 0;
}

/**
 * The page at the reader's position, or null when the bytes there are not an Ogg page or the page
 * fails its checksum (`framing.c:671-696`). Godot then finds no video stream (measured). A page cut
 * short throws `ReadPastEndError`. The reader is little endian, as an Ogg page stores its numbers.
 */
export function readOggPage(reader: ByteReader): OggPage | null {
  if (reader.remaining < OGG_FIXED_HEADER_BYTES) return null;
  const start = reader.position;
  if (!hasAsciiPrefix(reader.take(OGG_PAGE_MAGIC.length), OGG_PAGE_MAGIC)) return null;
  reader.take(STREAM_STRUCTURE_VERSION_BYTES);
  const flags = reader.u8();
  reader.take(GRANULE_POSITION_BYTES);
  const serial = reader.u32();
  reader.take(PAGE_SEQUENCE_NUMBER_BYTES);
  const checksum = reader.u32();
  const lacing = reader.take(reader.u8());
  const segments = Array.from(lacing, (length) => reader.take(length));
  const end = reader.position;
  reader.seek(start);
  const page = reader.take(end - start);
  return oggChecksum(page) === checksum ? { flags, serial, segments } : null;
}
