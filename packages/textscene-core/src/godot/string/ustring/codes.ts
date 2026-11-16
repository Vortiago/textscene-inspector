import { GodotCrash } from '../../variant/cInteger.js';

/** A text as its code points, the `char32_t` units a Godot `String` holds. */
export const codesOf = (text: string): number[] => Array.from(text, (char) => char.codePointAt(0)!);

/** V8's longest string, in UTF-16 units: `String::kMaxLength` on a 64-bit build. */
export const MAX_TEXT_LENGTH = 2 ** 29 - 24;

/** A String past U+10FFFF, with two surrogates in a row, or too long for a JavaScript string. */
export class UnrepresentableText extends Error {}

const isHighSurrogate = (code: number | undefined) => code !== undefined && code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** The text of a run of code points. Two surrogates in a row would read back as one code point. */
export function textOf(codes: readonly number[]): string {
  codes.forEach((code, index) => {
    if (code > 0x10ffff)
      throw new UnrepresentableText(`a String holding U+${code.toString(16).toUpperCase()}`);
    if (isLowSurrogate(code) && isHighSurrogate(codes[index - 1]))
      throw new UnrepresentableText('a String holding two surrogates in a row');
  });
  return codes.map((code) => String.fromCodePoint(code)).join('');
}

/** `String::substr` (ustring.cpp:3014): `count` -1 runs to the end, and out of range is empty. */
export function substr(codes: readonly number[], from: number, count = -1): number[] {
  const length = codes.length;
  let chars = count === -1 ? (length - from) | 0 : count;
  if (length === 0 || from < 0 || from >= length || chars <= 0) return [];
  // `p_from + p_chars` wraps past INT32_MAX, so the copy reads gigabytes past the text.
  if (((from + chars) | 0) !== from + chars) throw new GodotCrash(`String::substr(${from}, ${chars})`);
  if (from + chars > length) chars = length - from;
  return codes.slice(from, from + chars);
}
