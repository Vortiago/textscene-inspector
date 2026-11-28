/** StreamFile rereads Latin-1 as UTF-8 (variant_parser.cpp:399-404, ustring.cpp:1695-1716, :1755-1910). */
export function fileString(text: string): string {
  const bytes = Uint8Array.from(text, (c) => (c.codePointAt(0)! <= 255 ? c.charCodeAt(0) : 32));
  let offset = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  let result = '';
  while (offset < bytes.length) {
    const first = bytes[offset++]!;
    if (first < 0x80) {
      result += String.fromCharCode(first);
      continue;
    }
    const width = first < 0xc2 || first >= 0xf8 ? 0 : first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4;
    const secondMin = first === 0xe0 ? 0xa0 : first === 0xf0 ? 0x90 : 0x80;
    const secondMax = first === 0xed ? 0x9f : first === 0xf4 ? 0x8f : 0xbf;
    let value = first & (0x7f >> width);
    let consumed = 1;
    while (consumed < width) {
      const byte = bytes[offset + consumed - 1];
      // At EOF Godot replaces each leftover byte separately (ustring.cpp:1840-1910).
      if (byte === undefined) {
        consumed = 1;
        break;
      }
      const min = consumed === 1 ? secondMin : 0x80;
      const max = consumed === 1 ? secondMax : 0xbf;
      if (byte < min || byte > max) break;
      value = (value << 6) | (byte & 0x3f);
      consumed++;
    }
    const complete = consumed === width && value <= 0x10ffff;
    result += complete ? String.fromCodePoint(value) : '\ufffd';
    // Godot also consumes only the lead byte for an out-of-range code point.
    if (consumed !== width || complete) offset += consumed - 1;
  }
  return result;
}
