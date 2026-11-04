import { describe, expect, it } from 'vitest';
import {
  SSAO_PROJECT_DEFAULTS,
  SSAO_ROTATION_MATRICES,
  SSAO_QUALITY,
  ssaoBlurModes,
  ssaoBufferSizes,
  ssaoDepthLevelSize,
  ssaoDepthDownsample,
  ssaoDepthLinearize,
  ssaoGatherParameters,
  ssaoGatheredSlices,
  ssaoInterleaveMode,
  ssaoReadsBlurredFromPong,
  type SsaoProjectSettings,
} from './screenSpaceAmbientOcclusion';

const project = (over: Partial<SsaoProjectSettings> = {}): SsaoProjectSettings => ({
  ...SSAO_PROJECT_DEFAULTS,
  ...over,
});

const ENVIRONMENT_DEFAULTS = {
  radius: 1,
  intensity: 2,
  power: 1.5,
  detail: 0.5,
  horizon: 0.06,
  sharpness: 0.98,
  lightAffect: 0,
  aoChannelAffect: 0,
};

/** A perspective projection, column-major, with `1 / tan` of each half field of view on its diagonal. */
function perspective(xScale: number, yScale: number, near: number, far: number): number[] {
  return [
    xScale,
    0,
    0,
    0,
    0,
    yScale,
    0,
    0,
    0,
    0,
    -(far + near) / (far - near),
    -1,
    0,
    0,
    (-2 * far * near) / (far - near),
    0,
  ];
}

describe('ssaoBufferSizes', () => {
  it('rounds a half-size frame up to a quarter, and its importance map to an eighth (ss_effects.cpp:1104-1108)', () => {
    expect(ssaoBufferSizes({ width: 955, height: 756 }, true)).toEqual({
      buffer: { width: 239, height: 189 },
      half: { width: 120, height: 95 },
    });
  });

  it('rounds a full-size frame up to a half, and its importance map to a quarter (:1110-1113)', () => {
    expect(ssaoBufferSizes({ width: 955, height: 756 }, false)).toEqual({
      buffer: { width: 478, height: 378 },
      half: { width: 239, height: 189 },
    });
  });
});

describe('ssaoDepthLevelSize', () => {
  it('rounds the frame up to a half at level 0 (ss_effects.cpp:510)', () => {
    expect(ssaoDepthLevelSize({ width: 957, height: 1 }, 0)).toEqual({ width: 479, height: 1 });
  });

  it('halves each level after, rounded down, so a level can be narrower than the gather', () => {
    expect(ssaoDepthLevelSize({ width: 957, height: 756 }, 1)).toEqual({ width: 239, height: 189 });
    expect(ssaoBufferSizes({ width: 957, height: 756 }, true).buffer.width).toBe(240);
  });

  it('keeps one texel past the last halving', () => {
    expect(ssaoDepthLevelSize({ width: 6, height: 2 }, 4)).toEqual({ width: 1, height: 1 });
  });
});

describe('ssaoDepthDownsample', () => {
  it('writes the half-size depth straight into mip 1 when SSAO and SSIL both run at half size (ss_effects.cpp:534-537)', () => {
    expect(ssaoDepthDownsample(project())).toEqual({
      mode: 'plain',
      isHalfSize: true,
      baseLevel: 1,
      mipLevels: 0,
      gatherLevel: 1,
    });
  });

  it('writes mip 0 and averages mips 1 to 3 when only SSAO runs at half size (:538-546)', () => {
    expect(ssaoDepthDownsample(project({ isSsilHalfSize: false }))).toEqual({
      mode: 'mips',
      isHalfSize: false,
      baseLevel: 0,
      mipLevels: 3,
      gatherLevel: 1,
    });
  });

  it('writes mips 1 to 4 when the sizes differ and either effect runs above Medium (:538-541)', () => {
    expect(ssaoDepthDownsample(project({ quality: SSAO_QUALITY.HIGH, isSsilHalfSize: false }))).toEqual({
      mode: 'fullMips',
      isHalfSize: false,
      baseLevel: 0,
      mipLevels: 4,
      gatherLevel: 1,
    });
  });

  it('writes mips above the base when either effect runs above Medium (:524-530)', () => {
    expect(ssaoDepthDownsample(project({ ssilQuality: SSAO_QUALITY.ULTRA }))).toEqual({
      mode: 'mips',
      isHalfSize: true,
      baseLevel: 1,
      mipLevels: 3,
      gatherLevel: 1,
    });
  });

  it('writes only two of the four slices when both effects run at Very Low (:526-528)', () => {
    const veryLow = project({ quality: SSAO_QUALITY.VERY_LOW, ssilQuality: SSAO_QUALITY.VERY_LOW });
    expect(ssaoDepthDownsample(veryLow).mode).toBe('halfBuffers');
  });

  it('gathers from mip 0 at full size (ss_effects.cpp:1212)', () => {
    expect(ssaoDepthDownsample(project({ isHalfSize: false, isSsilHalfSize: false })).gatherLevel).toBe(0);
  });
});

describe('the passes each quality draws', () => {
  it('gathers and blurs every slice above Very Low, and slices 0 and 3 at Very Low (ss_effects.cpp:1069)', () => {
    expect(ssaoGatheredSlices(SSAO_QUALITY.LOW)).toEqual([0, 1, 2, 3]);
    expect(ssaoGatheredSlices(SSAO_QUALITY.VERY_LOW)).toEqual([0, 3]);
  });

  it('blurs wide before the last two passes and smart in them, above Very Low (:1330-1338)', () => {
    expect(ssaoBlurModes(SSAO_QUALITY.MEDIUM, 4)).toEqual(['wide', 'wide', 'smart', 'smart']);
    expect(ssaoBlurModes(SSAO_QUALITY.MEDIUM, 2)).toEqual(['smart', 'smart']);
  });

  it('blurs once, plainly, at Very Low whatever the project asks (:1326)', () => {
    expect(ssaoBlurModes(SSAO_QUALITY.VERY_LOW, 4)).toEqual(['nonSmart']);
  });

  it('blurs not at all for zero passes above Very Low (edge case)', () => {
    expect(ssaoBlurModes(SSAO_QUALITY.HIGH, 0)).toEqual([]);
  });

  it('interleaves two slices at Very Low, four plainly at Low and four by their edges above (:1392-1397)', () => {
    expect(ssaoInterleaveMode(SSAO_QUALITY.VERY_LOW)).toBe('half');
    expect(ssaoInterleaveMode(SSAO_QUALITY.LOW)).toBe('nonSmart');
    expect(ssaoInterleaveMode(SSAO_QUALITY.MEDIUM)).toBe('smart');
    expect(ssaoInterleaveMode(SSAO_QUALITY.ULTRA)).toBe('smart');
  });

  it('interleaves the pong buffer after an odd count of blurs, and at Very Low (:1405-1411)', () => {
    expect(ssaoReadsBlurredFromPong(SSAO_QUALITY.MEDIUM, 2)).toBe(false);
    expect(ssaoReadsBlurredFromPong(SSAO_QUALITY.MEDIUM, 3)).toBe(true);
    expect(ssaoReadsBlurredFromPong(SSAO_QUALITY.VERY_LOW, 2)).toBe(true);
  });
});

describe('SSAO_ROTATION_MATRICES', () => {
  it("holds pass 0's first sub-pass unrotated, scaled by 1 - 1.9 * 0.07 (ss_effects.cpp:76-94)", () => {
    const [a, b, c, d] = SSAO_ROTATION_MATRICES.slice(0, 4);
    expect(a).toBeCloseTo(0.867, 6);
    expect(b).toBeCloseTo(0, 6);
    expect(c).toBeCloseTo(0, 6);
    expect(d).toBeCloseTo(-0.867, 6);
  });

  it('holds 20 matrices of four, a quarter turn per pass', () => {
    expect(SSAO_ROTATION_MATRICES).toHaveLength(80);
    // Pass 1, sub-pass 0: a quarter turn, scale 1 + (1 - 1.5 - 0.4) * 0.07.
    expect(SSAO_ROTATION_MATRICES[20]).toBeCloseTo(0, 6);
    expect(SSAO_ROTATION_MATRICES[21]).toBeCloseTo(-0.937, 6);
  });
});

describe('ssaoDepthLinearize', () => {
  it('maps a perspective depth to the view distance, near at 1 and far at 0', () => {
    // `ss_effects_downsample.glsl:65`: `z_near / (z_far - depth)`, Godot's depth reversed.
    const { z_near, z_far } = ssaoDepthLinearize(perspective(1, 1, 0.05, 4000));
    expect(z_near / (z_far - 1)).toBeCloseTo(0.05, 9);
    expect(z_near / (z_far - 0)).toBeCloseTo(4000, 6);
  });

  it("keeps an orthogonal projection's near and far planes (ss_effects.cpp:597-600)", () => {
    const orthogonal = [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, -2 / 99.9, 0, 0, 0, -100.1 / 99.9, 1];
    const linearize = ssaoDepthLinearize(orthogonal);
    expect(linearize.isOrthogonal).toBe(true);
    expect(linearize.z_near).toBeCloseTo(0.1, 9);
    expect(linearize.z_far).toBeCloseTo(100, 9);
  });
});

describe('ssaoGatherParameters', () => {
  const projection = perspective(1 / 0.88, 1 / 0.7, 0.05, 4000);
  const frame = { width: 955, height: 756 };

  it('fits the view rays to the field of view (ss_effects.cpp:1173-1178)', () => {
    const parameters = ssaoGatherParameters(ENVIRONMENT_DEFAULTS, project(), frame, projection);
    expect(parameters.NDC_to_view_mul[0]).toBeCloseTo(1.76, 6);
    expect(parameters.NDC_to_view_mul[1]).toBeCloseTo(-1.4, 6);
    expect(parameters.NDC_to_view_add[0]).toBeCloseTo(-0.88, 6);
    expect(parameters.NDC_to_view_add[1]).toBeCloseTo(0.7, 6);
  });

  it('steps a quarter-size texel at half size, and the gather quality one below the setting (:1165-1204)', () => {
    const parameters = ssaoGatherParameters(ENVIRONMENT_DEFAULTS, project(), frame, projection);
    expect(parameters.half_screen_pixel_size).toEqual([4 / 955, 4 / 756]);
    expect(parameters.half_screen_pixel_size_x025[0]).toBeCloseTo((4 / 955) * 0.75, 12);
    expect(parameters.quality).toBe(1);
    expect(parameters.size_multiplier).toBe(2);
  });

  it('fades out between the project distances and clamps the obscurance at 0.98 (:1193-1195)', () => {
    const parameters = ssaoGatherParameters(ENVIRONMENT_DEFAULTS, project(), frame, projection);
    expect(parameters.fade_out_mul).toBeCloseTo(-1 / 250, 12);
    expect(parameters.fade_out_add).toBeCloseTo(1.2, 12);
    expect(parameters.shadow_clamp).toBe(0.98);
  });

  it('widens the near limit at Low and shrinks the radius at Very Low (:1182-1190)', () => {
    const medium = ssaoGatherParameters(ENVIRONMENT_DEFAULTS, project(), frame, projection);
    const veryLow = ssaoGatherParameters(
      ENVIRONMENT_DEFAULTS,
      project({ quality: SSAO_QUALITY.VERY_LOW }),
      frame,
      projection
    );
    expect(medium.inv_radius_near_limit).toBeCloseTo(0.7 / 1.2, 9);
    expect(veryLow.inv_radius_near_limit).toBeCloseTo(0.7 / 1.8, 9);
    expect(veryLow.radius).toBeCloseTo(0.8, 6);
    expect(veryLow.neg_inv_radius).toBeCloseTo(-1.25, 6);
  });

  it("averages the importance map's every ninth texel over the importance map (:1200)", () => {
    const parameters = ssaoGatherParameters(ENVIRONMENT_DEFAULTS, project(), frame, projection);
    expect(parameters.load_counter_avg_div).toBeCloseTo(9 / (120 * 95 * 255), 15);
  });
});
