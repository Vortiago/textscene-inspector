import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  LIGHT_SIZES,
  installLightSizeUniforms,
  lightSizeUserData,
  writeLightSizeUniforms,
} from './lightSize';
import { sceneLights } from '../directionalShadow/lightLists';
import { attachSplitSun } from '../directionalShadow/splitSun';
import { litUniformArray } from '../testing/litUniformArray';

function declared<Light extends THREE.Light>(light: Light, size: number): Light {
  light.userData = lightSizeUserData(size);
  return light;
}

/** The first `count` sizes the lit materials read after a render of `scene`. */
function sizesAfterRender(scene: THREE.Scene, count: number, drawsDirectionalSoftShadows = false): number[] {
  writeLightSizeUniforms(sceneLights(scene), new THREE.PerspectiveCamera(), drawsDirectionalSoftShadows);
  installLightSizeUniforms();
  return [...litUniformArray(LIGHT_SIZES).subarray(0, count)];
}

describe('writeLightSizeUniforms', () => {
  it("writes each omni and spot light's size in its slot", () => {
    const scene = new THREE.Scene();
    scene.add(declared(new THREE.SpotLight(), 0.25), declared(new THREE.PointLight(), 0.5));
    expect(sizesAfterRender(scene, 2)).toEqual([0.5, 0.25]);
  });

  it("writes a directional light's size while Godot's directional soft shadows are on", () => {
    const scene = new THREE.Scene();
    scene.add(declared(new THREE.DirectionalLight(), 0.02), declared(new THREE.PointLight(), 0.5));
    expect(sizesAfterRender(scene, 2, true)).toEqual([Math.fround(0.02), 0.5]);
  });

  it("writes a split sun's size from the light it shades for", () => {
    const scene = new THREE.Scene();
    const light = declared(new THREE.DirectionalLight(), 0.02);
    attachSplitSun(light);
    scene.add(light);
    expect(sizesAfterRender(scene, 1, true)).toEqual([Math.fround(0.02)]);
  });

  it("gives a directional light no size while Godot's directional soft shadows are off (edge case)", () => {
    const scene = new THREE.Scene();
    scene.add(declared(new THREE.DirectionalLight(), 0.02), declared(new THREE.PointLight(), 0.5));
    expect(sizesAfterRender(scene, 2)).toEqual([0, 0.5]);
  });

  it('gives a light without a declaration, such as a GLB light, no size (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.PointLight());
    expect(sizesAfterRender(scene, 1)).toEqual([0]);
  });
});
