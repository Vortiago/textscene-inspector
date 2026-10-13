import { describe, expect, it } from 'vitest';
import {
  VOLUMETRIC_FOG_DEFAULTS,
  volumetricFogDetailSpread,
  volumetricFogFrustum,
  volumetricFogGrid,
  volumetricFogLookup,
  volumetricFogSkyRoughness,
  volumetricFogSliceDepths,
} from './volumetricFog';

describe('volumetricFogDetailSpread', () => {
  it('keeps a spread inside 0.5-6', () => {
    expect(volumetricFogDetailSpread(2)).toBe(2);
  });

  it('clamps a spread outside 0.5-6 to the nearer end', () => {
    expect(volumetricFogDetailSpread(0.1)).toBe(0.5);
    expect(volumetricFogDetailSpread(10)).toBe(6);
  });
});

describe('volumetricFogGrid', () => {
  it('stretches the grid to the frame, keeping its area near volume_size squared', () => {
    // 955x756: the integer mean is 855, so the ratio is 955 / 855 and the sides truncate.
    expect(volumetricFogGrid({ width: 955, height: 756 }, VOLUMETRIC_FOG_DEFAULTS)).toEqual({
      width: 71,
      height: 57,
      depth: 64,
    });
  });

  it('is volume_size on both sides for a square frame', () => {
    expect(volumetricFogGrid({ width: 600, height: 600 }, VOLUMETRIC_FOG_DEFAULTS)).toEqual({
      width: 64,
      height: 64,
      depth: 64,
    });
  });

  it('takes its depth and side from the project settings', () => {
    const settings = { ...VOLUMETRIC_FOG_DEFAULTS, volumeSize: 32, volumeDepth: 100 };
    expect(volumetricFogGrid({ width: 600, height: 600 }, settings)).toEqual({
      width: 32,
      height: 32,
      depth: 100,
    });
  });
});

describe('volumetricFogSliceDepths', () => {
  it('puts each slice centre at length times its unit depth raised to the spread', () => {
    const depths = volumetricFogSliceDepths({ depth: 64, length: 64, detailSpread: 2 });

    expect(depths).toHaveLength(64);
    expect(depths[0]).toBeCloseTo(0.00390625, 8);
    expect(depths[31]).toBeCloseTo(15.50390625, 6);
    expect(depths[63]).toBeCloseTo(63.00390625, 6);
  });

  it('spaces the slices evenly under a spread of 1', () => {
    const depths = volumetricFogSliceDepths({ depth: 4, length: 8, detailSpread: 1 });

    expect(Array.from(depths)).toEqual([1, 3, 5, 7]);
  });
});

describe('volumetricFogLookup', () => {
  it('maps each slice centre back to its unit depth', () => {
    const volume = { depth: 64, length: 40, detailSpread: 3 };
    const { inverseLength, inverseSpread } = volumetricFogLookup(volume);
    const depths = volumetricFogSliceDepths(volume);

    for (const slice of [0, 17, 63]) {
      expect((depths[slice]! * inverseLength) ** inverseSpread).toBeCloseTo((slice + 0.5) / 64, 6);
    }
  });

  it('reaches the far side of the volume at the fog length', () => {
    const { inverseLength, inverseSpread } = volumetricFogLookup({ length: 64, detailSpread: 2 });
    expect((64 * inverseLength) ** inverseSpread).toBe(1);
  });

  it('takes an inverse length of 1 for a fog length of 0 (edge case)', () => {
    expect(volumetricFogLookup({ length: 0, detailSpread: 2 })).toEqual({
      inverseLength: 1,
      inverseSpread: 0.5,
    });
  });
});

describe('volumetricFogFrustum', () => {
  const perspective = {
    near: 1,
    far: 101,
    nearHalfExtents: { x: 1, y: 0.5 },
    farHalfExtents: { x: 101, y: 50.5 },
    isOrthographic: false,
  };

  it('opens at the near plane and ends at the frustum section at the fog length', () => {
    expect(volumetricFogFrustum(perspective, 51)).toEqual({
      begin: { x: 1, y: 0.5 },
      end: { x: 51, y: 25.5 },
    });
  });

  it('keeps a near section of at least 0.001 on each side', () => {
    const pinhole = { ...perspective, nearHalfExtents: { x: 0.0001, y: 0.0002 } };
    expect(volumetricFogFrustum(pinhole, 51).begin).toEqual({ x: 0.001, y: 0.001 });
  });

  it('is a box under an orthographic projection', () => {
    const box = { ...perspective, farHalfExtents: { x: 1, y: 0.5 }, isOrthographic: true };
    expect(volumetricFogFrustum(box, 51)).toEqual({ begin: { x: 1, y: 0.5 }, end: { x: 1, y: 0.5 } });
  });
});

describe('volumetricFogSkyRoughness', () => {
  it('reads a clear medium at mip 2 of 7', () => {
    expect(volumetricFogSkyRoughness(0)).toBeCloseTo(2 / 7, 8);
  });

  it('reads a denser medium at a blurrier mip', () => {
    expect(volumetricFogSkyRoughness(0.05)).toBeCloseTo(2.25 / 7, 8);
  });

  it('stops at the coarsest mip', () => {
    expect(volumetricFogSkyRoughness(4)).toBe(1);
  });
});
