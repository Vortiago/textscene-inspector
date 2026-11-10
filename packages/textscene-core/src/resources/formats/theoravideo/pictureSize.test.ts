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

/** The 64 x 48 clip with `patch` applied to its identification header. The reader ignores page checksums. */
function clipWithHeader(patch: (header: Uint8Array) => void): Uint8Array {
  const clip = clipBytes('clip-64x48.ogv').slice();
  patch(clip.subarray(IDENTIFICATION_OFFSET));
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
});
