const word = new DataView(new ArrayBuffer(4));

/**
 * The bits of a float as a signed 32-bit integer, which the C sources call its word.
 *
 * @canonical The bits of a float32
 */
export function floatWord(value: number): number {
  word.setFloat32(0, value);
  return word.getInt32(0);
}

/** The float whose bits are `bits`. */
export function floatOfWord(bits: number): number {
  word.setInt32(0, bits);
  return word.getFloat32(0);
}
