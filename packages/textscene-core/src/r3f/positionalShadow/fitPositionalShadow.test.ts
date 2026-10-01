import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { fitPositionalShadow, resizeShadowMap } from './fitPositionalShadow';

/** Not a size any slot gives, so a test sees whether the fit wrote one. */
const UNFITTED_SIZE = 64;

const declaration = { normalBias: 1, softShadowScale: 2 };

function unfitted<T extends THREE.PointLight | THREE.SpotLight>(light: T): T {
  light.shadow.mapSize.set(UNFITTED_SIZE, UNFITTED_SIZE);
  return light;
}

describe('fitPositionalShadow', () => {
  it('gives an omni light in the largest slot half the slot per cube face', () => {
    const light = unfitted(new THREE.PointLight());
    fitPositionalShadow(light, 1024, declaration);
    expect(light.shadow.mapSize.toArray()).toEqual([512, 512]);
    // Godot's kernel of 2 * 2 / 1022 radians, in texels of a 512 face.
    expect(light.shadow.radius).toBeCloseTo((4 / 1022) * 512, 12);
    expect(light.shadow.normalBias).toBeCloseTo(10 / 1024, 12);
    expect(light.shadow.intensity).toBe(1);
  });

  it('gives a spot light the slot, with a kernel of soft_shadow_scale texels', () => {
    const light = unfitted(new THREE.SpotLight());
    fitPositionalShadow(light, 512, declaration);
    expect(light.shadow.mapSize.toArray()).toEqual([512, 512]);
    expect(light.shadow.radius).toBe(2);
    expect(light.shadow.normalBias).toBeCloseTo(10 / 512, 12);
  });

  it('widens an omni kernel in a smaller slot (edge case)', () => {
    const light = unfitted(new THREE.PointLight());
    fitPositionalShadow(light, 256, declaration);
    expect(light.shadow.mapSize.toArray()).toEqual([128, 128]);
    expect(light.shadow.radius).toBeCloseTo((4 / 254) * 128, 12);
  });

  it('draws no shadow for a light without a slot, and leaves its map as it is (error case)', () => {
    const light = unfitted(new THREE.SpotLight());
    fitPositionalShadow(light, null, declaration);
    expect(light.shadow.intensity).toBe(0);
    expect(light.shadow.mapSize.toArray()).toEqual([UNFITTED_SIZE, UNFITTED_SIZE]);
  });

  it('draws the shadow again once the light holds a slot (edge case)', () => {
    const light = unfitted(new THREE.SpotLight());
    fitPositionalShadow(light, null, declaration);
    fitPositionalShadow(light, 1024, declaration);
    expect(light.shadow.intensity).toBe(1);
  });
});

describe('resizeShadowMap', () => {
  it('drops a map of another size, so three allocates one at the new size', () => {
    const shadow = new THREE.PointLight().shadow;
    const map = new THREE.WebGLCubeRenderTarget(512);
    const dispose = vi.spyOn(map, 'dispose');
    shadow.map = map;
    resizeShadowMap(shadow, 256);
    expect(shadow.mapSize.toArray()).toEqual([256, 256]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(shadow.map).toBeNull();
  });

  it('keeps a map of the size, even when `mapSize` still names another (edge case)', () => {
    const shadow = new THREE.SpotLight().shadow;
    const map = new THREE.WebGLRenderTarget(512, 512);
    shadow.map = map;
    shadow.mapSize.set(1024, 1024);
    resizeShadowMap(shadow, 512);
    expect(shadow.map).toBe(map);
    expect(shadow.mapSize.toArray()).toEqual([512, 512]);
  });

  it('sets the size on a shadow that has no map yet (error case)', () => {
    const shadow = new THREE.SpotLight().shadow;
    resizeShadowMap(shadow, 1024);
    expect(shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(shadow.map).toBeNull();
  });
});
