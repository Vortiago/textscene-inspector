import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { freeShadowMap } from './shadowMapAllocation';

function shadowWithMap(): { shadow: THREE.LightShadow; map: THREE.WebGLRenderTarget } {
  const shadow = new THREE.DirectionalLight().shadow;
  const map = new THREE.WebGLRenderTarget(1, 1);
  shadow.map = map;
  return { shadow, map };
}

describe('freeShadowMap', () => {
  it('disposes the texture and clears it, so three builds a new one', () => {
    const { shadow, map } = shadowWithMap();
    const dispose = vi.spyOn(map, 'dispose');
    freeShadowMap(shadow);
    expect(dispose).toHaveBeenCalledOnce();
    expect(shadow.map).toBeNull();
    expect(shadow.mapPass).toBeNull();
  });

  it('frees a shadow that has no texture yet (edge case)', () => {
    const shadow = new THREE.DirectionalLight().shadow;
    expect(() => freeShadowMap(shadow)).not.toThrow();
    expect(shadow.map).toBeNull();
  });
});
