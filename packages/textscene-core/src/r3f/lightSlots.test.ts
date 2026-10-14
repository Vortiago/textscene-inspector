import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sceneLights } from './directionalShadow/lightLists';
import { SplitSunLight } from './directionalShadow/splitSun';
import { slottedLights } from './lightSlots';

const camera = new THREE.PerspectiveCamera();

describe('slottedLights', () => {
  it('files each light under the kind three gives it a slot as', () => {
    const scene = new THREE.Scene();
    const [spot, point, directional, sun] = [
      new THREE.SpotLight(),
      new THREE.PointLight(),
      new THREE.DirectionalLight(),
      new SplitSunLight(),
    ];
    directional.add(sun);
    scene.add(spot, point, directional);
    expect(slottedLights(sceneLights(scene), camera)).toEqual({
      directional: [directional],
      sun: [sun],
      point: [point],
      spot: [spot],
    });
  });

  it("puts a shadowed light first among its kind, as three's sort does", () => {
    const scene = new THREE.Scene();
    const [plain, shadowed] = [new THREE.PointLight(), new THREE.PointLight()];
    shadowed.castShadow = true;
    scene.add(plain, shadowed);
    expect(slottedLights(sceneLights(scene), camera).point).toEqual([shadowed, plain]);
  });

  it('gives a hidden light no slot (edge case)', () => {
    const scene = new THREE.Scene();
    const hidden = new THREE.PointLight();
    hidden.visible = false;
    scene.add(hidden);
    expect(slottedLights(sceneLights(scene), camera).point).toEqual([]);
  });

  it('gives a light on a layer the camera does not see no slot (error case)', () => {
    const scene = new THREE.Scene();
    const light = new THREE.SpotLight();
    light.layers.set(5);
    scene.add(light);
    expect(slottedLights(sceneLights(scene), camera).spot).toEqual([]);
  });
});
