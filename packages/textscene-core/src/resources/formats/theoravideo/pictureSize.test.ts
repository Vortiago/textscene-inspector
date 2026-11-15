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
const IDENTIFICATION_BYTES = 42;

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

  // Measured with `pnpm ref:godot`: Godot shows no size for each corruption below.
  it('gives null when the identification page has a corrupt byte', () => {
    const clip = clipBytes('clip-64x48.ogv').slice();
    clip[IDENTIFICATION_OFFSET + 38]! ^= 0xff;
    expect(readTheoraPictureSize(clip)).toBeNull();
  });

  it('gives null when a later header page has a corrupt byte', () => {
    const clip = clipBytes('clip-64x48.ogv').slice();
    const secondPage = IDENTIFICATION_OFFSET + IDENTIFICATION_BYTES;
    clip[secondPage + 27 + clip[secondPage + 26]! + 20]! ^= 0xff;
    expect(readTheoraPictureSize(clip)).toBeNull();
  });
});
