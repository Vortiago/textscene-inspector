/**
 * Code point arithmetic over a JS string. A Godot `String` holds code points, so a character outside
 * the Basic Multilingual Plane counts one where its JS string counts two UTF-16 units. Every count,
 * cut and index that Godot exposes goes through here.
 */

/** Code points in `text`. A lone surrogate counts one, as `String` stores it. */
export function codePointCount(text: string): number {
  let count = 0;
  for (let offset = 0; offset < text.length; offset += text.codePointAt(offset)! > 0xffff ? 2 : 1) count++;
  return count;
}

/** UTF-16 offset where code point `index` starts, or `text.length` past the end. */
export function utf16OffsetOf(text: string, index: number): number {
  let offset = 0;
  for (let seen = 0; seen < index && offset < text.length; seen++) {
    offset += text.codePointAt(offset)! > 0xffff ? 2 : 1;
  }
  return offset;
}

/** `text.substr(0, count)` in code points (`ustring.cpp`). */
export function sliceCodePoints(text: string, count: number): string {
  return text.slice(0, utf16OffsetOf(text, count));
}

/** Index of the code point that holds UTF-16 `offset`. An offset past the end gives the count. */
export function codePointIndexAt(text: string, offset: number): number {
  return codePointCount(text.slice(0, offset));
}
