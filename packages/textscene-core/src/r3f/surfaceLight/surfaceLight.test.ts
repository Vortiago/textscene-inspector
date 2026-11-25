import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { attachSplitSun } from '../directionalShadow/splitSun';
import {
  directionalShadowUserData,
  type DirectionalShadowDeclaration,
} from '../directionalShadow/declaration';
import { NO_SHADOW_FADE } from '../directionalShadow/splitShadow';
import { dropLight } from '../directionalShadow/droppedLight';
import type { DirectionalLight } from '../../shaders/spatial/directionalLights';
import { lightSpecularUserData } from '../lightSpecular/lightSpecular';
import { lightSizeUserData } from '../lightSize/lightSize';
import { lightBakeModeUserData } from '../lightBakeMode/lightBakeMode';
import { fogLightUserData } from '../fog/fogLightDeclaration';
import { sceneLights } from '../directionalShadow/lightLists';
import { publishSceneSuns, releaseSceneSuns, sceneSuns, surfaceLightUserData } from './surfaceLight';

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

const SHADOW: DirectionalShadowDeclaration = {
  maxDistance: 100,
  pancakeSize: 20,
  fadeStart: 0.8,
  depthBias: -0.001,
  normalBias: 1,
  filterRadius: 1,
  softShadowAngle: 0.5,
  drawsSoftShadow: true,
  splitCount: 1,
  splitOffsets: [0.1, 0.2, 0.5],
  blendSplits: false,
  sharesAtlas: true,
};

/** A sun of `scene` that declares a shadow with a soft shadow angle. */
function shadowedSun(scene: THREE.Scene): THREE.DirectionalLight {
  const light = sun(scene, [0, 1, 0]);
  Object.assign(light.userData, directionalShadowUserData(SHADOW));
  return light;
}

/** The suns the light pass publishes for one render of `scene`. */
function publishedSuns(scene: THREE.Scene): readonly DirectionalLight[] {
  publishSceneSuns(scene, sceneLights(scene));
  return sceneSuns(scene);
}

/** The one light of `scene` in a render. */
function onlyLight(scene: THREE.Scene): DirectionalLight {
  const lights = publishedSuns(scene);
  expect(lights).toHaveLength(1);
  return lights[0]!;
}

describe('sceneSuns', () => {
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
    expect(publishedSuns(scene)).toEqual([]);
  });

  it('skips a light under a hidden parent', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    parent.visible = false;
    scene.add(parent);
    parent.add(sun(scene, [0, 1, 0]));
    expect(publishedSuns(scene)).toEqual([]);
  });

  it("skips a light the fitter drops past Godot's eighth", () => {
    const scene = new THREE.Scene();
    dropLight(sun(scene, [0, 1, 0]));
    expect(publishedSuns(scene)).toEqual([]);
  });

  it('counts a split sun once, as the light it splits', () => {
    const scene = new THREE.Scene();
    attachSplitSun(sun(scene, [0, 1, 0]));
    expect(publishedSuns(scene)).toHaveLength(1);
  });

  it('reads the lights again in a new render', () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 1, 0]);
    publishedSuns(scene);
    sun(scene, [1, 0, 0]);
    expect(publishedSuns(scene)).toHaveLength(2);
  });

  it("reads the energy at the draw, after the render's exposure scales the intensity", () => {
    const scene = new THREE.Scene();
    const light = sun(scene, [0, 1, 0]);
    const [published] = publishedSuns(scene);
    light.intensity *= 0.5;
    expect(published!.energy).toBeCloseTo(1);
  });

  it('lists the suns in the pre-order the light pass walks', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    sun(scene, [0, 1, 0]);
    group.add(sun(scene, [1, 0, 0]));
    scene.updateMatrixWorld(true);
    const xs = publishedSuns(scene).map(({ direction }) => Math.abs(Math.round(direction.x)));
    expect(xs).toEqual([1, 0]);
  });

  it("stops at Godot's eighth drawn sun", () => {
    const scene = new THREE.Scene();
    for (let index = 0; index < 9; index++) sun(scene, [0, 1, 0], null);
    expect(publishedSuns(scene)).toHaveLength(8);
  });

  it('gives a sun without a fitted shadow no shadow', () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 1, 0]);
    expect(onlyLight(scene).shadow).toBeUndefined();
  });

  it('reads the soft shadow angle the light pass gated for the render, as the classic path does', () => {
    const scene = new THREE.Scene();
    const split = attachSplitSun(shadowedSun(scene));
    split.shadow.softShadowAngle = 0;
    expect(onlyLight(scene).shadow?.softShadowAngle).toBe(0);
  });

  it('gives a sun no fit has placed a fade whose ends ascend past any view depth', () => {
    const scene = new THREE.Scene();
    attachSplitSun(shadowedSun(scene)).shadow.fade = NO_SHADOW_FADE;
    const { from, to } = onlyLight(scene).shadow!.fade;
    expect(from).toBeLessThan(to);
    expect(from).toBeGreaterThan(1e20);
  });

  it('reads nothing for a scene no light pass has published', () => {
    expect(sceneSuns(new THREE.Scene())).toEqual([]);
  });
});

describe('releaseSceneSuns', () => {
  it('leaves the scene no suns after its light pass stops', () => {
    const scene = new THREE.Scene();
    sun(scene, [0, 1, 0]);
    publishSceneSuns(scene, sceneLights(scene));
    releaseSceneSuns(scene);
    expect(sceneSuns(scene)).toEqual([]);
  });
});
