const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The two passes of `mbedtls_base64_decode` (base64.c of mbedtls 3.6), or nothing where it refuses. */
export function decodeMbedtlsBase64(text: string): Uint8Array | undefined {
  const digits: number[] = [];
  let equals = 0;
  for (let index = 0; index < text.length; index++) {
    let hasSpaces = false;
    while (text[index] === ' ') {
      index++;
      hasSpaces = true;
    }
    if (index === text.length) break;
    if (text[index] === '\n' || (text[index] === '\r' && text[index + 1] === '\n')) continue;
    // A space inside a line is refused, while spaces before a line end or the text end are not.
    if (hasSpaces) return undefined;
    if (text[index] === '=') {
      if (++equals > 2) return undefined;
      digits.push(0);
      continue;
    }
    const value = ALPHABET.indexOf(text[index]!);
    if (equals !== 0 || value < 0) return undefined;
    digits.push(value);
  }
  if ((digits.length - equals) % 4 === 1 || digits.length % 4 !== 0) return undefined;
  const bytes = new Uint8Array((digits.length / 4) * 3 - equals);
  for (let block = 0, at = 0; block < digits.length; block += 4) {
    const word =
      (digits[block]! << 18) | (digits[block + 1]! << 12) | (digits[block + 2]! << 6) | digits[block + 3]!;
    for (let shift = 16; shift >= 0 && at < bytes.length; shift -= 8) bytes[at++] = (word >> shift) & 0xff;
  }
  return bytes;
}
