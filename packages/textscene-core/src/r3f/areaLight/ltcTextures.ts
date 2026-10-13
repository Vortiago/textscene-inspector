/**
 * Godot's LTC tables as the textures three binds to `ltc_1` and `ltc_2` for a scene with a rect
 * area light. three picks the float pair where the GPU filters float textures linearly
 * (`OES_texture_float_linear`), else the half-float pair (r186 `WebGLLights.js:471-485`).
 */

import * as THREE from 'three';
import { LTC_SIZE, ltcTables } from '../../godot/ltc.js';

/** The four textures three reads off `UniformsLib`, which its own type does not declare. */
interface LtcUniformsLib {
  LTC_FLOAT_1?: THREE.DataTexture;
  LTC_FLOAT_2?: THREE.DataTexture;
  LTC_HALF_1?: THREE.DataTexture;
  LTC_HALF_2?: THREE.DataTexture;
}

/**
 * Godot samples each table linearly and clamped, with no mipmaps
 * (4.7.2: `render_forward_clustered.cpp:3355,3364`).
 */
function ltcTexture(data: Float32Array | Uint16Array, type: THREE.TextureDataType): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    data,
    LTC_SIZE,
    LTC_SIZE,
    THREE.RGBAFormat,
    type,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.LinearFilter,
    THREE.LinearFilter
  );
  texture.needsUpdate = true;
  return texture;
}

function halfFloats(floats: Float32Array): Uint16Array {
  return Uint16Array.from(floats, (value) => THREE.DataUtils.toHalfFloat(value));
}

/** Puts Godot's tables where three looks for the LTC textures, for every render after the call. */
export function installLtcTextures(): void {
  const { lut1, lut2 } = ltcTables();
  Object.assign(THREE.UniformsLib as LtcUniformsLib, {
    LTC_FLOAT_1: ltcTexture(lut1, THREE.FloatType),
    LTC_FLOAT_2: ltcTexture(lut2, THREE.FloatType),
    LTC_HALF_1: ltcTexture(halfFloats(lut1), THREE.HalfFloatType),
    LTC_HALF_2: ltcTexture(halfFloats(lut2), THREE.HalfFloatType),
  } satisfies LtcUniformsLib);
}
