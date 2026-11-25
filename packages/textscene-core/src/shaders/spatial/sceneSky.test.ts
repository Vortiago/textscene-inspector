import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { writeSpatialBindings } from './spatialBindings.js';
import { transpileSpatial } from './transpileSpatial.js';
import type { SceneSky } from './sceneSky.js';

const LIT = 'shader_type spatial;\nvoid fragment() {\n\tALBEDO = vec3(0.6);\n}\n';

/** `SCENE_DATA_FLAGS_USE_AMBIENT_CUBEMAP` and `SCENE_DATA_FLAGS_USE_REFLECTION_CUBEMAP`. */
const AMBIENT_CUBEMAP = 1 << 1;
const REFLECTION_CUBEMAP = 1 << 2;

const LAYERS = new THREE.DataArrayTexture(new Uint8Array(4 * 8), 1, 1, 8);

function sky(overrides: Partial<SceneSky> = {}): SceneSky {
  return {
    layers: LAYERS,
    layerEnergies: [2, 2, 3],
    pixelSize: 1 / 256,
    borderSize: 0.0625,
    worldToSky: new THREE.Matrix3().makeRotation(0.5),
    energyMultiplier: 1.5,
    ambientContribution: 0.75,
    isReflected: true,
    ...overrides,
  };
}

function written(sceneSky?: SceneSky) {
  const spatial = transpileSpatial(LIT);
  const camera = new THREE.PerspectiveCamera(75, 2, 0.05, 4000);
  camera.rotation.set(0.3, 0.2, 0);
  writeSpatialBindings(spatial, {
    camera,
    width: 128,
    height: 64,
    time: 0,
    ambientLight: new THREE.Color(0.1, 0.2, 0.3),
    emissiveExposure: 0.25,
    directionalLights: [],
    ...(sceneSky && { sky: sceneSky }),
  });
  const value = (name: string) =>
    (spatial.uniforms.get(`scene_data_block.data.${name}`) as UniformNode<unknown>).value;
  return { spatial, camera, value };
}

const flagsOf = (sceneSky?: SceneSky) => written(sceneSky).value('flags') as number;

describe('writeSpatialBindings with a sky', () => {
  it('turns on the ambient and the reflection cubemaps', () => {
    expect(flagsOf(sky()) & (AMBIENT_CUBEMAP | REFLECTION_CUBEMAP)).toBe(
      AMBIENT_CUBEMAP | REFLECTION_CUBEMAP
    );
  });

  it('leaves both cubemaps off with no sky', () => {
    expect(flagsOf() & (AMBIENT_CUBEMAP | REFLECTION_CUBEMAP)).toBe(0);
  });

  it('leaves the ambient cubemap off when the ambient takes none of the sky', () => {
    expect(flagsOf(sky({ ambientContribution: 0 })) & AMBIENT_CUBEMAP).toBe(0);
  });

  it('leaves the reflection cubemap off when the reflection source gives no sky', () => {
    expect(flagsOf(sky({ isReflected: false })) & REFLECTION_CUBEMAP).toBe(0);
  });

  it('writes the radiance size, border and ambient mix', () => {
    const { value } = written(sky());
    expect(value('radiance_pixel_size')).toBe(1 / 256);
    expect(value('radiance_border_size')).toBe(0.0625);
    expect(value('ambient_color_sky_mix')).toBe(0.75);
  });

  it('writes view to sky space as the sky basis times the camera basis', () => {
    const { value, camera } = written(sky());
    const expected = new THREE.Matrix3()
      .makeRotation(0.5)
      .multiply(new THREE.Matrix3().setFromMatrix4(camera.matrixWorld));
    const xform = value('radiance_inverse_xform') as THREE.Matrix3;
    xform.elements.forEach((element, index) => expect(element).toBeCloseTo(expected.elements[index]!, 12));
  });

  it('writes a zero sky basis when no surface reads the sky', () => {
    const xform = written(sky({ ambientContribution: 0, isReflected: false })).value(
      'radiance_inverse_xform'
    );
    expect((xform as THREE.Matrix3).elements).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('writes the background energy into the ambient light, and the exposure as the IBL normalisation', () => {
    const { value } = written(sky());
    expect((value('ambient_light_color_energy') as THREE.Vector4).w).toBe(1.5);
    expect(value('IBL_exposure_normalization')).toBe(0.25);
  });

  it('writes an IBL normalisation of 1 and a background energy of 1 with no sky', () => {
    const { value } = written();
    expect((value('ambient_light_color_energy') as THREE.Vector4).w).toBe(1);
    expect(value('IBL_exposure_normalization')).toBe(1);
  });
});

describe('bindSkyLayers', () => {
  const octmap = (spatial: ReturnType<typeof written>['spatial']) => spatial.textures.get('radiance_octmap')!;

  it("binds the sky's layers", () => {
    expect(octmap(written(sky()).spatial).value).toBe(LAYERS);
  });

  it('binds a black array with no sky', () => {
    const layers = octmap(written().spatial).value as THREE.DataArrayTexture;
    expect(layers).not.toBe(LAYERS);
    const colours = [...(layers.image.data as Uint8Array)].filter((_, channel) => channel % 4 !== 3);
    expect(new Set(colours)).toEqual(new Set([0]));
  });
});
