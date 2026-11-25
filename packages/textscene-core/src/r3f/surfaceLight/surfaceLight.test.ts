import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { attachSplitSun } from '../directionalShadow/splitSun';
import { dropLight } from '../directionalShadow/droppedLight';
import type { DirectionalLight } from '../../shaders/spatial/directionalLights';
import { lightSpecularUserData } from '../lightSpecular/lightSpecular';
import { lightSizeUserData } from '../lightSize/lightSize';
import { lightBakeModeUserData } from '../lightBakeMode/lightBakeMode';
import { fogLightUserData } from '../fog/fogLightDeclaration';
import { sceneDirectionalLights, surfaceLightUserData } from './surfaceLight';

const OWN = { cullMask: 6, lightsSurfaces: true };

/** The light's other declarations, which the light buffer reads beside its own. */
const DECLARED = {
  ...lightSpecularUserData(2),
  ...lightSizeUserData(0.25),
  ...lightBakeModeUserData(1),
  ...fogLightUserData({ energy: 3 }),
};

/** A sun at `position` shining at the origin, with `own` declared on it. */
function sun(
  scene: THREE.Scene,
  position: THREE.Vector3Tuple,
  own: typeof OWN | null = OWN
): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(0xff8040, 2 * LIGHT_INTENSITY_SCALE);
  light.position.set(...position);
  if (own) Object.assign(light.userData, surfaceLightUserData(own), DECLARED);
  scene.add(light);
  scene.updateMatrixWorld(true);
  return light;
}

/** The one light of `scene` in the render `renderId`. */
function onlyLight(scene: THREE.Scene, renderId = 1): DirectionalLight {
  const lights = sceneDirectionalLights(scene, renderId);
  expect(lights).toHaveLength(1);
  return lights[0]!;
}

describe('sceneDirectionalLights', () => {
  it('points each light from its target to itself', () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 3, 4]);
    expect(
      onlyLight(scene)
        .direction.toArray()
        .map((value) => +value.toFixed(6))
    ).toEqual([0, 0.6, 0.8]);
  });

  it('reads the energy out of the three intensity', () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 1, 0]);
    expect(onlyLight(scene).energy).toBeCloseTo(2);
  });

  it('carries the values the light declares', () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 1, 0]);
    const { specular, size, cullMask, bakeMode, volumetricFogEnergy } = onlyLight(scene);
    expect({ specular, size, cullMask, bakeMode, volumetricFogEnergy }).toEqual({
      specular: 2,
      size: 0.25,
      cullMask: 6,
      bakeMode: 1,
      volumetricFogEnergy: 3,
    });
  });

  it("gives a light that declares nothing a DirectionalLight3D's defaults", () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 1, 0], null);
    const { specular, cullMask } = onlyLight(scene);
    expect({ specular, cullMask }).toEqual({ specular: 1, cullMask: 0xffffffff });
  });

  it('skips a Sky Only light', () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 1, 0], { ...OWN, lightsSurfaces: false });
    expect(sceneDirectionalLights(scene, 1)).toEqual([]);
  });

  it('skips a light under a hidden parent', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    parent.visible = false;
    scene.add(parent);
    parent.add(sun(scene, [0, 1, 0]));
    expect(sceneDirectionalLights(scene, 1)).toEqual([]);
  });

  it("skips a light the fitter drops past Godot's eighth", () => {
    const scene = new THREE.Scene();
    dropLight(sun(scene, [0, 1, 0]));
    expect(sceneDirectionalLights(scene, 1)).toEqual([]);
  });

  it('counts a split sun once, as the light it splits', () => {
    const scene = new THREE.Scene();
    attachSplitSun(sun(scene, [0, 1, 0]));
    expect(sceneDirectionalLights(scene, 1)).toHaveLength(1);
  });

  it('reads the lights again in a new render', () => {
    const scene = new THREE.Scene();
    const light = sun(scene, [0, 1, 0]);
    sceneDirectionalLights(scene, 1);
    light.intensity = 0;
    expect(onlyLight(scene, 1).energy).toBeCloseTo(2);
    expect(onlyLight(scene, 2).energy).toBe(0);
  });
});
