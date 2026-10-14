/** The float texture that holds a view's packed rows for the light pass. */
import { describe, expect, it } from 'vitest';
import { FogRowTexture } from './fogRowTexture';

/** Rows two texels wide, each texel four floats, every float set to `value`. */
function rows(count: number, value = 1) {
  return { data: new Float32Array(Math.max(1, count) * 8).fill(value), count };
}

describe('FogRowTexture', () => {
  it('holds the rows in its first rows', () => {
    const texture = new FogRowTexture(2).hold(rows(3, 5));
    expect(texture.image.height).toBe(3);
    expect(Array.from((texture.image.data as Float32Array).subarray(0, 24))).toEqual(Array(24).fill(5));
  });

  it('keeps its texture when fewer rows arrive, as when the camera culls a volume', () => {
    const rowTexture = new FogRowTexture(2);
    const held = rowTexture.hold(rows(4));
    expect(rowTexture.hold(rows(1))).toBe(held);
  });

  it('doubles its height when more rows arrive than it has room for (edge case)', () => {
    const rowTexture = new FogRowTexture(2);
    rowTexture.hold(rows(3));
    expect(rowTexture.hold(rows(4)).image.height).toBe(6);
  });

  it('uploads again only after the rows it holds are invalidated', () => {
    const rowTexture = new FogRowTexture(2);
    const packed = rows(1);
    const texture = rowTexture.hold(packed);
    const version = texture.version;
    rowTexture.hold(packed);
    expect(texture.version).toBe(version);
    rowTexture.invalidate(packed);
    rowTexture.hold(packed);
    expect(texture.version).toBe(version + 1);
  });
});
