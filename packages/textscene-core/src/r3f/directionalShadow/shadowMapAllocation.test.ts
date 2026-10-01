import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { freeShadowMap, sizeShadowMap } from './shadowMapAllocation';

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

describe('sizeShadowMap', () => {
  it('sets a new size and frees the texture of the old one', () => {
    const { shadow } = shadowWithMap();
    sizeShadowMap(shadow, 2048, 4096);
    expect(shadow.mapSize.toArray()).toEqual([2048, 4096]);
    expect(shadow.map).toBeNull();
  });

  it('keeps the texture when the size has not changed', () => {
    const { shadow } = shadowWithMap();
    sizeShadowMap(shadow, 2048, 4096);
    const rebuilt = new THREE.WebGLRenderTarget(2048, 4096);
    shadow.map = rebuilt;
    sizeShadowMap(shadow, 2048, 4096);
    expect(shadow.map).toBe(rebuilt);
  });

  it('keeps the texture when three shrank mapSize to the device limit (edge case)', () => {
    const { shadow } = shadowWithMap();
    sizeShadowMap(shadow, 4096, 4096);
    shadow.mapSize.set(2048, 2048);
    const clamped = new THREE.WebGLRenderTarget(2048, 2048);
    shadow.map = clamped;
    sizeShadowMap(shadow, 4096, 4096);
    expect(shadow.map).toBe(clamped);
  });

  it('frees the texture on the first request, whatever mapSize holds (error case)', () => {
    const { shadow } = shadowWithMap();
    shadow.mapSize.set(4096, 4096);
    sizeShadowMap(shadow, 4096, 4096);
    expect(shadow.map).toBeNull();
  });
});
