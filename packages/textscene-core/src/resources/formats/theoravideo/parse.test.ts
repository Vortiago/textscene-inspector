import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixturesDir } from '../../../parser/testing/parserKit';
import { parseTheoraVideo, theoraPictureSizeOf } from './parse';

function clipBuffer(name: string): ArrayBuffer {
  const bytes = readFileSync(resolve(fixturesDir(), 'video', name));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('parseTheoraVideo', () => {
  it('reads a Theora clip as a VideoStreamTheora that states its picture size', () => {
    const parsed = parseTheoraVideo(clipBuffer('clip-64x48.ogv'));
    expect(parsed.resourceType).toBe('VideoStreamTheora');
    expect(theoraPictureSizeOf(parsed)).toEqual({ x: 64, y: 48 });
  });

  it('reads a file with no Theora stream as a VideoStreamTheora with no picture size', () => {
    const parsed = parseTheoraVideo(clipBuffer('vorbis-only.ogv'));
    expect(parsed.resourceType).toBe('VideoStreamTheora');
    expect(theoraPictureSizeOf(parsed)).toBeNull();
  });
});
