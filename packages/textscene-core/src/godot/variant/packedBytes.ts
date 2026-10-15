/**
 * The two bodies Godot's text writer gives a `PackedByteArray`: base64, or the element list it
 * writes only for a file whose every byte array holds 64 bytes or fewer
 * (`resource_format_text.cpp:1724-1732`).
 */

import { parseGodotInt } from './int.js';
import { toUint8 } from './intWidth.js';
import { literalText, STRING_LITERAL_RE } from '../string/string.js';

/**
 * The bytes between a `PackedByteArray(…)`'s parentheses. Each listed element is an int Variant
 * narrowed by `(uint8_t)` (`variant_parser.cpp:650`, `variant.h:442`), so -1 stores 255. Null for
 * a body Godot's reader refuses, which fails the whole resource.
 */
export function parsePackedByteArrayBody(body: string): Uint8Array | null {
  const trimmed = body.trim();
  if (STRING_LITERAL_RE.exec(trimmed)) return base64OrNull(literalText(trimmed));
  if (trimmed === '') return new Uint8Array(0);
  const elements = trimmed.split(',');
  const bytes = new Uint8Array(elements.length);
  for (let i = 0; i < elements.length; i++) {
    const element = parseGodotInt(elements[i]!, 'int64');
    if (element === null || Number.isNaN(element)) return null;
    bytes[i] = toUint8(element);
  }
  return bytes;
}

function base64OrNull(base64: string): Uint8Array | null {
  try {
    return decodeBase64Bytes(base64);
  } catch {
    return null;
  }
}

/**
 * The bytes a base64 body holds. Throws on text that is no base64. A plain loop into a
 * preallocated array, not `Uint8Array.from` with a mapper: that calls the mapper per character,
 * over 20 times slower on a 4 MB payload.
 */
export function decodeBase64Bytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
