/** `_replacement_char`: U+FFFD. */
export const REPLACEMENT = 0xfffd;

/** `String::ascii` (ustring.cpp:1695): a code past 0x7f becomes a space. */
export const asciiBytes = (codes: readonly number[]): number[] =>
  codes.map((code) => (code <= 0x7f ? code : 0x20));

// No JavaScript string holds a code past U+10FFFF, so `utf8` needs no five or six byte form.
const utf8Width = (code: number): number => (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);

/** `String::utf8` (ustring.cpp:1919): a lone surrogate keeps its three bytes. */
export function utf8Bytes(codes: readonly number[]): number[] {
  const bytes: number[] = [];
  for (const code of codes) {
    const width = utf8Width(code);
    if (width === 1) {
      bytes.push(code);
      continue;
    }
    bytes.push(((0xff00 >> width) & 0xff) | (code >> (6 * (width - 1))));
    for (let shift = 6 * (width - 2); shift >= 0; shift -= 6) bytes.push(0x80 | ((code >> shift) & 0x3f));
  }
  return bytes;
}

/** `String::utf16` (ustring.cpp:2134) as the little-endian bytes of `to_utf16_buffer`. */
export function utf16Bytes(codes: readonly number[]): number[] {
  const units = codes.flatMap((code) =>
    code <= 0xffff ? [code] : [(code >> 10) + 0xd7c0, (code & 0x3ff) | 0xdc00]
  );
  return units.flatMap((unit) => [unit & 0xff, unit >> 8]);
}

/** The code points as the little-endian bytes of `to_utf32_buffer`. */
export const utf32Bytes = (codes: readonly number[]): number[] =>
  codes.flatMap((code) => [code & 0xff, (code >>> 8) & 0xff, (code >>> 16) & 0xff, code >>> 24]);

const isContinuation = (byte: number) => (byte & 0xc0) === 0x80;

/** One sequence of `append_utf8`: its code, U+FFFD where it is malformed, and the bytes it takes. */
function utf8Sequence(bytes: readonly number[], at: number, end: number): { code: number; size: number } {
  const lead = bytes[at]!;
  const byteAt = (offset: number) => (at + offset < end ? bytes[at + offset]! : 0);
  const invalid = { code: REPLACEMENT, size: 1 };
  if ((lead & 0x80) === 0) return { code: lead, size: 1 };
  if ((lead & 0xe0) === 0xc0) {
    if (at + 1 >= end || !isContinuation(byteAt(1))) return invalid;
    const code = ((lead & 0x1f) << 6) | (byteAt(1) & 0x3f);
    return code < 0x80 ? invalid : { code, size: 2 };
  }
  if ((lead & 0xf0) === 0xe0) {
    const second = byteAt(1);
    const third = byteAt(2);
    const isSecondValid =
      second !== 0 && second >= (lead === 0xe0 ? 0xa0 : 0x80) && second <= (lead === 0xed ? 0x9f : 0xbf);
    const isThirdValid = third !== 0 && isContinuation(third);
    if (isSecondValid && isThirdValid)
      return { code: ((lead & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f), size: 3 };
    // A truncated sequence well formed so far replaces both of its bytes with one U+FFFD (Unicode 3.9).
    return { code: REPLACEMENT, size: isSecondValid && third !== 0 ? 2 : 1 };
  }
  if ((lead & 0xf8) === 0xf0) {
    const [second, third, fourth] = [byteAt(1), byteAt(2), byteAt(3)];
    const isSecondValid =
      second !== 0 && second >= (lead === 0xf0 ? 0x90 : 0x80) && second <= (lead === 0xf4 ? 0x8f : 0xbf);
    const isThirdValid = third !== 0 && isContinuation(third);
    const isFourthValid = fourth !== 0 && isContinuation(fourth);
    if (isSecondValid && isThirdValid && isFourthValid) {
      const code = ((lead & 0x07) << 18) | ((second & 0x3f) << 12) | ((third & 0x3f) << 6) | (fourth & 0x3f);
      return code > 0x10ffff ? invalid : { code, size: 4 };
    }
    if (!isSecondValid || third === 0) return invalid;
    if (!isThirdValid) return { code: REPLACEMENT, size: 2 };
    return { code: REPLACEMENT, size: fourth === 0 ? 1 : 3 };
  }
  return invalid;
}

/** `String::append_utf8` (ustring.cpp:1750): a leading BOM is skipped, a NUL ends the text. */
export function utf8Codes(bytes: readonly number[]): number[] {
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const codes: number[] = [];
  for (let at = hasBom ? 3 : 0; at < bytes.length && bytes[at] !== 0;) {
    const { code, size } = utf8Sequence(bytes, at, bytes.length);
    codes.push(code);
    at += size;
  }
  return codes;
}
