/**
 * The base64 body Godot's text writer gives a `PackedByteArray` (`resource_format_text.cpp:1724-1732`
 * writes the list form only for a file whose every byte array holds 64 bytes or fewer).
 */

/**
 * The bytes a base64 body holds. Throws on text that is no base64. A plain loop into a
 * preallocated array, not `Uint8Array.from` with a mapper: that calls the mapper per character,
 * over 20 times slower on a 4 MB payload.
 */
export function decodeBase64Bytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
