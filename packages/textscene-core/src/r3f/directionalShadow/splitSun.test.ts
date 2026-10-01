import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SplitSunLight, attachSplitSun, followDeclaredLight, releaseSplitSun, splitSunOf } from './splitSun';

describe('SplitSunLight', () => {
  it('stands on three’s sun path', () => {
    const sun = new SplitSunLight();
    expect(sun.isSunLight).toBe(true);
    expect(sun.type).toBe('SunLight');
    expect(sun.castShadow).toBe(true);
  });

  it('keeps the world matrix the fitter wrote through a scene update (edge case)', () => {
    const parent = new THREE.Group();
    parent.position.set(4, 5, 6);
    const sun = new SplitSunLight();
    parent.add(sun);
    sun.matrixWorld.makeTranslation(1, 2, 3);
    parent.updateMatrixWorld(true);
    expect(new THREE.Vector3().setFromMatrixPosition(sun.matrixWorld).toArray()).toEqual([1, 2, 3]);
  });
});

describe('attachSplitSun', () => {
  it('hangs one sun under the light and hides the light from every camera', () => {
    const light = new THREE.DirectionalLight();
    const sun = attachSplitSun(light);
    expect(sun.parent).toBe(light);
    expect(light.layers.test(new THREE.Camera().layers)).toBe(false);
    expect(sun.layers.test(new THREE.Camera().layers)).toBe(true);
  });

  it('answers the sun it already attached', () => {
    const light = new THREE.DirectionalLight();
    expect(attachSplitSun(light)).toBe(attachSplitSun(light));
    expect(light.children).toHaveLength(1);
  });

  it('frees the shadow map the light drew before its sun took over', () => {
    const light = new THREE.DirectionalLight();
    const ownMap = new THREE.WebGLRenderTarget(4, 4);
    const freed = vi.fn();
    ownMap.addEventListener('dispose', freed);
    light.shadow.map = ownMap;
    attachSplitSun(light);
    expect(freed).toHaveBeenCalledTimes(1);
    expect(light.shadow.map).toBeNull();
  });

  it('keeps a light’s own layers on its sun (edge case)', () => {
    const light = new THREE.DirectionalLight();
    light.layers.set(5);
    expect(attachSplitSun(light).layers.mask).toBe(1 << 5);
  });
});

describe('releaseSplitSun', () => {
  it('removes the sun and restores the light’s layers', () => {
    const light = new THREE.DirectionalLight();
    light.layers.set(2);
    attachSplitSun(light);
    releaseSplitSun(light);
    expect(splitSunOf(light)).toBeNull();
    expect(light.layers.mask).toBe(1 << 2);
  });

  it('runs when the light leaves its parent', () => {
    const parent = new THREE.Group();
    const light = new THREE.DirectionalLight();
    parent.add(light);
    attachSplitSun(light);
    parent.remove(light);
    expect(splitSunOf(light)).toBeNull();
    expect(light.layers.isEnabled(0)).toBe(true);
  });

  it('leaves a light without a sun as it is (edge case)', () => {
    const light = new THREE.DirectionalLight();
    light.layers.set(3);
    releaseSplitSun(light);
    expect(light.layers.mask).toBe(1 << 3);
  });
});

describe('splitSunOf', () => {
  it('answers null for a light whose only child is something else (error case)', () => {
    const light = new THREE.DirectionalLight();
    light.add(new THREE.Object3D());
    expect(splitSunOf(light)).toBeNull();
  });
});

describe('followDeclaredLight', () => {
  function followed(light: THREE.DirectionalLight): SplitSunLight {
    const sun = new SplitSunLight();
    followDeclaredLight(sun, light, new THREE.Vector3(1, 7, 2), new THREE.Vector3(1, 3, 2));
    return sun;
  }

  it('shades with the declared light’s colour, intensity and shadow strength', () => {
    const light = new THREE.DirectionalLight(0x3366ff, 2.5);
    light.shadow.intensity = 0.4;
    light.shadow.radius = 3;
    const sun = followed(light);
    expect(sun.color.getHex()).toBe(0x3366ff);
    expect(sun.intensity).toBe(2.5);
    expect(sun.shadow.intensity).toBe(0.4);
    expect(sun.shadow.radius).toBe(3);
  });

  it('stands at the direction from the target towards the light', () => {
    const sun = followed(new THREE.DirectionalLight());
    expect(new THREE.Vector3().setFromMatrixPosition(sun.matrixWorld).toArray()).toEqual([0, 4, 0]);
  });

  it('stands at the origin for a light on its own target (error case)', () => {
    const sun = new SplitSunLight();
    const point = new THREE.Vector3(2, 2, 2);
    followDeclaredLight(sun, new THREE.DirectionalLight(), point, point);
    expect(new THREE.Vector3().setFromMatrixPosition(sun.matrixWorld).toArray()).toEqual([0, 0, 0]);
  });
});
