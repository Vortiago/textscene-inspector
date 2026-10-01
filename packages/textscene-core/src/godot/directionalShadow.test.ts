import { describe, it, expect } from 'vitest';
import {
  DirectionalShadowMode,
  blendsSplits,
  directionalShadowBlendStart,
  DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
  directionalShadowFade,
  directionalShadowSlice,
  directionalShadowSnapStep,
  directionalShadowSplitAtlasRect,
  directionalShadowSplitCount,
  directionalShadowSplitDistances,
  directionalShadowSplitOffsets,
  directionalShadowSplitRange,
  directionalShadowSplitTextureSize,
  directionalShadowTexelSize,
  pancakesCasters,
  texelPaddedRadius,
} from './directionalShadow.js';

describe('directionalShadowSlice', () => {
  it('pulls the far end in to the shadow max distance for a perspective camera', () => {
    expect(directionalShadowSlice(0.05, 4000, 80, false)).toEqual({ near: 0.05, far: 80 });
  });

  it('keeps the camera far plane when it is nearer than the shadow max distance', () => {
    expect(directionalShadowSlice(0.1, 50, 80, false)).toEqual({ near: 0.1, far: 50 });
  });

  it('ignores the shadow max distance for an orthogonal camera', () => {
    expect(directionalShadowSlice(0.05, 4000, 80, true)).toEqual({ near: 0.05, far: 4000 });
  });

  it('reads a zero shadow max distance as the camera far plane', () => {
    expect(directionalShadowSlice(0.05, 300, 0, false)).toEqual({ near: 0.05, far: 300 });
  });

  it('keeps the far end 0.001 past the near end (edge case)', () => {
    const slice = directionalShadowSlice(10, 20, 5, false);
    expect(slice.near).toBe(10);
    expect(slice.far).toBeCloseTo(10.001, 12);
  });

  it('passes a nan far plane through to the near floor (error case)', () => {
    // MIN and MAX answer their second operand when a comparison with nan fails.
    const slice = directionalShadowSlice(1, Number.NaN, 0, false);
    expect(slice.far).toBeCloseTo(1.001, 12);
    expect(slice.near).toBe(1);
  });
});

describe('texelPaddedRadius', () => {
  it('adds one texel on each side of the map', () => {
    expect(texelPaddedRadius(1023, 2048)).toBeCloseTo(1024, 9);
  });

  it('leaves a zero radius at zero (edge case)', () => {
    expect(texelPaddedRadius(0, 2048)).toBe(0);
  });

  it('answers infinity for a two-texel map (error case)', () => {
    expect(texelPaddedRadius(1, 2)).toBe(Infinity);
  });
});

describe('directionalShadowSnapStep', () => {
  it('is four radii over the map size', () => {
    expect(directionalShadowSnapStep(512, 2048)).toBe(1);
  });

  it('is zero for a zero radius, which snapped() reads as no snapping (edge case)', () => {
    expect(directionalShadowSnapStep(0, 2048)).toBe(0);
  });

  it('answers infinity for an empty map (error case)', () => {
    expect(directionalShadowSnapStep(1, 0)).toBe(Infinity);
  });
});

describe('directionalShadowTexelSize', () => {
  it('is the map diameter over its size', () => {
    expect(directionalShadowTexelSize(1024, 4096)).toBe(0.5);
  });

  it('is zero for a zero radius (edge case)', () => {
    expect(directionalShadowTexelSize(0, 4096)).toBe(0);
  });

  it('answers infinity for an empty map (error case)', () => {
    expect(directionalShadowTexelSize(1, 0)).toBe(Infinity);
  });
});

describe('pancakesCasters', () => {
  it('pancakes for a positive pancake size', () => {
    expect(pancakesCasters(20)).toBe(true);
  });

  it('does not pancake at zero (edge case)', () => {
    expect(pancakesCasters(0)).toBe(false);
  });

  it('does not pancake for nan (error case)', () => {
    expect(pancakesCasters(Number.NaN)).toBe(false);
  });
});

describe('directionalShadowSplitCount', () => {
  it('draws one, two or four splits for the three modes', () => {
    expect(directionalShadowSplitCount(DirectionalShadowMode.ORTHOGONAL)).toBe(1);
    expect(directionalShadowSplitCount(DirectionalShadowMode.PARALLEL_2_SPLITS)).toBe(2);
    expect(directionalShadowSplitCount(DirectionalShadowMode.PARALLEL_4_SPLITS)).toBe(4);
  });

  it('draws no split for a mode past the enum (edge case)', () => {
    expect(directionalShadowSplitCount(3)).toBe(0);
  });

  it('draws no split for nan (error case)', () => {
    expect(directionalShadowSplitCount(Number.NaN)).toBe(0);
  });
});

describe('directionalShadowSplitDistances', () => {
  const slice = { near: 0.05, far: 100.05 };
  const offsets = [0.1, 0.2, 0.5];

  it('places the four splits at their fractions of the slice', () => {
    const distances = directionalShadowSplitDistances(slice, 4, offsets);
    expect(distances).toHaveLength(5);
    [0.05, 10.05, 20.05, 50.05, 100.05].forEach((depth, i) => expect(distances[i]).toBeCloseTo(depth, 9));
  });

  it('ends two splits at the slice far end, never at split_2 (edge case)', () => {
    const distances = directionalShadowSplitDistances(slice, 2, offsets);
    expect(distances).toHaveLength(3);
    expect(distances[1]).toBeCloseTo(10.05, 9);
    expect(distances[2]).toBe(100.05);
  });

  it('places a missing offset at the slice near end (error case)', () => {
    const distances = directionalShadowSplitDistances(slice, 4, [0.1]);
    expect(distances[2]).toBe(0.05);
  });
});

describe('directionalShadowSplitRange', () => {
  const distances = [0, 10, 20, 50, 100];

  it('covers its own depths without blending', () => {
    expect(directionalShadowSplitRange(distances, 2, false)).toEqual({ near: 20, far: 50 });
  });

  it('starts where the previous split starts with blending', () => {
    expect(directionalShadowSplitRange(distances, 2, true)).toEqual({ near: 10, far: 50 });
  });

  it('keeps the first split at the slice near end with blending (edge case)', () => {
    expect(directionalShadowSplitRange(distances, 0, true)).toEqual({ near: 0, far: 10 });
  });

  it('answers an undefined far end for a split past the last (error case)', () => {
    expect(directionalShadowSplitRange(distances, 4, false).far).toBeUndefined();
  });
});

describe('directionalShadowSplitOffsets', () => {
  it('gives each of four splits its own far end', () => {
    expect(directionalShadowSplitOffsets([0, 10, 20, 50, 100], 4)).toEqual([10, 20, 50, 100]);
  });

  it('repeats the last far end for two splits (edge case)', () => {
    expect(directionalShadowSplitOffsets([0, 10, 100], 2)).toEqual([10, 100, 100, 100]);
  });

  it('repeats the one far end for an orthogonal light (edge case)', () => {
    expect(directionalShadowSplitOffsets([0, 100], 1)).toEqual([100, 100, 100, 100]);
  });

  it('answers undefined offsets for distances shorter than the split count (error case)', () => {
    expect(directionalShadowSplitOffsets([0], 2)).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe('blendsSplits', () => {
  it('blends a split light that asks for it', () => {
    expect(blendsSplits(4, true)).toBe(true);
  });

  it('never blends an orthogonal light (edge case)', () => {
    expect(blendsSplits(1, true)).toBe(false);
  });

  it('does not blend a split light that does not ask (error case)', () => {
    expect(blendsSplits(2, false)).toBe(false);
  });
});

describe('directionalShadowBlendStart', () => {
  it('starts the blend a tenth short of the split far end', () => {
    expect(directionalShadowBlendStart(50)).toBe(45);
  });

  it('starts at zero for a split that ends at zero (edge case)', () => {
    expect(directionalShadowBlendStart(0)).toBe(0);
  });

  it('passes nan through (error case)', () => {
    expect(directionalShadowBlendStart(Number.NaN)).toBeNaN();
  });
});

describe('directionalShadowSplitTextureSize', () => {
  it('halves the atlas for four splits', () => {
    expect(directionalShadowSplitTextureSize(4, 4096)).toBe(2048);
  });

  it('keeps the atlas width for two splits (edge case)', () => {
    expect(directionalShadowSplitTextureSize(2, 4096)).toBe(4096);
  });

  it('keeps the whole atlas for a count with no split (error case)', () => {
    expect(directionalShadowSplitTextureSize(0, 4096)).toBe(4096);
  });
});

describe('directionalShadowSplitAtlasRect', () => {
  it('puts four splits in the quadrants in reading order', () => {
    expect(directionalShadowSplitAtlasRect(4, 1, 4096)).toEqual({ x: 2048, y: 0, width: 2048, height: 2048 });
    expect(directionalShadowSplitAtlasRect(4, 2, 4096)).toEqual({ x: 0, y: 2048, width: 2048, height: 2048 });
    expect(directionalShadowSplitAtlasRect(4, 3, 4096)).toEqual({
      x: 2048,
      y: 2048,
      width: 2048,
      height: 2048,
    });
  });

  it('puts two splits in the halves of the height (edge case)', () => {
    expect(directionalShadowSplitAtlasRect(2, 1, 4096)).toEqual({ x: 0, y: 2048, width: 4096, height: 2048 });
  });

  it('gives an orthogonal light the whole atlas', () => {
    expect(directionalShadowSplitAtlasRect(1, 0, 4096)).toEqual({ x: 0, y: 0, width: 4096, height: 4096 });
  });

  it('gives an unknown count the whole atlas (error case)', () => {
    expect(directionalShadowSplitAtlasRect(3, 2, 4096)).toEqual({ x: 0, y: 0, width: 4096, height: 4096 });
  });
});

describe('directionalShadowFade', () => {
  it('fades from the fade start of the slice to its far end', () => {
    const fade = directionalShadowFade(80, DIRECTIONAL_SHADOW_FADE_START_DEFAULT);
    expect(fade.from).toBeCloseTo(64, 12);
    expect(fade.to).toBe(80);
  });

  it('caps a fade start of 1 below the far end, so the fade stays defined (edge case)', () => {
    const fade = directionalShadowFade(100, 1);
    expect(fade.from).toBeCloseTo(99.9, 12);
    expect(fade.from).toBeLessThan(fade.to);
  });

  it('reads a nan fade start as the ceiling, as Godot MIN does (error case)', () => {
    expect(directionalShadowFade(100, Number.NaN).from).toBeCloseTo(99.9, 12);
  });

  it('fades across the whole slice for a fade start of 0 (edge case)', () => {
    expect(directionalShadowFade(50, 0)).toEqual({ from: 0, to: 50 });
  });
});
