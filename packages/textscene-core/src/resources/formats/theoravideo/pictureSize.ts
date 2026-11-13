/**
 * The picture size of an Ogg Theora file, read from its identification header. Godot makes the
 * stream's texture that size (`modules/theora/video_stream_theora.cpp:444-452`) once the file's
 * Theora stream has all three header packets (`:339-375`). Nothing here decodes a frame.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { ByteReader, ReadPastEndError, hasAsciiPrefix } from '../binaryresource/byteReader';
import { BEGINNING_OF_STREAM, CONTINUED_PACKET, FULL_SEGMENT, readOggPage } from '../oggcontainer/oggPage';
import { pictureSizeOfIdentification } from './identificationHeader';

/** Theora's three header packets are identification, comment and setup. */
const HEADER_PACKET_COUNT = 3;
/** A header packet starts with a type byte whose top bit is set, then `theora` (Theora spec 6.1). */
const HEADER_FLAG = 0x80;
/** The identification header's type byte: the header flag with kind 0. */
const IDENTIFICATION_PACKET_TYPE = 0x80;
const THEORA_MAGIC = 'theora';

function isTheoraHeaderPacket(packet: Uint8Array): boolean {
  return packet[0]! >= HEADER_FLAG && hasAsciiPrefix(packet, THEORA_MAGIC, 1);
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
