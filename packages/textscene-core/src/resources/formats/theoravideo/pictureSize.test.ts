import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixturesDir } from '../../../parser/testing/parserKit';
import { readTheoraPictureSize } from './pictureSize';

function clipBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(fixturesDir(), 'video', name)));
}

/** The first page's lacing table is one segment, so the identification packet starts at byte 28. */
const IDENTIFICATION_OFFSET = 28;
const CHECKSUM_OFFSET = 22;

/** The Ogg CRC-32 of a page: polynomial 0x04c11db7, no reflection, the checksum field read as zero (libogg `framing.c:255-275`). */
function oggChecksum(page: Uint8Array): number {
  let register = 0;
  page.forEach((byte, index) => {
    register ^= (index >= CHECKSUM_OFFSET && index < CHECKSUM_OFFSET + 4 ? 0 : byte) << 24;
    for (let bit = 0; bit < 8; bit++)
      register = register & 0x80000000 ? (register << 1) ^ 0x04c11db7 : register << 1;
  });
  return register >>> 0;
}

/** The length of the Ogg page that starts at `start`. */
function pageLength(clip: Uint8Array, start: number): number {
  const segments = clip[start + 26]!;
  return (
    27 + segments + clip.subarray(start + 27, start + 27 + segments).reduce((sum, length) => sum + length, 0)
  );
}

function setChecksum(clip: Uint8Array, start: number): void {
  const page = clip.subarray(start, start + pageLength(clip, start));
  new DataView(page.buffer, page.byteOffset).setUint32(CHECKSUM_OFFSET, oggChecksum(page), true);
}

/** The 64 x 48 clip with `patch` applied to its identification header and the first page's checksum made valid again. */
function clipWithHeader(patch: (header: Uint8Array) => void): Uint8Array {
  const clip = clipBytes('clip-64x48.ogv').slice();
  patch(clip.subarray(IDENTIFICATION_OFFSET));
  setChecksum(clip, 0);
  return clip;
}

describe('readTheoraPictureSize', () => {
  it('reads the picture size of a 4:2:0 clip', () => {
    expect(readTheoraPictureSize(clipBytes('clip-64x48.ogv'))).toEqual({ x: 64, y: 48 });
  });

  it('reads the picture size, not the coded frame size, of a 4:4:4 clip', () => {
    // The coded frame is 80 x 32: macroblocks are 16 pixels square.
    expect(readTheoraPictureSize(clipBytes('clip-444-70x30.ogv'))).toEqual({ x: 70, y: 30 });
  });

  it('gives null for an Ogg file with no Theora stream', () => {
    expect(readTheoraPictureSize(clipBytes('vorbis-only.ogv'))).toBeNull();
  });

  it('gives null when the Theora stream lacks its three header packets', () => {
    const clip = clipBytes('clip-64x48.ogv');
    // Page 1 holds the identification header alone, so any cut inside page 2 or earlier loses a header.
    expect(readTheoraPictureSize(clip.subarray(0, 100))).toBeNull();
  });

  it('gives null when the first page does not begin a stream, as Godot stops looking there', () => {
    const clip = clipBytes('clip-64x48.ogv').slice();
    const FLAGS_OFFSET = 5;
    clip[FLAGS_OFFSET] = clip[FLAGS_OFFSET]! & ~0x02;
    expect(readTheoraPictureSize(clip)).toBeNull();
  });

  it('gives null for bytes that are not an Ogg file', () => {
    expect(readTheoraPictureSize(new TextEncoder().encode('not an ogg file at all'))).toBeNull();
  });

  it('gives null for an empty file', () => {
    expect(readTheoraPictureSize(new Uint8Array(0))).toBeNull();
  });

  // Each case below is a header Godot's libtheora refuses (`decinfo.c` oc_info_unpack), so the
  // stream has no video and the player has no size. Measured with `pnpm ref:godot` on each patch.
  it.each([
    ['a newer minor version', (h: Uint8Array) => (h[8] = 3)],
    ['a newer major version', (h: Uint8Array) => (h[7] = 4)],
    ['the reserved pixel format', (h: Uint8Array) => (h[41] = (h[41]! & ~0x18) | 0x08)],
    ['set reserved bits', (h: Uint8Array) => (h[41] = h[41]! | 0x01)],
    ['a zero frame rate numerator', (h: Uint8Array) => h.fill(0, 22, 26)],
    ['a zero frame rate denominator', (h: Uint8Array) => h.fill(0, 26, 30)],
    ['a zero coded frame', (h: Uint8Array) => (h.fill(0, 10, 12), h.fill(0, 14, 17))],
  ])('gives null for %s', (_name, patch) => {
    expect(readTheoraPictureSize(clipWithHeader(patch))).toBeNull();
  });

  it('reads a header with an older minor version and any subminor version', () => {
    expect(readTheoraPictureSize(clipWithHeader((h) => ((h[8] = 2), (h[9] = 9))))).toEqual({ x: 64, y: 48 });
  });

  describe('Ogg page checksums', () => {
    it('accepts the clip, whose checksums the test helper reproduces', () => {
      const clip = clipBytes('clip-64x48.ogv');
      const stored = new DataView(clip.buffer, clip.byteOffset).getUint32(CHECKSUM_OFFSET, true);
      expect(oggChecksum(clip.subarray(0, pageLength(clip, 0)))).toBe(stored);
    });

    // Measured with `pnpm ref:godot`: Godot shows no size for each corruption below.
    it('gives null when the identification page has a corrupt byte', () => {
      const clip = clipBytes('clip-64x48.ogv').slice();
      clip[IDENTIFICATION_OFFSET + 38] ^= 0xff;
      expect(readTheoraPictureSize(clip)).toBeNull();
    });

    it('gives null when a later header page has a corrupt byte', () => {
      const clip = clipBytes('clip-64x48.ogv').slice();
      const secondPage = pageLength(clip, 0);
      clip[secondPage + 27 + clip[secondPage + 26]! + 20] ^= 0xff;
      expect(readTheoraPictureSize(clip)).toBeNull();
    });
  });
});
