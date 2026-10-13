import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FOG_LIGHT_TEXELS, FogLightKind, packFogLights } from './fogLights';
import { fogLightUserData } from './fogLightDeclaration';

/** A camera at (0, 3, 8) looking down -Z, as in `unit-world-environment-basic`. */
function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(75, 1, 0.05, 4000);
  view.position.set(0, 3, 8);
  view.updateMatrixWorld();
  return view;
}

function sceneWith(...lights: THREE.Light[]): THREE.Scene {
  const scene = new THREE.Scene();
  for (const light of lights) scene.add(light);
  scene.updateMatrixWorld();
  return scene;
}

/** Texel `texel` of light row `row`. */
function texel(rows: Float32Array, row: number, texel: number): number[] {
  const start = (row * FOG_LIGHT_TEXELS + texel) * 4;
  return Array.from(rows.subarray(start, start + 4));
}

/** A vector's components to six places, so a negative zero matches a zero. */
function expectDirection(actual: number[], expected: number[]): void {
  actual.forEach((component, axis) => expect(component).toBeCloseTo(expected[axis]!, 6));
}

function omni(): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, Math.PI, 60, 1);
  light.position.set(0, 8, 0);
  return light;
}

describe('packFogLights', () => {
  it('puts an omni light in view space with its range, decay and colour times energy', () => {
    const rows = packFogLights(sceneWith(omni()), camera());

    expect(rows.length).toBe(FOG_LIGHT_TEXELS * 4);
    expect(texel(rows, 0, 0)).toEqual([0, 5, -8, Math.fround(1 / 60)]);
    expect(texel(rows, 0, 1)).toEqual([Math.fround(Math.PI), Math.fround(Math.PI), Math.fround(Math.PI), 1]);
    expect(texel(rows, 0, 3)[1]).toBe(FogLightKind.OMNI);
  });

  it('scales the colour by the declared fog energy', () => {
    const light = omni();
    light.userData = fogLightUserData({ energy: 0.5 });

    const rows = packFogLights(sceneWith(light), camera());

    expect(texel(rows, 0, 1)[0]).toBeCloseTo(Math.PI / 2, 5);
  });

  it('leaves out a light whose fog energy is at or below 0.001', () => {
    const light = omni();
    light.userData = fogLightUserData({ energy: 0.001 });

    expect(packFogLights(sceneWith(light), camera())).toHaveLength(0);
  });

  it('leaves out a light under a hidden ancestor', () => {
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(omni());
    const scene = new THREE.Scene();
    scene.add(hidden);
    scene.updateMatrixWorld();

    expect(packFogLights(scene, camera())).toHaveLength(0);
  });

  it('points a directional light towards itself, in view space', () => {
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(0, 1, 0);
    sun.target.position.set(0, 0, 0);
    const scene = sceneWith(sun);
    scene.add(sun.target);
    scene.updateMatrixWorld();

    const rows = packFogLights(scene, camera());

    expectDirection(texel(rows, 0, 2).slice(0, 3), [0, 1, 0]);
    expect(texel(rows, 0, 3)[1]).toBe(FogLightKind.DIRECTIONAL);
  });

  it("gives a spot light its travel direction, cone cosine and Godot's cone exponent", () => {
    const spot = new THREE.SpotLight(0xffffff, 1, 10, Math.PI / 3, 0, 1);
    spot.position.set(0, 3, 0);
    spot.target.position.set(0, 3, -1);
    spot.userData = fogLightUserData({ energy: 1, spotAngleAttenuation: 4 });
    const scene = sceneWith(spot);
    scene.add(spot.target);
    scene.updateMatrixWorld();

    const rows = packFogLights(scene, camera());

    const [x, y, z, cosAngle] = texel(rows, 0, 2);
    expectDirection([x!, y!, z!], [0, 0, -1]);
    expect(cosAngle).toBeCloseTo(0.5, 6);
    expect(texel(rows, 0, 3)).toEqual([0.25, FogLightKind.SPOT, 0, 0]);
  });
});
