import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { writeSkyBindings, type SkyScene } from './skyBindings.js';
import { transpileSky } from './transpileSky.js';
import { DEFAULT_SKY } from './defaultSky.testkit';

const SUN = {
  direction: new THREE.Vector3(0, 0, 1),
  energy: 2,
  color: new THREE.Color(1, 0.5, 0.25),
  size: 0.1,
};

function boundSky(scene: Partial<SkyScene>) {
  const sky = transpileSky(DEFAULT_SKY);
  writeSkyBindings(sky, {
    camera: new THREE.PerspectiveCamera(),
    time: 0,
    brightness: 1,
    lights: [],
    ...scene,
  });
  return (name: string) => sky.uniforms.get(name) as UniformNode<unknown> & { array?: unknown[] };
}

describe('writeSkyBindings', () => {
  it('writes the fog as off when the scene has none', () => {
    expect(boundSky({})('sky_scene_data.fog_enabled').value).toBe(false);
  });

  it('writes the fog light as its colour times its energy', () => {
    const fog = {
      lightColor: new THREE.Color(0.5, 0.25, 1),
      lightEnergy: 2,
      sunScatter: 0,
      skyAffect: 1,
      aerialPerspective: 0,
      density: 0,
    };
    expect(boundSky({ fog })('sky_scene_data.fog_light_color').value).toEqual(new THREE.Vector3(1, 0.5, 2));
  });

  it("writes a light's direction and energy into its slot", () => {
    const slots = boundSky({ lights: [SUN] })('directional_lights.data.direction_energy').array!;
    expect(slots[0]).toEqual(new THREE.Vector4(0, 0, 1, 2));
  });

  it('marks each slot past the last light as off', () => {
    expect(boundSky({ lights: [SUN] })('directional_lights.data.enabled').array).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("writes the camera's projection terms Godot unprojects with", () => {
    const camera = new THREE.PerspectiveCamera(90, 2, 1, 10);
    const projection = boundSky({ camera })('params.projection').value as THREE.Vector4;
    expect([projection.y, projection.w]).toEqual([0.5, 1].map((value) => expect.closeTo(value, 6)));
  });
});
