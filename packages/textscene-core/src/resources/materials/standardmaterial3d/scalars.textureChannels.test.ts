/**
 * StandardMaterial3D `roughness_texture_channel` and `metallic_texture_channel`, the map channels
 * the shader reads. The render side applies both (`godotMetallicRoughnessChannels.ts`).
 */

import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

describe.each([
  ['roughness_texture_channel', 'roughnessTextureChannelMask'],
  ['metallic_texture_channel', 'metallicTextureChannelMask'],
] as const)('parseStandardMaterial3DScalars: %s', (property, field) => {
  it('reads the red channel by default', () => {
    // `material.cpp:3985-3986`.
    expect(parseStandardMaterial3DScalars({})[field]).toEqual([1, 0, 0, 0]);
  });

  it('reads the mask of an authored channel', () => {
    expect(parseStandardMaterial3DScalars({ [property]: '4' })[field]).toEqual([
      0.3333333, 0.3333333, 0.3333333, 0,
    ]);
  });

  it('keeps the red channel for a channel the setter refuses (edge case)', () => {
    // `ERR_FAIL_INDEX(p_channel, 5)` at `material.cpp:2964` and `:2974`.
    expect(parseStandardMaterial3DScalars({ [property]: '5' })[field]).toEqual([1, 0, 0, 0]);
  });
});
