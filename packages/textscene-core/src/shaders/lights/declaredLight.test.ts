import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { declaredLightOf } from './declaredLight.js';

/** A light that shades for its parent, as the renderer's split sun does. */
class StandIn extends THREE.Light {
  get declaredLight(): THREE.Object3D | null {
    return this.parent;
  }
}

describe('declaredLightOf', () => {
  it('answers a light that stands in for none with the light', () => {
    const light = new THREE.DirectionalLight();

    expect(declaredLightOf(light)).toBe(light);
  });

  it('answers a stand-in with the light it shades for', () => {
    const light = new THREE.DirectionalLight();
    const standIn = new StandIn();
    light.add(standIn);

    expect(declaredLightOf(standIn)).toBe(light);
  });

  it('answers a stand-in off its light with nothing', () => {
    expect(declaredLightOf(new StandIn())).toBeNull();
  });
});
