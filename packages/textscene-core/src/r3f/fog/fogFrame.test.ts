/** The fog uniforms one render writes, and the clear after it. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering';
import { VOLUMETRIC_FOG_DEFAULTS } from '../../godot/volumetricFog';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { decodeEnvironment } from '../../resources/environment/decode';
import { skyLightUserData } from '../sky/skyLight';
import { finishFog, prepareFog, type FogSettings } from './fogFrame';
import type { FogPasses } from './fogPasses';
import { fogUniforms } from './fogUniforms';

const renderer = {} as THREE.WebGLRenderer;

function passes(): FogPasses {
  return {
    volume: { prepare: vi.fn(() => true) },
    radiance: { bake: vi.fn() },
  } as unknown as FogPasses;
}

function settings(properties: Record<string, string>): FogSettings {
  const environment = createEnvironmentSettings(decodeEnvironment(properties), DEFAULT_CLEAR_COLOR);
  return {
    depth: environment.fog,
    volumetric: environment.volumetricFog,
    project: VOLUMETRIC_FOG_DEFAULTS,
    skyEnergy: 1,
  };
}

const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);

const NO_OBJECTS = { lights: [], casters: [], volumes: [] };

function sun(intensity: number): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(0xffffff, intensity);
  light.position.set(0, 1, 0);
  const scene = new THREE.Scene();
  scene.add(light, light.target);
  scene.updateMatrixWorld();
  return light;
}

afterEach(finishFog);

describe('prepareFog', () => {
  it("writes the scene's sky rotation as world to sky space", () => {
    const scene = new THREE.Scene();
    scene.environmentRotation.set(0, Math.PI / 2, 0);
    prepareFog(renderer, scene, camera, settings({ fog_enabled: 'true' }), passes(), NO_OBJECTS);

    const skyDirection = new THREE.Vector3(1, 0, 0).applyMatrix3(
      new THREE.Matrix3().fromArray(fogUniforms.skyRotation)
    );
    expect(skyDirection.z).toBeCloseTo(1, 6);
  });

  it("writes the depth fog's colour times its energy, and its terms", () => {
    prepareFog(
      renderer,
      new THREE.Scene(),
      camera,
      settings({
        fog_enabled: 'true',
        fog_light_color: 'Color(1, 1, 1, 1)',
        fog_light_energy: '2',
        fog_density: '0.3',
      }),
      passes(),
      NO_OBJECTS
    );

    expect(Array.from(fogUniforms.depthColor)).toEqual([2, 2, 2, 1]);
    expect(fogUniforms.depthShape[0]).toBeCloseTo(0.3, 6);
  });

  it('ends a depth fog with no end at the camera’s far plane', () => {
    prepareFog(
      renderer,
      new THREE.Scene(),
      camera,
      settings({ fog_enabled: 'true', fog_mode: '1', fog_depth_end: '0' }),
      passes(),
      NO_OBJECTS
    );

    expect(fogUniforms.depthShape[2]).toBe(400);
  });

  it('writes each sun for the surfaces and for the sky apart', () => {
    const lightOnly = sun(2);
    lightOnly.userData = skyLightUserData({ drawsInSky: false, energy: 2 / Math.PI });
    prepareFog(renderer, new THREE.Scene(), camera, settings({ fog_enabled: 'true' }), passes(), {
      lights: [sun(Math.PI), lightOnly],
      casters: [],
      volumes: [],
    });

    expect(fogUniforms.sunDirections[1]).toBe(1);
    expect(fogUniforms.sunSurfaceColors[0]).toBeCloseTo(Math.PI, 5);
    expect(fogUniforms.sunSkyColors[3]).toBe(1);
    expect(fogUniforms.sunSurfaceColors[4]).toBeCloseTo(2, 5);
    expect(fogUniforms.sunSkyColors[7]).toBe(0);
  });

  it('bakes the sky radiance only for an aerial perspective', () => {
    const plain = passes();
    prepareFog(renderer, new THREE.Scene(), camera, settings({ fog_enabled: 'true' }), plain, NO_OBJECTS);
    const aerial = passes();
    prepareFog(
      renderer,
      new THREE.Scene(),
      camera,
      settings({ fog_enabled: 'true', fog_aerial_perspective: '0.5' }),
      aerial,
      NO_OBJECTS
    );

    expect(plain.radiance.bake).not.toHaveBeenCalled();
    expect(aerial.radiance.bake).toHaveBeenCalledOnce();
  });

  it('prepares the volume only for a volumetric fog, and answers whether it settles', () => {
    const depthOnly = passes();
    expect(
      prepareFog(
        renderer,
        new THREE.Scene(),
        camera,
        settings({ fog_enabled: 'true' }),
        depthOnly,
        NO_OBJECTS
      )
    ).toBe(false);
    const volumetric = passes();
    expect(
      prepareFog(
        renderer,
        new THREE.Scene(),
        camera,
        settings({ volumetric_fog_enabled: 'true' }),
        volumetric,
        NO_OBJECTS
      )
    ).toBe(true);

    expect(depthOnly.volume.prepare).not.toHaveBeenCalled();
    expect(volumetric.volume.prepare).toHaveBeenCalledOnce();
  });
});

describe('finishFog', () => {
  it('leaves the next render without fog', () => {
    prepareFog(renderer, new THREE.Scene(), camera, settings({ fog_enabled: 'true' }), passes(), NO_OBJECTS);
    fogUniforms.volumeLookup[0] = 1;

    finishFog();

    expect(fogUniforms.depthColor[3]).toBe(0);
    expect(fogUniforms.volumeLookup[0]).toBe(0);
  });
});
