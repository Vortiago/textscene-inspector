import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AREA_LIGHT_STATICS,
  LIGHT_STATICS,
  installLightBakeModeUniforms,
  lightBakeModeUserData,
  writeLightBakeModeUniforms,
} from './lightBakeMode';
import { BakeMode } from '../../godot/scene/light';
import { sceneLights } from '../directionalShadow/lightLists';
import { slottedLights } from '../lightSlots';
import { SplitSunLight } from '../directionalShadow/splitSun';
import { litUniformArray } from '../testing/litUniformArray';

function declared<Light extends THREE.Light>(light: Light, bakeMode: number): Light {
  light.userData = lightBakeModeUserData(bakeMode);
  return light;
}

/** The first `count` flags of `name` the lit materials read after a render of `scene`. */
function flagsAfterRender(scene: THREE.Scene, name: string, count: number): number[] {
  writeLightBakeModeUniforms(slottedLights(sceneLights(scene), new THREE.PerspectiveCamera()));
  installLightBakeModeUniforms();
  return [...litUniformArray(name).subarray(0, count)];
}

describe('writeLightBakeModeUniforms', () => {
  it('flags each Static light in slot order: directional, then sun, then point, then spot', () => {
    const scene = new THREE.Scene();
    const shadowed = declared(new THREE.DirectionalLight(), BakeMode.STATIC);
    shadowed.add(new SplitSunLight());
    scene.add(
      declared(new THREE.SpotLight(), BakeMode.STATIC),
      declared(new THREE.PointLight(), BakeMode.DYNAMIC),
      declared(new THREE.DirectionalLight(), BakeMode.DISABLED),
      shadowed
    );

    expect(flagsAfterRender(scene, LIGHT_STATICS, 5)).toEqual([0, 1, 1, 0, 1]);
  });

  it('flags each Static area light in its own slots', () => {
    const scene = new THREE.Scene();
    scene.add(
      declared(new THREE.RectAreaLight(), BakeMode.DYNAMIC),
      declared(new THREE.RectAreaLight(), BakeMode.STATIC)
    );

    expect(flagsAfterRender(scene, AREA_LIGHT_STATICS, 2)).toEqual([0, 1]);
  });

  it('leaves a light without a declaration, such as a GLB light, unflagged (error case)', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.PointLight());

    expect(flagsAfterRender(scene, LIGHT_STATICS, 1)).toEqual([0]);
  });
});
