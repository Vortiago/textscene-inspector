import { describe, expect, it } from 'vitest';
import { everyTransparentTexelHasASource, fixAlphaEdges } from './fixAlphaEdges';

/** Build a `width * height` RGBA8 buffer from per-texel `[r, g, b, a]` tuples. */
function rgba(width: number, height: number, texels: ReadonlyArray<readonly number[]>): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  texels.forEach((t, i) => out.set(t, i * 4));
  return out;
}

/** The `[r, g, b, a]` tuple at `(x, y)`. */
function texel(data: Uint8Array, width: number, x: number, y: number): number[] {
  const o = (y * width + x) * 4;
  return [data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!];
}

describe('fixAlphaEdges', () => {
  it('gives a transparent texel the RGB of its nearest opaque neighbour', () => {
    // core/io/image.cpp Image::fix_alpha_edges: a texel
    // below the alpha threshold takes the closest opaque texel's RGB, and its
    // own alpha is never written.
    const data = rgba(2, 1, [
      [255, 0, 255, 0],
      [10, 20, 30, 255],
    ]);

    expect(fixAlphaEdges(data, 2, 1)).toBe(true);
    expect(texel(data, 2, 0, 0)).toEqual([10, 20, 30, 0]);
    expect(texel(data, 2, 1, 0)).toEqual([10, 20, 30, 255]);
  });

  it('breaks an equal-distance tie in raster order, so the texel above wins', () => {
    // core/io/image.cpp Image::fix_alpha_edges: the candidate scan runs `for k`
    // (rows, ascending) then `for l`, and takes a candidate only on
    // `dist < closest_dist`. The neighbour above (dy = -1) is therefore reached
    // before the one to the left (dx = -1) at the same squared distance of 1.
    const data = rgba(2, 2, [
      [0, 0, 0, 255], // (0,0) diagonal, distance 2
      [1, 1, 1, 255], // (1,0) above the target
      [2, 2, 2, 255], // (0,1) left of the target
      [9, 9, 9, 0], // (1,1) the target
    ]);

    expect(fixAlphaEdges(data, 2, 2)).toBe(true);
    expect(texel(data, 2, 1, 1)).toEqual([1, 1, 1, 0]);
  });

  it('treats alpha 20 as a source and alpha 19 as a target', () => {
    // core/io/image.cpp Image::fix_alpha_edges: `alpha_threshold = 20`, and the
    // guard is `rptr[3] >= alpha_threshold`: at the threshold exactly, a texel
    // is skipped by the rewrite and eligible as replacement colour.
    const data = rgba(2, 1, [
      [40, 50, 60, 19],
      [70, 80, 90, 20],
    ]);

    expect(fixAlphaEdges(data, 2, 1)).toBe(true);
    expect(texel(data, 2, 0, 0)).toEqual([70, 80, 90, 19]);
    expect(texel(data, 2, 1, 0)).toEqual([70, 80, 90, 20]);
  });

  it('leaves RGB alone when no opaque texel is within the four-texel radius', () => {
    // core/io/image.cpp Image::fix_alpha_edges: `max_radius = 4` bounds the
    // scan, and `closest_dist == max_dist` leaves the texel untouched. The
    // opaque texel five columns away is out of range, and the one four away is not.
    const near = rgba(5, 1, [
      [9, 9, 9, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [7, 7, 7, 255],
    ]);
    expect(fixAlphaEdges(near, 5, 1)).toBe(true);
    expect(texel(near, 5, 0, 0)).toEqual([7, 7, 7, 0]);

    const far = rgba(6, 1, [
      [9, 9, 9, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [7, 7, 7, 255],
    ]);
    expect(fixAlphaEdges(far, 6, 1)).toBe(true);
    expect(texel(far, 6, 0, 0)).toEqual([9, 9, 9, 0]);
  });

  it('reports no change for an image whose transparent texels already match', () => {
    // A fully opaque image has no target, and a transparent texel that already
    // carries its neighbour's colour is rewritten to the same bytes. Both read
    // as "nothing changed" so a caller can keep the original.
    const opaque = rgba(2, 1, [
      [1, 2, 3, 255],
      [4, 5, 6, 255],
    ]);
    expect(fixAlphaEdges(opaque, 2, 1)).toBe(false);

    const alreadyFixed = rgba(2, 1, [
      [4, 5, 6, 0],
      [4, 5, 6, 255],
    ]);
    expect(fixAlphaEdges(alreadyFixed, 2, 1)).toBe(false);
  });

  it('flattens a paletted sprite whose transparent corners hold two leftover key colours', () => {
    // A white octagon on an 8x8 grid whose transparent corners carry black on top
    // and magenta below, as a paletted PNG does. core/io/image.cpp
    // Image::fix_alpha_edges: every corner texel has a white texel within four, so
    // the image comes back white with alpha untouched, as Godot's importer does.
    const white = [255, 255, 255, 255] as const;
    const black = [0, 0, 0, 0] as const;
    const magenta = [255, 0, 255, 0] as const;
    const clear = [255, 255, 255, 0] as const;
    const row = (corner: readonly number[]) => [corner, corner, white, white, white, white, corner, corner];
    const data = rgba(8, 8, [
      ...row(black),
      ...row(black),
      ...Array.from({ length: 4 * 8 }, () => white),
      ...row(magenta),
      ...row(magenta),
    ]);

    expect(fixAlphaEdges(data, 8, 8)).toBe(true);
    expect(texel(data, 8, 0, 0)).toEqual([...clear]);
    expect(texel(data, 8, 7, 7)).toEqual([...clear]);
    expect(texel(data, 8, 1, 1)).toEqual([...clear]);
    expect(texel(data, 8, 6, 6)).toEqual([...clear]);
    expect(texel(data, 8, 3, 3)).toEqual([...white]);
  });

  it('leaves a fully transparent image byte-for-byte unchanged', () => {
    // core/io/image.cpp Image::fix_alpha_edges: with every texel below the
    // threshold there is no replacement colour anywhere, so the image comes
    // back byte-for-byte unchanged rather than blanked.
    const data = rgba(2, 1, [
      [255, 0, 255, 0],
      [0, 255, 0, 0],
    ]);

    expect(fixAlphaEdges(data, 2, 1)).toBe(false);
    expect(texel(data, 2, 0, 0)).toEqual([255, 0, 255, 0]);
    expect(texel(data, 2, 1, 0)).toEqual([0, 255, 0, 0]);
  });
});

/**
 * A precondition on the previewer's readback, not a property of Godot's pass: a
 * transparent texel out of reach keeps its RGB in Godot, but the premultiplied
 * store has already zeroed it here, so the caller checks this before it
 * substitutes the image.
 */
describe('everyTransparentTexelHasASource', () => {
  it('is true when every transparent texel has an opaque one within the radius', () => {
    const data = rgba(2, 1, [
      [255, 0, 255, 0],
      [10, 20, 30, 255],
    ]);
    expect(everyTransparentTexelHasASource(data, 2, 1)).toBe(true);
  });

  it('is false when a transparent texel sits beyond the radius-4 search', () => {
    // 7x1: only texel 1 is opaque, so texel 6 is five apart, out of reach.
    const data = rgba(7, 1, [
      [255, 0, 255, 0],
      [10, 20, 30, 255],
    ]);
    expect(everyTransparentTexelHasASource(data, 7, 1)).toBe(false);
  });

  it('is false when the image holds no opaque texel at all', () => {
    const data = rgba(2, 1, [
      [255, 0, 255, 0],
      [0, 255, 0, 0],
    ]);
    expect(everyTransparentTexelHasASource(data, 2, 1)).toBe(false);
  });

  it('is true for an image with nothing transparent to place', () => {
    const data = rgba(2, 1, [
      [1, 2, 3, 255],
      [4, 5, 6, 255],
    ]);
    expect(everyTransparentTexelHasASource(data, 2, 1)).toBe(true);
  });
});
