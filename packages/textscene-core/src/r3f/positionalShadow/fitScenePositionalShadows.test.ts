import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ROOT_POSITIONAL_SHADOW_ATLAS } from '../../godot/rendering/lights/positionalShadowAtlas';
import { sceneLights, type SceneLight } from '../directionalShadow/lightLists';
import { positionalShadowUserData } from './declaration';
import { fitScenePositionalShadows } from './fitScenePositionalShadows';
import { ViewportShadowAtlas } from './viewportShadowAtlas';
import { AtlasAreaShadow, type AreaShadowLight } from './atlasAreaShadow';

/** Looks down -z from z = 10, with a square 90-degree view. */
function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(90, 1, 0.05, 1000);
  view.position.set(0, 0, 10);
  view.updateMatrixWorld();
  return view;
}

/** A declared, casting omni light at `x` on the view axis plane, large enough to want 1024. */
function omniAt(x: number, name: string): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, 1, 8);
  light.name = name;
  light.position.set(x, 0, 0);
  light.castShadow = true;
  light.userData = positionalShadowUserData({ normalBias: 1, softShadowRadius: 2 });
  return light;
}

/**
 * A declared, casting 2×1 area light at `z`, facing -z towards the camera's view axis when
 * `facesAway` is false, with a range of 6.
 */
function areaAt(z: number, facesAway = false): AreaShadowLight {
  const light = new THREE.RectAreaLight(0xffffff, 1, 2, 1) as AreaShadowLight;
  light.shadow = new AtlasAreaShadow();
  light.shadow.range = 6;
  light.shadow.size.set(2, 1);
  light.position.set(0, 0, z);
  if (facesAway) light.rotation.y = Math.PI;
  light.castShadow = true;
  light.userData = positionalShadowUserData({ normalBias: 1, softShadowRadius: 2 });
  return light;
}

/** The lights of a scene that holds `lights`, as the scene walk finds them. */
function lightsOf(...lights: THREE.Light[]): SceneLight[] {
  const scene = new THREE.Scene();
  scene.add(...lights);
  scene.updateMatrixWorld();
  return sceneLights(scene);
}

const rootAtlas = () => new ViewportShadowAtlas(ROOT_POSITIONAL_SHADOW_ATLAS);

describe('fitScenePositionalShadows', () => {
  it('fits each declared light to the slot it holds', () => {
    const light = omniAt(0, 'lamp');
    fitScenePositionalShadows(lightsOf(light), camera(), rootAtlas(), 0);
    expect(light.shadow.mapSize.x).toBe(512);
    expect(light.shadow.normalBias).toBeCloseTo(10 / 1024, 12);
  });

  it('serves the last light in the tree first, so the first loses the slot in a full atlas', () => {
    const lights = Array.from({ length: 5 }, (_, i) => omniAt(i * 0.1, `lamp${i}`));
    fitScenePositionalShadows(lightsOf(...lights), camera(), rootAtlas(), 0);
    // Four omni lights fill both 1024 quadrants with two slots each.
    expect(lights.map((light) => light.shadow.mapSize.x)).toEqual([256, 512, 512, 512, 512]);
  });

  it('leaves a light outside the frustum out of the allocation (edge case)', () => {
    const lights = Array.from({ length: 4 }, (_, i) => omniAt(i * 0.1, `lamp${i}`));
    const behind = omniAt(0, 'behind');
    behind.position.set(0, 0, 40);
    fitScenePositionalShadows(lightsOf(behind, ...lights), camera(), rootAtlas(), 0);
    expect(behind.shadow.intensity).toBe(0);
    expect(lights.every((light) => light.shadow.mapSize.x === 512)).toBe(true);
  });

  it('leaves a hidden light, a light that casts nothing, and an undeclared light out (edge case)', () => {
    const hidden = omniAt(0, 'hidden');
    hidden.visible = false;
    const dark = omniAt(0, 'dark');
    dark.castShadow = false;
    const undeclared = omniAt(0, 'undeclared');
    undeclared.userData = {};
    undeclared.shadow.mapSize.set(64, 64);
    const lights = Array.from({ length: 4 }, (_, i) => omniAt(i * 0.1, `lamp${i}`));
    fitScenePositionalShadows(lightsOf(...lights, hidden, dark, undeclared), camera(), rootAtlas(), 0);
    expect(lights.every((light) => light.shadow.mapSize.x === 512)).toBe(true);
    expect(hidden.shadow.intensity).toBe(0);
    expect(undeclared.shadow.mapSize.x).toBe(64);
  });

  it('fits nothing for a camera without a depth range (error case)', () => {
    const light = omniAt(0, 'lamp');
    light.shadow.mapSize.set(64, 64);
    fitScenePositionalShadows(lightsOf(light), new THREE.Camera(), rootAtlas(), 0);
    expect(light.shadow.mapSize.x).toBe(64);
  });

  it('gives an area light one slot, so three omni lights and two area lights fill both 1024 quadrants', () => {
    const omnis = Array.from({ length: 3 }, (_, i) => omniAt(i * 0.1, `lamp${i}`));
    const areas = [areaAt(0), areaAt(1)];
    fitScenePositionalShadows(lightsOf(...areas, ...omnis), camera(), rootAtlas(), 0);
    expect(areas.map((light) => light.shadow.slot?.size)).toEqual([1024, 1024]);
  });

  it("fits an area light's normal bias and kernel to its slot", () => {
    const light = areaAt(0);
    fitScenePositionalShadows(lightsOf(light), camera(), rootAtlas(), 0);
    expect(light.shadow.normalBias).toBeCloseTo(10 / 1024, 12);
    expect(light.shadow.radius).toBe(2);
  });

  it('leaves out an area light whose volume, in front of it, lies behind the camera (edge case)', () => {
    const light = areaAt(12, true);
    fitScenePositionalShadows(lightsOf(light), camera(), rootAtlas(), 0);
    expect(light.shadow.slot).toBeNull();
  });

  it('gives an area light behind the camera a slot when its volume reaches the view (edge case)', () => {
    const light = areaAt(12);
    fitScenePositionalShadows(lightsOf(light), camera(), rootAtlas(), 0);
    expect(light.shadow.slot).not.toBeNull();
  });

  it('leaves an area light without the atlas shadow out (error case)', () => {
    const light = new THREE.RectAreaLight(0xffffff, 1, 2, 1);
    light.castShadow = true;
    light.userData = positionalShadowUserData({ normalBias: 1, softShadowRadius: 2 });
    expect(() => fitScenePositionalShadows(lightsOf(light), camera(), rootAtlas(), 0)).not.toThrow();
  });
});
