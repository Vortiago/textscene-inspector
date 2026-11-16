const ADLER_BASE = 65521;
/** `NMAX` (adler32.c:14): zlib's run of bytes between two modulos, short enough to keep both sums exact. */
const ADLER_NMAX = 5552;

/**
 * `adler32` (zlib adler32.c): the checksum after a zlib stream, as an unsigned 32-bit number.
 * @canonical The Adler-32 of a byte array
 */
export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let start = 0; start < bytes.length; start += ADLER_NMAX) {
    for (const byte of bytes.subarray(start, start + ADLER_NMAX)) {
      a += byte;
      b += a;
    }
    a %= ADLER_BASE;
    b %= ADLER_BASE;
  }
  return ((b << 16) | a) >>> 0;
}

/** Written only by `crcTable`, on the first call. */
let table: Uint32Array | undefined;

function crcTable(): Uint32Array {
  if (table) return table;
  table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

/**
 * `crc32` (zlib crc32.c): the CRC-32 of gzip and PNG, as an unsigned 32-bit number.
 * @canonical The CRC-32 of a byte array
 */
export function crc32(bytes: Uint8Array): number {
  const lookup = crcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) crc = lookup[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
