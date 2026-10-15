import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ltcTables } from '../../godot/rendering/lights/ltc';
import { installLtcTextures } from './ltcTextures';

function installed(name: 'LTC_FLOAT_1' | 'LTC_FLOAT_2' | 'LTC_HALF_1' | 'LTC_HALF_2'): THREE.DataTexture {
  return (THREE.UniformsLib as unknown as Record<string, THREE.DataTexture>)[name]!;
}

describe('installLtcTextures', () => {
  it("puts Godot's tables in three's float textures", () => {
    installLtcTextures();
    const { lut1, lut2 } = ltcTables();
    expect(installed('LTC_FLOAT_1').image.data).toEqual(lut1);
    expect(installed('LTC_FLOAT_2').image.data).toEqual(lut2);
  });

  it('gives the half-float pair the same texels at half precision', () => {
    installLtcTextures();
    const half = installed('LTC_HALF_2');
    expect(half.type).toBe(THREE.HalfFloatType);
    expect(THREE.DataUtils.fromHalfFloat((half.image.data as Uint16Array)[0]!)).toBe(ltcTables().lut2[0]);
  });

  it('samples linearly and clamped, with no mipmaps', () => {
    installLtcTextures();
    const texture = installed('LTC_FLOAT_1');
    expect([texture.magFilter, texture.minFilter, texture.wrapS, texture.wrapT]).toEqual([
      THREE.LinearFilter,
      THREE.LinearFilter,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
    ]);
  });

  it('puts back the same textures on a second call', () => {
    installLtcTextures();
    const first = installed('LTC_FLOAT_1');
    installLtcTextures();
    expect(installed('LTC_FLOAT_1')).toBe(first);
  });
});
