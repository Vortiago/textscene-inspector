/** The float texture that holds packed rows for the pass that reads them. */
import { describe, expect, it, vi } from 'vitest';
import { RowTexture } from './rowTexture';

/** Rows two texels wide, each texel four floats, every float set to `value`. */
function rows(count: number, value = 1) {
  return { data: new Float32Array(Math.max(1, count) * 8).fill(value), count };
}

describe('RowTexture', () => {
  it('holds the rows in its first rows', () => {
    const texture = new RowTexture(2).hold(rows(3, 5));
    expect(texture.image.height).toBe(3);
    expect(Array.from((texture.image.data as Float32Array).subarray(0, 24))).toEqual(Array(24).fill(5));
  });

  it('keeps its texture when fewer rows arrive, as when the camera culls a volume', () => {
    const rowTexture = new RowTexture(2);
    const held = rowTexture.hold(rows(4));
    expect(rowTexture.hold(rows(1))).toBe(held);
  });

  it('doubles its height when more rows arrive than it has room for (edge case)', () => {
    const rowTexture = new RowTexture(2);
    rowTexture.hold(rows(3));
    expect(rowTexture.hold(rows(4)).image.height).toBe(6);
  });

  it('hands the texture to its owner before it replaces it, so the owner stops pointing at it', () => {
    const beforeReplace = vi.fn();
    const rowTexture = new RowTexture(2, beforeReplace);
    const first = rowTexture.hold(rows(1));

    const grown = rowTexture.hold(rows(3));

    expect(beforeReplace).toHaveBeenCalledExactlyOnceWith(first);
    expect(grown).not.toBe(first);
  });

  it('tells its owner nothing while the texture has room (edge case)', () => {
    const beforeReplace = vi.fn();
    const rowTexture = new RowTexture(2, beforeReplace);

    rowTexture.hold(rows(1));
    rowTexture.hold(rows(1));

    expect(beforeReplace).not.toHaveBeenCalled();
  });

  it('uploads again only after the rows it holds are invalidated', () => {
    const rowTexture = new RowTexture(2);
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
