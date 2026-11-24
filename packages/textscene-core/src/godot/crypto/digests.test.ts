import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hexBytes } from './blockHash';
import { md5 } from './md5';
import { sha1 } from './sha1';
import { sha256 } from './sha256';

const DIGESTS = { md5, sha1, sha256 } as const;

/** Lengths around each block and padding edge: 55 and 56 bytes split where the length goes. */
const LENGTHS = [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 127, 128, 1000];

const message = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 131 + 7) & 0xff);

describe.each(Object.entries(DIGESTS))('%s', (name, digest) => {
  it.each(LENGTHS)('matches node:crypto on %i bytes', (length) => {
    const bytes = message(length);
    expect(hexBytes(digest([bytes]))).toBe(createHash(name).update(bytes).digest('hex'));
  });

  it('hashes chunks as their concatenation', () => {
    const bytes = message(130);
    expect(hexBytes(digest([bytes.subarray(0, 50), bytes.subarray(50, 61), bytes.subarray(61)]))).toBe(
      hexBytes(digest([bytes]))
    );
  });
});
