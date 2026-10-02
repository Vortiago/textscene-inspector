import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { hideLight, ownLayerMask, showLight } from './hiddenLight';

function lightOnLayer(layer: number): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.layers.set(layer);
  return light;
}

describe('hideLight', () => {
  it('takes the light off every layer', () => {
    const light = lightOnLayer(3);
    hideLight(light);
    expect(light.layers.mask).toBe(0);
  });

  it('frees the shadow map the light drew before', () => {
    const light = lightOnLayer(0);
    const map = new THREE.WebGLRenderTarget(4, 4);
    const freed = vi.fn();
    map.addEventListener('dispose', freed);
    light.shadow.map = map;
    hideLight(light);
    expect(freed).toHaveBeenCalledTimes(1);
    expect(light.shadow.map).toBeNull();
  });

  it('keeps the first mask through a second call (edge case)', () => {
    const light = lightOnLayer(3);
    hideLight(light);
    hideLight(light);
    showLight(light);
    expect(light.layers.mask).toBe(1 << 3);
  });
});

describe('showLight', () => {
  it('hands a hidden light its own layers back', () => {
    const light = lightOnLayer(4);
    hideLight(light);
    showLight(light);
    expect(light.layers.mask).toBe(1 << 4);
  });

  it('shows a light once, so a second call keeps later layers (edge case)', () => {
    const light = lightOnLayer(4);
    hideLight(light);
    showLight(light);
    light.layers.set(6);
    showLight(light);
    expect(light.layers.mask).toBe(1 << 6);
  });

  it('leaves a light it never hid as it is (error case)', () => {
    const light = lightOnLayer(3);
    light.layers.disableAll();
    showLight(light);
    expect(light.layers.mask).toBe(0);
  });
});

describe('ownLayerMask', () => {
  it('answers the saved mask of a hidden light', () => {
    const light = lightOnLayer(5);
    hideLight(light);
    expect(ownLayerMask(light)).toBe(1 << 5);
  });

  it('answers the current mask of a light never hidden (edge case)', () => {
    expect(ownLayerMask(lightOnLayer(2))).toBe(1 << 2);
  });
});
