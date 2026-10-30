/**
 * The values every fog program and the background read. Each is one object, so every material's
 * uniform clone reads it: `cloneUniforms`
 * passes a typed array by reference and clones a texture (three r186 `UniformsUtils.js:28-39`).
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import { MAX_DIRECTIONAL_LIGHTS } from '../../godot/rendering/lights/directionalShadow.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';

/**
 * The volume the fog pass integrates into. It is no render target's texture in three's eyes, so it
 * reaches each material's clone. Until a pass draws it, three binds its empty 3D texture in its
 * place (`WebGLState.js:952`).
 */
class FogVolumeTexture extends sharedTexture(THREE.Data3DTexture) {
  constructor() {
    super(null, 1, 1, 1);
    this.name = 'VolumetricFogVolume';
    this.format = THREE.RGBAFormat;
    this.type = THREE.HalfFloatType;
    this.minFilter = THREE.LinearFilter;
    this.magFilter = THREE.LinearFilter;
    this.generateMipmaps = false;
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
} as const;

type FogUniformKey = keyof typeof FOG_UNIFORM;

/** The value an earlier evaluation of this module installed, as after a reload, or a new one. */
function installed<Value>(key: FogUniformKey, create: () => Value): Value {
  return (installedUniformValue(FOG_UNIFORM[key]) as Value | undefined) ?? create();
}

const vec4 = () => new Float32Array(4);
const vec4Array = () => new Float32Array(4 * MAX_DIRECTIONAL_LIGHTS);

/** Written only by `prepareFog`, before each render of a fogged scene, and cleared by `finishFog`. */
export const fogUniforms = {
  volume: installed('volume', () => new FogVolumeTexture()),
  /** The inverse fog length, 0 with no volume, the inverse detail spread, the sky affect, 1 for legacy blending. */
  volumeLookup: installed('volumeLookup', vec4),
  /** The render's origin and inverse size in pixels. */
  viewport: installed('viewport', vec4),
  /** The linear fog colour times its energy, then 1 while the depth fog is on. */
  depthColor: installed('depthColor', vec4),
  /** The density, then DEPTH mode's begin, end and curve. */
  depthShape: installed('depthShape', vec4),
  /** The mode, the height, the height density and the aerial perspective. */
  depthLayer: installed('depthLayer', vec4),
  /** The sky affect, the sun scatter, and the camera's near and far planes. */
  depthSky: installed('depthSky', vec4),
  /** Each sun's world direction towards it. */
  sunDirections: installed('sunDirections', vec4Array),
  /** Each sun's colour times its energy as the surfaces read it, zero where they skip it. */
  sunSurfaceColors: installed('sunSurfaceColors', vec4Array),
  /** Each sun's colour times its energy as the sky reads it, zero where the sky skips it. */
  sunSkyColors: installed('sunSkyColors', vec4Array),
};

/** The uniforms a shader that includes `GODOT_FOG_PARS_CHUNK` reads, one record per material. */
export function fogUniformRecord(): Record<string, THREE.IUniform> {
  return Object.fromEntries(
    Object.entries(FOG_UNIFORM).map(([key, name]) => [name, { value: fogUniforms[key as FogUniformKey] }])
  );
}
