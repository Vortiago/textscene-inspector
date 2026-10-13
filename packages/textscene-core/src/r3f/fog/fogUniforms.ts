/**
 * The values every fog program and the background read: the depth fog's terms, the directional
 * lights its sun scatter reads, the sky's radiance for its aerial perspective and the volumetric
 * fog's volume. Each is one object, so every material's uniform clone reads it: `cloneUniforms`
 * passes a typed array by reference and clones a texture (three r186 `UniformsUtils.js:28-39`).
 * Written only by a scene's `FogFrame`, before each render of it, and cleared after that render.
 */

import * as THREE from 'three';
import { installedUniformValue } from '../shaderPatch/litUniform.js';

/** The directional lights the sun scatter reads (`MAX_DIRECTIONAL_LIGHTS`, `light_storage.h:51`). */
export const FOG_SUN_MAX = 8;

/** The width and height of one roughness band of the radiance atlas, an equirectangular map. */
export const FOG_RADIANCE_BAND_WIDTH = 128;
export const FOG_RADIANCE_BAND_HEIGHT = 64;

/** The bands, from roughness 1/7 to 1, one per radiance mip the aerial perspective reads. */
export const FOG_RADIANCE_BANDS = 7;

/**
 * The volume the fog pass integrates into. A render target's texture would reach each material's
 * clone as null, so the pass draws into this one, which is no render target's in three's eyes, and
 * a clone of it is itself. Until a pass draws it, three binds its empty 3D texture in its place
 * (`WebGLState.js:952`).
 */
export class FogVolumeTexture extends THREE.Data3DTexture {
  constructor() {
    super(null, 1, 1, 1);
    this.name = 'VolumetricFogVolume';
    this.format = THREE.RGBAFormat;
    this.type = THREE.HalfFloatType;
    this.minFilter = THREE.LinearFilter;
    this.magFilter = THREE.LinearFilter;
    this.generateMipmaps = false;
  }

  override clone(): this {
    return this;
  }
}

/**
 * The sky's radiance as the aerial perspective reads it, one equirectangular band per roughness,
 * stacked bottom-up. It shares the volume's trick, so a pass draws it in place.
 */
export class FogRadianceTexture extends THREE.Texture {
  constructor() {
    super();
    this.name = 'FogRadiance';
    this.image = { width: FOG_RADIANCE_BAND_WIDTH, height: FOG_RADIANCE_BAND_HEIGHT * FOG_RADIANCE_BANDS };
    this.format = THREE.RGBAFormat;
    this.type = THREE.HalfFloatType;
    this.minFilter = THREE.LinearFilter;
    this.magFilter = THREE.LinearFilter;
    this.wrapS = THREE.RepeatWrapping;
    this.generateMipmaps = false;
  }

  override clone(): this {
    return this;
  }
}

/** Each uniform's name in the GLSL, which `fogChunks.ts` declares. */
export const FOG_UNIFORM = {
  volume: 'volumetricFogVolume',
  volumeLookup: 'volumetricFogLookup',
  viewport: 'fogViewport',
  depthColor: 'depthFogColor',
  depthShape: 'depthFogShape',
  depthLayer: 'depthFogLayer',
  depthSky: 'depthFogSky',
  sunDirections: 'fogSunDirections',
  sunSurfaceColors: 'fogSunSurfaceColors',
  sunSkyColors: 'fogSunSkyColors',
  skyRotation: 'fogSkyRotation',
  radiance: 'fogRadiance',
} as const;

type FogUniformKey = keyof typeof FOG_UNIFORM;

/** The value an earlier evaluation of this module installed, as after a reload, or a new one. */
function installed<Value>(key: FogUniformKey, create: () => Value): Value {
  return (installedUniformValue(FOG_UNIFORM[key]) as Value | undefined) ?? create();
}

const vec4 = () => new Float32Array(4);
const vec4Array = () => new Float32Array(4 * FOG_SUN_MAX);

/**
 * - `volumeLookup`: the inverse fog length, 0 when the render has no volume, then the inverse detail
 *   spread, the volume's sky affect and 1 for legacy blending.
 * - `viewport`: the render's origin and inverse size in pixels.
 * - `depthColor`: the linear fog colour times its energy, then 1 while the depth fog is on.
 * - `depthShape`: density, then DEPTH mode's begin, end and curve.
 * - `depthLayer`: the mode, the height, the height density and the aerial perspective.
 * - `depthSky`: the sky affect, the sun scatter, and the camera's near and far planes.
 * - The sun arrays: each light's world direction towards it, and its colour times its energy for
 *   the surfaces and for the sky, zero where it draws in neither.
 * - `skyRotation`: world to sky space, the inverse of `sky_rotation`'s basis, column-major.
 */
export const fogUniforms = {
  volume: installed('volume', () => new FogVolumeTexture()),
  volumeLookup: installed('volumeLookup', vec4),
  viewport: installed('viewport', vec4),
  depthColor: installed('depthColor', vec4),
  depthShape: installed('depthShape', vec4),
  depthLayer: installed('depthLayer', vec4),
  depthSky: installed('depthSky', vec4),
  sunDirections: installed('sunDirections', vec4Array),
  sunSurfaceColors: installed('sunSurfaceColors', vec4Array),
  sunSkyColors: installed('sunSkyColors', vec4Array),
  skyRotation: installed('skyRotation', () => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])),
  radiance: installed('radiance', () => new FogRadianceTexture()),
};

/** The uniforms a shader that includes `GODOT_FOG_PARS_CHUNK` reads, one record per material. */
export function fogUniformRecord(): Record<string, THREE.IUniform> {
  return Object.fromEntries(
    Object.entries(FOG_UNIFORM).map(([key, name]) => [name, { value: fogUniforms[key as FogUniformKey] }])
  );
}
