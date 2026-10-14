import { describe, expect, it } from 'vitest';
import { md5Hex } from './md5';

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('md5Hex', () => {
  it("matches RFC 1321's digest of 'abc'", () => {
    expect(md5Hex([ascii('abc')])).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it("matches RFC 1321's digest of an 80-byte message, which pads into a second block", () => {
    const digits = '1234567890'.repeat(8);

    expect(md5Hex([ascii(digits)])).toBe('57edf4a22be3c955ac49da2e2107b67a');
  });

  it('hashes chunks as the one message they make', () => {
    expect(md5Hex([ascii('message'), ascii(' '), ascii('digest')])).toBe('f96b697d7cb7938d525a2f31aaf161d0');
  });

  it('hashes no bytes (edge case)', () => {
    expect(md5Hex([])).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
});
