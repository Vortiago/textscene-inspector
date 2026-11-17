import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { withTexture } from './shaderSkyTextures';

describe('withTexture', () => {
  it('adds a texture that arrives', () => {
    const texture = new THREE.Texture();
    expect(withTexture({}, 'stars', texture)).toEqual({ stars: texture });
  });

  it('removes a texture that leaves', () => {
    expect(withTexture({ stars: new THREE.Texture() }, 'stars', null)).toEqual({});
  });

  it('keeps the same map when nothing changes, so no bake runs again', () => {
    const current = { stars: new THREE.Texture() };
    expect(withTexture(current, 'stars', current.stars)).toBe(current);
  });
});
