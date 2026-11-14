/**
 * The decoders ThorVG reads a data URI's payload with: base64 (`b64Decode`, `tvgCompressor.cpp`)
 * and percent encoding (`svgUtilURLDecode`, `tvgSvgUtil.cpp`), each with its quirks kept.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** `B64_INDEX`: `+` and `-` read as 62, `/` and `_` as 63, and any other byte as 0. */
const BASE64_INDEX = (() => {
  const index = new Uint8Array(256);
  for (const [value, character] of [...BASE64_ALPHABET].entries()) index[character.charCodeAt(0)] = value;
  index[0x2b] = index[0x2d] = 62;
  index[0x2f] = index[0x5f] = 63;
  index[0x2c] = 63;
  index[0x2e] = 62;
  return index;
})();

/** A byte the decode stops at: the end, `=` or `.`. */
const isStop = (byte: number): boolean => byte === 0 || byte === 0x3d || byte === 0x2e;

/** A byte ThorVG reads as negative, its `char` being signed. */
const isHigh = (byte: number): boolean => byte >= 0x80;

/**
 * `b64Decode`: four characters to three bytes, stopping at `=` or `.`. White space, control
 * bytes and bytes from 0x80 are skipped where a group starts.
 */
export function decodeBase64(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  const byteAt = (at: number): number => encoded[at] ?? 0;
  const output: number[] = [];
  let at = 0;
  while (byteAt(at) && byteAt(at + 1)) {
    if (byteAt(at) <= 0x20 || isHigh(byteAt(at))) {
      at++;
      continue;
    }
    const value1 = BASE64_INDEX[byteAt(at)]!;
    const value2 = BASE64_INDEX[byteAt(at + 1)]!;
    output.push(((value1 << 2) + ((value2 & 0x30) >> 4)) & 0xff);
    if (isStop(byteAt(at + 2)) || isHigh(byteAt(at + 3))) break;
    const value3 = BASE64_INDEX[byteAt(at + 2)]!;
    output.push((((value2 & 0x0f) << 4) + ((value3 & 0x3c) >> 2)) & 0xff);
    if (isStop(byteAt(at + 3)) || isHigh(byteAt(at + 3))) break;
    const value4 = BASE64_INDEX[byteAt(at + 3)]!;
    output.push((((value3 & 0x03) << 6) + value4) & 0xff);
    at += 4;
  }
  return Uint8Array.from(output);
}

const isHexDigit = (byte: number | undefined): boolean =>
  byte !== undefined && /^[0-9A-Fa-f]$/.test(String.fromCharCode(byte));

/** `svgUtilURLDecode`: `%xx` to its byte and `+` to a space, with the terminating NUL ThorVG counts. */
export function decodeUrl(text: string): Uint8Array {
  const source = new TextEncoder().encode(text);
  const output: number[] = [];
  for (let at = 0; at < source.length;) {
    const byte = source[at]!;
    if (byte === 0x25 && isHexDigit(source[at + 1]) && isHexDigit(source[at + 2])) {
      output.push(parseInt(String.fromCharCode(source[at + 1]!, source[at + 2]!), 16));
      at += 3;
    } else {
      output.push(byte === 0x2b ? 0x20 : byte);
      at++;
    }
  }
  output.push(0);
  return Uint8Array.from(output);
}
