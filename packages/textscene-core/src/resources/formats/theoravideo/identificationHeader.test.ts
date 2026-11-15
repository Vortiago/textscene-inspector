import { describe, expect, it } from 'vitest';
import { pictureSizeOfIdentification } from './identificationHeader';

/** A valid 64 x 48 identification header: version 3.2.1, a 64 x 48 frame, 30 fps, 4:2:0. */
function identificationHeader(patch: (header: Uint8Array) => void = () => {}): Uint8Array {
  const header = new Uint8Array(42);
  header.set([0x80, ...new TextEncoder().encode('theora'), 3, 2, 1]);
  header.set([0, 4, 0, 3], 10); // frame size in macroblocks
  header.set([0, 0, 64, 0, 0, 48], 14); // picture size
  header.set([0, 0, 0, 30, 0, 0, 0, 1], 22); // frame rate 30 / 1
  patch(header);
  return header;
}

describe('pictureSizeOfIdentification', () => {
  it('reads the picture size', () => {
    expect(pictureSizeOfIdentification(identificationHeader())).toEqual({ x: 64, y: 48 });
  });

  it('accepts an older minor version and any subminor version', () => {
    expect(pictureSizeOfIdentification(identificationHeader((h) => h.set([3, 1, 9], 7)))).toEqual({
      x: 64,
      y: 48,
    });
  });

  it('gives null for a header shorter than 42 bytes', () => {
    expect(pictureSizeOfIdentification(identificationHeader().subarray(0, 41))).toBeNull();
  });

  // Each case is a header libtheora refuses (`decinfo.c:51-118`) and Godot shows no size for it
  // (measured with `pnpm ref:godot` on a patched clip).
  it.each([
    ['a newer minor version', (h: Uint8Array) => (h[8] = 3)],
    ['a newer major version', (h: Uint8Array) => (h[7] = 4)],
    ['the reserved pixel format', (h: Uint8Array) => (h[41] = 0x08)],
    ['set reserved bits', (h: Uint8Array) => (h[41] = 0x01)],
    ['a zero frame rate numerator', (h: Uint8Array) => h.fill(0, 22, 26)],
    ['a zero frame rate denominator', (h: Uint8Array) => h.fill(0, 26, 30)],
    ['a zero coded frame', (h: Uint8Array) => h.fill(0, 10, 12)],
    ['a picture wider than the frame', (h: Uint8Array) => (h[16] = 65)],
    ['a picture offset past the frame', (h: Uint8Array) => (h[20] = 1)],
  ])('gives null for %s', (_name, patch) => {
    expect(pictureSizeOfIdentification(identificationHeader(patch))).toBeNull();
  });
});
