import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FOG_LIGHT_TEXELS, FogLightKind, FogLightRows } from './fogLights';
import { fogLightUserData } from './fogLightDeclaration';

/** A camera at (0, 3, 8) looking down -Z, as in `unit-world-environment-basic`. */
function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(75, 1, 0.05, 4000);
  view.position.set(0, 3, 8);
  view.updateMatrixWorld();
  return view;
}

/** Each light in a scene, with its world matrices current, as the fog reads them. */
function placed(...lights: THREE.Light[]): THREE.Light[] {
  const scene = new THREE.Scene();
  for (const light of lights) {
    scene.add(light);
    const target = (light as THREE.DirectionalLight | THREE.SpotLight).target;
    if (target) scene.add(target);
  }
  scene.updateMatrixWorld();
  return lights;
}

/** The rows `lights` pack into through the test camera. */
function packed(lights: THREE.Light[]): FogLightRows {
  const rows = new FogLightRows();
  rows.pack(lights, camera());
  return rows;
}

/** Texel `texel` of light row `row`. */
function texel(rows: FogLightRows, row: number, texel: number): number[] {
  const start = (row * FOG_LIGHT_TEXELS + texel) * 4;
  return Array.from(rows.data.subarray(start, start + 4));
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

describe('FogLightRows.pack', () => {
  it('puts an omni light in view space with its range, decay and colour times energy', () => {
    const rows = packed(placed(omni()));

    expect(rows.count).toBe(1);
    expect(texel(rows, 0, 0)).toEqual([0, 5, -8, Math.fround(1 / 60)]);
    expect(texel(rows, 0, 1)).toEqual([Math.fround(Math.PI), Math.fround(Math.PI), Math.fround(Math.PI), 1]);
    expect(texel(rows, 0, 3)[1]).toBe(FogLightKind.OMNI);
  });

  it('scales the colour by the declared fog energy', () => {
    const light = omni();
    light.userData = fogLightUserData({ energy: 0.5 });

    const rows = packed(placed(light));

    expect(texel(rows, 0, 1)[0]).toBeCloseTo(Math.PI / 2, 5);
  });

  it('leaves out a light whose fog energy is at or below 0.001', () => {
    const light = omni();
    light.userData = fogLightUserData({ energy: 0.001 });

    expect(packed(placed(light)).count).toBe(0);
  });

  it('leaves out a light under a hidden ancestor', () => {
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(omni());
    const scene = new THREE.Scene();
    scene.add(hidden);
    scene.updateMatrixWorld();

    expect(packed(hidden.children as THREE.Light[]).count).toBe(0);
  });

  it('points a directional light towards itself, in view space', () => {
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(0, 1, 0);
    sun.target.position.set(0, 0, 0);

    const rows = packed(placed(sun));

    expectDirection(texel(rows, 0, 2).slice(0, 3), [0, 1, 0]);
    expect(texel(rows, 0, 3)[1]).toBe(FogLightKind.DIRECTIONAL);
  });

  it("gives a spot light its travel direction, cone cosine and Godot's cone exponent", () => {
    const spot = new THREE.SpotLight(0xffffff, 1, 10, Math.PI / 3, 0, 1);
    spot.position.set(0, 3, 0);
    spot.target.position.set(0, 3, -1);
    spot.userData = fogLightUserData({ energy: 1, spotAngleAttenuation: 4 });

    const rows = packed(placed(spot));

    const [x, y, z, cosAngle] = texel(rows, 0, 2);
    expectDirection([x!, y!, z!], [0, 0, -1]);
    expect(cosAngle).toBeCloseTo(0.5, 6);
    expect(texel(rows, 0, 3)).toEqual([0.25, FogLightKind.SPOT, 0, 0]);
  });

  it('keeps a negative light negative, so the fog darkens', () => {
    const light = omni();
    light.intensity = -Math.PI;

    expect(texel(packed(placed(light)), 0, 1)[0]).toBeCloseTo(-Math.PI, 5);
  });

  it('answers that the rows changed only when a light moved', () => {
    const lights = placed(omni());
    const view = camera();
    const rows = new FogLightRows();

    expect(rows.pack(lights, view)).toBe(true);
    expect(rows.pack(lights, view)).toBe(false);
    lights[0]!.position.y = 9;
    lights[0]!.updateMatrixWorld();
    expect(rows.pack(lights, view)).toBe(true);
  });

  it('answers that the rows changed when a light leaves', () => {
    const lights = placed(omni(), omni());
    const view = camera();
    const rows = new FogLightRows();
    rows.pack(lights, view);

    expect(rows.pack(lights.slice(0, 1), view)).toBe(true);
    expect(rows.count).toBe(1);
  });
});
