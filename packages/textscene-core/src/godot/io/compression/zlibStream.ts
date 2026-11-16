import { adler32, crc32 } from './checksums.js';

/** A raw deflate decoder: the bytes, or a throw for a stream it refuses or one that ends early. */
export type RawInflate = (deflate: Uint8Array) => Uint8Array;

/** What zlib's `inflate` takes from the input: the bytes, and where its trailer ends. */
export interface InflatedStream {
  readonly output: Uint8Array;
  readonly end: number;
}

const ZLIB_HEADER_LENGTH = 2;
const GZIP_HEADER_LENGTH = 10;
const TRAILER_LENGTH = 4;
const DEFLATE_METHOD = 8;
const MAX_WINDOW_BITS = 15;
const PRESET_DICTIONARY = 0x20;
const GZIP_HEADER_CRC = 0x02;
const GZIP_EXTRA = 0x04;
const GZIP_NAME = 0x08;
const GZIP_COMMENT = 0x10;
const GZIP_RESERVED = 0xe0;

const u32be = (bytes: Uint8Array, at: number) =>
  ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
const u32le = (bytes: Uint8Array, at: number) =>
  (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0;

/** `inflate` with windowBits 15 (inflate.c:506): nothing for a header, stream or Adler-32 zlib refuses. */
export function inflateZlib(input: Uint8Array, inflate: RawInflate): InflatedStream | undefined {
  if (input.length < ZLIB_HEADER_LENGTH) return undefined;
  const [method, flags] = [input[0]!, input[1]!];
  if (((method << 8) | flags) % 31 !== 0) return undefined;
  if ((method & 0x0f) !== DEFLATE_METHOD || (method >> 4) + 8 > MAX_WINDOW_BITS) return undefined;
  if (flags & PRESET_DICTIONARY) return undefined;
  const body = deflateStream(input.subarray(ZLIB_HEADER_LENGTH), inflate);
  if (!body) return undefined;
  const trailer = ZLIB_HEADER_LENGTH + body.end;
  if (input.length < trailer + TRAILER_LENGTH || u32be(input, trailer) !== adler32(body.output))
    return undefined;
  return { output: body.output, end: trailer + TRAILER_LENGTH };
}

/** `inflate` with windowBits 31 (inflate.c:553): one gzip member, with its header CRC, CRC-32 and length. */
export function inflateGzip(input: Uint8Array, inflate: RawInflate): InflatedStream | undefined {
  const start = gzipBodyStart(input);
  if (start === undefined) return undefined;
  const body = deflateStream(input.subarray(start), inflate);
  if (!body) return undefined;
  const trailer = start + body.end;
  if (input.length < trailer + 2 * TRAILER_LENGTH) return undefined;
  if (u32le(input, trailer) !== crc32(body.output)) return undefined;
  if (u32le(input, trailer + TRAILER_LENGTH) !== body.output.length % 2 ** 32) return undefined;
  return { output: body.output, end: trailer + 2 * TRAILER_LENGTH };
}

/** Where the deflate stream starts after a gzip header, or nothing for a header zlib refuses. */
function gzipBodyStart(input: Uint8Array): number | undefined {
  if (input.length < GZIP_HEADER_LENGTH || input[0] !== 0x1f || input[1] !== 0x8b) return undefined;
  const flags = input[3]!;
  if (input[2] !== DEFLATE_METHOD || flags & GZIP_RESERVED) return undefined;
  let at = GZIP_HEADER_LENGTH;
  if (flags & GZIP_EXTRA) {
    if (input.length < at + 2) return undefined;
    at += 2 + (input[at]! | (input[at + 1]! << 8));
  }
  if (flags & GZIP_NAME) at = afterZero(input, at);
  if (flags & GZIP_COMMENT) at = afterZero(input, at);
  if (flags & GZIP_HEADER_CRC) {
    if (input.length < at + 2) return undefined;
    if ((input[at]! | (input[at + 1]! << 8)) !== (crc32(input.subarray(0, at)) & 0xffff)) return undefined;
    at += 2;
  }
  return at <= input.length ? at : undefined;
}

/** The index after the NUL that ends a header field, or past the input where none does. */
function afterZero(input: Uint8Array, at: number): number {
  const zero = input.indexOf(0, at);
  return zero === -1 ? input.length + 1 : zero + 1;
}

/** The deflate stream at the start of `input`, which ends at the shortest prefix the decoder takes. */
function deflateStream(input: Uint8Array, inflate: RawInflate): InflatedStream | undefined {
  const output = inflated(input, inflate);
  if (!output) return undefined;
  let [shortest, longest] = [0, input.length];
  while (longest - shortest > 1) {
    const middle = Math.floor((shortest + longest) / 2);
    if (inflated(input.subarray(0, middle), inflate)) longest = middle;
    else shortest = middle;
  }
  return { output, end: longest };
}

function inflated(input: Uint8Array, inflate: RawInflate): Uint8Array | undefined {
  try {
    return inflate(input);
  } catch {
    // The decoder throws for an invalid stream and for one cut short, which zlib also refuses.
    return undefined;
  }
}
