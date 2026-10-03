import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { dropLight, isDropped, restoreDroppedLight } from './droppedLight';
import { attachSplitSun, splitSunOf } from './splitSun';

function castingLightOnLayer(layer: number): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.castShadow = true;
  light.layers.set(layer);
  return light;
}

describe('dropLight', () => {
  it('takes the light off every layer and marks it dropped', () => {
    const light = castingLightOnLayer(3);
    dropLight(light);
    expect(light.layers.mask).toBe(0);
    expect(isDropped(light)).toBe(true);
  });

  it('leaves `castShadow` and `visible` to their owner', () => {
    const light = castingLightOnLayer(0);
    dropLight(light);
    expect(light.castShadow).toBe(true);
    expect(light.visible).toBe(true);
  });

  it('releases the light’s split sun and frees its map', () => {
    const light = castingLightOnLayer(0);
    attachSplitSun(light);
    light.shadow.map = new THREE.WebGLRenderTarget(4, 4);
    dropLight(light);
    expect(splitSunOf(light)).toBeNull();
    expect(light.shadow.map).toBeNull();
  });

  it('keeps the light’s own mask through a second drop (edge case)', () => {
    const light = castingLightOnLayer(3);
    dropLight(light);
    dropLight(light);
    restoreDroppedLight(light);
    expect(light.layers.mask).toBe(1 << 3);
  });

  it('keeps the mask a split sun held for the light (edge case)', () => {
    const light = castingLightOnLayer(3);
    attachSplitSun(light);
    dropLight(light);
    restoreDroppedLight(light);
    expect(light.layers.mask).toBe(1 << 3);
  });
});

describe('restoreDroppedLight', () => {
  it('hands a dropped light its own layers back', () => {
    const light = castingLightOnLayer(3);
    dropLight(light);
    restoreDroppedLight(light);
    expect(light.layers.mask).toBe(1 << 3);
    expect(isDropped(light)).toBe(false);
  });

  it('restores a dropped light that leaves its parent (edge case)', () => {
    const parent = new THREE.Group();
    const light = castingLightOnLayer(3);
    parent.add(light);
    dropLight(light);
    parent.remove(light);
    expect(isDropped(light)).toBe(false);
    expect(light.layers.mask).toBe(1 << 3);
  });

  it('leaves a light it never dropped as it is (error case)', () => {
    const light = castingLightOnLayer(3);
    light.layers.disableAll();
    restoreDroppedLight(light);
    expect(light.layers.mask).toBe(0);
    expect(isDropped(light)).toBe(false);
  });
});

describe('isDropped', () => {
  it('answers false for a light never dropped', () => {
    expect(isDropped(new THREE.DirectionalLight())).toBe(false);
  });
});
