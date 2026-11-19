import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { writeSkyBindings, type SkyScene } from './skyBindings.js';
import { transpileSky } from './transpileSky.js';
import { RADIANCE_ENERGY } from '../template/radianceCalls.js';
import { DEFAULT_SKY } from './defaultSky.testkit';

const SUN = {
  direction: new THREE.Vector3(0, 0, 1),
  energy: 2,
  color: new THREE.Color(1, 0.5, 0.25),
  size: 0.1,
};

function boundSky(scene: Partial<SkyScene>, pass: 'background' | 'octmap' = 'background') {
  const sky = transpileSky(DEFAULT_SKY, { pass });
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
  it("writes the octmap's padding in UV and its border size, as `_render_sky` does", () => {
    const borderSize = boundSky({ borderSize: 0.9 }, 'octmap')('params.border_size').value as THREE.Vector2;
    expect(borderSize.toArray()).toEqual([expect.closeTo(0.05, 9), 0.9]);
  });

  it("writes the energy of the radiance's layer 0, which a RADIANCE read scales by", () => {
    expect(boundSky({ radianceEnergy: 0.5 })(RADIANCE_ENERGY).value).toBe(0.5);
  });

  it('writes a radiance energy of 1 for a scene that names none', () => {
    const sky = transpileSky(DEFAULT_SKY);
    const scene = { camera: new THREE.PerspectiveCamera(), time: 0, brightness: 1, lights: [] };
    writeSkyBindings(sky, { ...scene, radianceEnergy: 4 });
    writeSkyBindings(sky, scene);
    expect(sky.uniforms.get(RADIANCE_ENERGY)!.value).toBe(1);
  });

  it("writes POSITION as the camera's origin", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3);
    camera.updateMatrixWorld();
    expect((boundSky({ camera })('params.position').value as THREE.Vector3).toArray()).toEqual([1, 2, 3]);
  });

  it('writes POSITION as the position the octmap pass names, which views from the origin', () => {
    const position = new THREE.Vector3(-4, 0.5, 2);
    const written = boundSky({ position }, 'octmap')('params.position').value as THREE.Vector3;
    expect(written.toArray()).toEqual([-4, 0.5, 2]);
  });

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

  it("writes the camera's projection terms Godot unprojects with, after Godot's flip of y", () => {
    const camera = new THREE.PerspectiveCamera(90, 2, 1, 10);
    camera.setViewOffset(4, 2, 1, 0.5, 4, 2);
    const projection = boundSky({ camera })('params.projection').value as THREE.Vector4;
    // The view offset moves the frustum to x from -1 to 3 and y from -1.5 to 0.5 at the near plane.
    expect(projection.toArray()).toEqual([0.5, 0.5, 0.5, -1].map((value) => expect.closeTo(value, 6)));
  });
});
