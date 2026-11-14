import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShadowMapTexture, shadowMapUniforms, writeShadowMap } from './shadowMapTexture';

describe('createShadowMapTexture', () => {
  it('repeats a polar map on u, so a tap past either end reads the bin across the seam', () => {
    expect(createShadowMapTexture(8, 'repeat').wrapS).toBe(THREE.RepeatWrapping);
  });

  it('clamps a directional map on u', () => {
    expect(createShadowMapTexture(8, 'clamp').wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('stores one float32 red texel per bin, read nearest', () => {
    const texture = createShadowMapTexture(8, 'clamp');
    expect(texture).toMatchObject({
      type: THREE.FloatType,
      format: THREE.RedFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      colorSpace: THREE.NoColorSpace,
      generateMipmaps: false,
    });
    expect(texture.image).toMatchObject({ width: 8, height: 1 });
    expect(texture.image.data).toBeInstanceOf(Float32Array);
  });
});

describe('writeShadowMap', () => {
  it('uploads the bins', () => {
    const texture = createShadowMapTexture(4, 'repeat');
    const version = texture.version;
    writeShadowMap(texture, new Float32Array([0.1, 0.2, 0.3, 0.4]));
    expect(Array.from(texture.image.data as Float32Array)).toEqual(
      Array.from(new Float32Array([0.1, 0.2, 0.3, 0.4]))
    );
    expect(texture.version).toBeGreaterThan(version);
  });

  it('names the expected and the found length on a mismatch', () => {
    const texture = createShadowMapTexture(4, 'clamp');
    expect(() => writeShadowMap(texture, new Float32Array(3))).toThrow(
      new RangeError('expected a shadow map of 4 bins, got 3')
    );
  });
});

describe('shadowMapUniforms', () => {
  it('holds the map and its width', () => {
    const map = createShadowMapTexture(512, 'clamp');
    const uniforms = shadowMapUniforms(map);
    expect(uniforms.uShadowMap.value).toBe(map);
    expect(uniforms.uShadowBins.value).toBe(512);
  });

  it('names the expected map when the texture has no image', () => {
    expect(() => shadowMapUniforms(new THREE.Texture())).toThrow('expected a shadow map with an image');
  });
});
