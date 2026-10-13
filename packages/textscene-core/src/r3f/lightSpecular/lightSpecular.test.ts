import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  LIGHT_SPECULARS,
  installLightSpecularUniforms,
  lightSpecularUserData,
  writeLightSpecularUniforms,
} from './lightSpecular';
import { sceneLights } from '../directionalShadow/lightLists';
import { SplitSunLight } from '../directionalShadow/splitSun';
import { litUniformArray } from '../testing/litUniformArray';

function declared<Light extends THREE.Light>(light: Light, amount: number): Light {
  light.userData = lightSpecularUserData(amount);
  return light;
}

/** The first `count` amounts the lit materials read after a render of `scene`. */
function amountsAfterRender(scene: THREE.Scene, count: number): number[] {
  writeLightSpecularUniforms(sceneLights(scene), new THREE.PerspectiveCamera());
  installLightSpecularUniforms();
  return [...litUniformArray(LIGHT_SPECULARS).subarray(0, count)];
}

describe('writeLightSpecularUniforms', () => {
  it('writes directional, then sun, then point, then spot amounts', () => {
    const scene = new THREE.Scene();
    const shadowed = declared(new THREE.DirectionalLight(), 0.75);
    shadowed.add(new SplitSunLight());
    scene.add(
      declared(new THREE.SpotLight(), 4),
      declared(new THREE.PointLight(), 3),
      declared(new THREE.DirectionalLight(), 1.5),
      shadowed
    );

    expect(amountsAfterRender(scene, 5)).toEqual([1.5, 0.75, 0.75, 3, 4]);
  });

  it("puts a shadowed light first among its kind, as three's sort does", () => {
    const scene = new THREE.Scene();
    const shadowed = declared(new THREE.PointLight(), 2);
    shadowed.castShadow = true;
    scene.add(declared(new THREE.PointLight(), 1), shadowed);

    expect(amountsAfterRender(scene, 2)).toEqual([2, 1]);
  });

  it('gives a hidden light no slot (edge case)', () => {
    const scene = new THREE.Scene();
    const hidden = declared(new THREE.PointLight(), 5);
    hidden.visible = false;
    scene.add(hidden, declared(new THREE.PointLight(), 0.5));

    expect(amountsAfterRender(scene, 1)).toEqual([0.5]);
  });

  it('gives a light without a declaration, such as a GLB light, the full specular (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.PointLight());

    expect(amountsAfterRender(scene, 1)).toEqual([1]);
  });
});
