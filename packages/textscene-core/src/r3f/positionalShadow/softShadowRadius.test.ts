import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { searchesPositionalBlockers, softShadowRadius } from './softShadowRadius';
import { positionalShadowUserData } from './declaration';
import type { SceneLight } from '../directionalShadow/lightLists';

describe('softShadowRadius', () => {
  it('is minus the penumbra spread for a light that searches for blockers', () => {
    expect(softShadowRadius({ size: 0.5, scale: 1.5 })).toBe(-0.75);
  });

  it('is the PCF kernel radius for a light without a penumbra (edge case)', () => {
    expect(softShadowRadius({ size: 0, scale: 2 })).toBe(2);
  });

  it('is zero for a light without a blur, which filters nothing (edge case)', () => {
    expect(softShadowRadius({ size: 0, scale: 0 })).toBe(0);
  });
});

/** A light that declares a shadow of soft shadow radius `radius`, casting or not. */
function declared<Light extends THREE.Light>(light: Light, radius: number, castShadow = true): SceneLight {
  light.castShadow = castShadow;
  light.userData = positionalShadowUserData({ normalBias: 1, softShadowRadius: radius });
  return { light, isVisible: true };
}

describe('searchesPositionalBlockers', () => {
  it('is true once one casting omni, spot or area light searches for blockers', () => {
    for (const light of [new THREE.PointLight(), new THREE.SpotLight(), new THREE.RectAreaLight()])
      expect(searchesPositionalBlockers([declared(new THREE.PointLight(), 1), declared(light, -0.5)])).toBe(
        true
      );
  });

  it('counts a hidden light, so hiding one compiles no material again (edge case)', () => {
    expect(searchesPositionalBlockers([{ ...declared(new THREE.SpotLight(), -0.5), isVisible: false }])).toBe(
      true
    );
  });

  it('is false for lights that filter with PCF, or cast nothing (edge case)', () => {
    const lights = [declared(new THREE.PointLight(), 1), declared(new THREE.SpotLight(), -0.5, false)];
    expect(searchesPositionalBlockers(lights)).toBe(false);
  });

  it('is false for a light without a declaration, such as a GLB light (error case)', () => {
    const light = new THREE.SpotLight();
    light.castShadow = true;
    expect(searchesPositionalBlockers([{ light, isVisible: true }])).toBe(false);
  });
});
