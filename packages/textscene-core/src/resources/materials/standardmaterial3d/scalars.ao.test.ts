/**
 * StandardMaterial3D `ao_light_affect`, how far the AO map also occludes direct light, and
 * `ao_texture_channel`, the map channel it reads. The render side applies both
 * (`godotAmbientOcclusion.ts`).
 */

import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

describe('parseStandardMaterial3DScalars: ao_light_affect', () => {
  it('defaults to 0, where the map occludes indirect light only', () => {
    // `material.h:565`, reset at `material.cpp:3983`.
    expect(parseStandardMaterial3DScalars({ ao_enabled: 'true' }).aoLightAffect).toBe(0);
  });

  it('reads an authored value', () => {
    expect(parseStandardMaterial3DScalars({ ao_light_affect: '0.5' }).aoLightAffect).toBe(0.5);
  });

  it('keeps a value outside 0 to 1, which the setter stores unclamped', () => {
    // `material.cpp:2247-2250`: the hint is "0,1,0.01", but the setter clamps nothing.
    expect(parseStandardMaterial3DScalars({ ao_light_affect: '1.5' }).aoLightAffect).toBe(1.5);
  });

  it('falls back to 0 for a malformed value', () => {
    expect(parseStandardMaterial3DScalars({ ao_light_affect: 'nope' }).aoLightAffect).toBe(0);
  });
});

describe('parseStandardMaterial3DScalars: ao_texture_channel', () => {
  it('reads the red channel by default', () => {
    // `material.cpp:3987`.
    expect(parseStandardMaterial3DScalars({}).aoTextureChannelMask).toEqual([1, 0, 0, 0]);
  });

  it('reads the mask of an authored channel', () => {
    expect(parseStandardMaterial3DScalars({ ao_texture_channel: '3' }).aoTextureChannelMask).toEqual([
      0, 0, 0, 1,
    ]);
  });

  it('keeps the red channel for a channel the setter refuses', () => {
    // `ERR_FAIL_INDEX(p_channel, 5)` at `material.cpp:2984`.
    expect(parseStandardMaterial3DScalars({ ao_texture_channel: '5' }).aoTextureChannelMask).toEqual([
      1, 0, 0, 0,
    ]);
  });
});
