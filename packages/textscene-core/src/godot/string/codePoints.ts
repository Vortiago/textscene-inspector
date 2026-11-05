/**
 * Code point arithmetic over a JS string. A Godot `String` holds code points, so a character outside
 * the Basic Multilingual Plane counts one where its JS string counts two UTF-16 units. Every count,
 * cut and index that Godot exposes goes through here.
 */

/** UTF-16 units that the code point at `offset` takes: 2 for an astral character, else 1. */
function widthAt(text: string, offset: number): number {
  return text.codePointAt(offset)! > 0xffff ? 2 : 1;
}

/** Code points in `text`. A lone surrogate counts one, as `String` stores it. */
export function codePointCount(text: string): number {
  let count = 0;
  for (let offset = 0; offset < text.length; offset += widthAt(text, offset)) count++;
  return count;
}

/** UTF-16 offset where code point `index` starts, or `text.length` past the end. */
export function utf16OffsetOf(text: string, index: number): number {
  let offset = 0;
  for (let seen = 0; seen < index && offset < text.length; seen++) {
    offset += widthAt(text, offset);
  }
  return offset;
}

/** UTF-16 offset just past the code point that starts at `offset`, or `text.length` past the end. */
export function offsetAfterCodePoint(text: string, offset: number): number {
  return offset >= text.length ? text.length : offset + widthAt(text, offset);
}

/** `text.substr(0, count)` in code points (`ustring.cpp`). */
export function sliceCodePoints(text: string, count: number): string {
  return text.slice(0, utf16OffsetOf(text, count));
}
