import { describe, expect, it } from 'vitest';
import { ByteReader, ReadPastEndError } from '../binaryresource/byteReader';
import { BEGINNING_OF_STREAM, readOggPage } from './oggPage';

const CHECKSUM_OFFSET = 22;

/** The Ogg CRC-32 computed bit by bit, an oracle apart from the table in `oggPage.ts`. */
function bitwiseChecksum(page: Uint8Array): number {
  let register = 0;
  page.forEach((byte, index) => {
    register ^= (index >= CHECKSUM_OFFSET && index < CHECKSUM_OFFSET + 4 ? 0 : byte) << 24;
    for (let bit = 0; bit < 8; bit++)
      register = register & 0x80000000 ? (register << 1) ^ 0x04c11db7 : register << 1;
  });
  return register >>> 0;
}

/** A one-segment page with serial 7 and body `ab`, its checksum valid until `corrupt` changes a byte. */
function page(corrupt: (bytes: Uint8Array) => void = () => {}): Uint8Array {
  const bytes = new Uint8Array(27 + 1 + 2);
  bytes.set(new TextEncoder().encode('OggS'));
  bytes[5] = BEGINNING_OF_STREAM;
  new DataView(bytes.buffer).setUint32(14, 7, true);
  bytes[26] = 1;
  bytes[27] = 2;
  bytes.set(new TextEncoder().encode('ab'), 28);
  new DataView(bytes.buffer).setUint32(CHECKSUM_OFFSET, bitwiseChecksum(bytes), true);
  corrupt(bytes);
  return bytes;
}

describe('readOggPage', () => {
  it('reads a page whose checksum matches', () => {
    const read = readOggPage(new ByteReader(page()));
    expect(read).toMatchObject({ flags: BEGINNING_OF_STREAM, serial: 7 });
    expect(read?.segments.map((segment) => new TextDecoder().decode(segment))).toEqual(['ab']);
  });

  it('gives null for a page with a corrupt body byte', () => {
    expect(readOggPage(new ByteReader(page((bytes) => (bytes[28]! ^= 1))))).toBeNull();
  });

  it('gives null for a page with a corrupt checksum', () => {
    expect(readOggPage(new ByteReader(page((bytes) => (bytes[CHECKSUM_OFFSET]! ^= 1))))).toBeNull();
  });

  it('gives null where the bytes are not a page', () => {
    expect(readOggPage(new ByteReader(new Uint8Array(40)))).toBeNull();
  });

  it('throws when the page is cut short', () => {
    expect(() => readOggPage(new ByteReader(page().subarray(0, 29)))).toThrow(ReadPastEndError);
  });
});
