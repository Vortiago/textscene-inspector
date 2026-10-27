/**
 * The luminance reduction against Godot 4.6.3's `luminance_reduce.glsl` and `luminance.cpp`: 8x8
 * blocks of the largest channel, averaged level by level to one value, held between the bounds. A
 * still frame has settled, so the clamp of the last level is the whole adaptation
 * (`luminance_reduce.glsl:78`). Assertions read that structure, never a GLSL snapshot.
 */

import { describe, expect, it } from 'vitest';
import {
  AUTO_EXPOSURE_GAIN_GLSL,
  AUTO_EXPOSURE_SCALE_UNIFORM,
  AUTO_EXPOSURE_UNIFORMS_GLSL,
  LUMINANCE_MAX_UNIFORM,
  LUMINANCE_MIN_UNIFORM,
  LUMINANCE_UNIFORM,
  luminanceChainSizes,
  luminanceReduceGlsl,
} from './godotLuminance';

describe('luminanceChainSizes', () => {
  it('shrinks the frame by 8 per level to one texel, as LuminanceBuffers::configure does', () => {
    expect(luminanceChainSizes(1152, 648)).toEqual([
      { width: 144, height: 81 },
      { width: 18, height: 10 },
      { width: 2, height: 1 },
      { width: 1, height: 1 },
    ]);
  });

  it('keeps one texel at least in an axis that has shrunk to it, while the other still shrinks', () => {
    expect(luminanceChainSizes(512, 4)).toEqual([
      { width: 64, height: 1 },
      { width: 8, height: 1 },
      { width: 1, height: 1 },
    ]);
  });

  it('needs one level for a frame of 8 texels a side or fewer, and for a frame of one (edge case)', () => {
    expect(luminanceChainSizes(8, 8)).toEqual([{ width: 1, height: 1 }]);
    expect(luminanceChainSizes(1, 1)).toEqual([{ width: 1, height: 1 }]);
  });

  it('floors the size of each level, which drops the texels a partial block would add (edge case)', () => {
    expect(luminanceChainSizes(15, 9)).toEqual([{ width: 1, height: 1 }]);
    expect(luminanceChainSizes(65, 65)).toEqual([
      { width: 8, height: 8 },
      { width: 1, height: 1 },
    ]);
  });
});

describe('luminanceReduceGlsl — the level that reads the frame', () => {
  const glsl = luminanceReduceGlsl({ readsFrame: true, clamps: false });

  it('takes the largest channel of each texel, as READ_TEXTURE does (luminance_reduce.glsl:47)', () => {
    expect(glsl).toContain('max(texel.r, max(texel.g, texel.b))');
  });

  it('averages the texels of the block the frame holds, not the 64 of a whole one (luminance_reduce.glsl:72-73)', () => {
    expect(glsl).toContain('min(sourceSize - origin');
    expect(glsl).toContain('sum / float(extent.x * extent.y)');
  });

  it('reads the frame from its top row, as Godot does: the region it reaches is the top left, not the WebGL origin', () => {
    expect(glsl).toContain('ivec2(position.x, sourceSize.y - 1 - position.y)');
  });

  it('does not hold the average between bounds while a level remains', () => {
    expect(glsl).not.toContain(LUMINANCE_MIN_UNIFORM);
    expect(glsl).not.toContain(LUMINANCE_MAX_UNIFORM);
  });
});

describe('luminanceReduceGlsl — the levels that read a level', () => {
  const glsl = luminanceReduceGlsl({ readsFrame: false, clamps: false });

  it('reads the red channel only, which holds the average of the level before', () => {
    expect(glsl).toContain('sum += texel.r;');
    expect(glsl).not.toContain('max(texel.r');
  });

  it('reads a level as it is stored: the first level already put its rows in Godot order', () => {
    expect(glsl).not.toContain('sourceSize.y - 1');
  });
});

describe('luminanceReduceGlsl — the last level', () => {
  const glsl = luminanceReduceGlsl({ readsFrame: false, clamps: true });

  it('holds the average between the bounds, the maximum applied last as the GPU clamp resolves it', () => {
    expect(glsl).toContain(`min(max(average, ${LUMINANCE_MIN_UNIFORM}), ${LUMINANCE_MAX_UNIFORM})`);
  });

  it('declares the bounds as uniforms, which stay finite or not as the scene wrote them', () => {
    expect(glsl).toContain(`uniform float ${LUMINANCE_MIN_UNIFORM};`);
    expect(glsl).toContain(`uniform float ${LUMINANCE_MAX_UNIFORM};`);
  });

  it('clamps after averaging, not before (luminance_reduce.glsl:73-78)', () => {
    expect(glsl.indexOf('sum / float(')).toBeLessThan(glsl.indexOf('min(max(average'));
  });

  it('clamps a frame that is one level as well, reading the frame', () => {
    const single = luminanceReduceGlsl({ readsFrame: true, clamps: true });
    expect(single).toContain('max(texel.r, max(texel.g, texel.b))');
    expect(single).toContain('min(max(average');
  });
});

describe('AUTO_EXPOSURE_GAIN_GLSL — the factor the exposure takes', () => {
  it('declares the luminance sampler and the scale for a pass that lists no uniforms of its own', () => {
    expect(AUTO_EXPOSURE_UNIFORMS_GLSL).toContain(`uniform sampler2D ${LUMINANCE_UNIFORM};`);
    expect(AUTO_EXPOSURE_UNIFORMS_GLSL).toContain(`uniform float ${AUTO_EXPOSURE_SCALE_UNIFORM};`);
  });

  it('divides the scale by the luminance texel, as tonemap.glsl:871-873 and copy.glsl:193 do', () => {
    expect(AUTO_EXPOSURE_GAIN_GLSL).toContain(`texelFetch(${LUMINANCE_UNIFORM}, ivec2(0), 0).r`);
    expect(AUTO_EXPOSURE_GAIN_GLSL).toContain(`${AUTO_EXPOSURE_SCALE_UNIFORM} / luminance`);
  });

  it('floors the luminance, so a gain times an exposure above 1 stays finite and black stays black (edge case)', () => {
    expect(AUTO_EXPOSURE_GAIN_GLSL).toMatch(/max\(texelFetch\(.*\)\.r, 1\.0e-20\)/);
  });
});
