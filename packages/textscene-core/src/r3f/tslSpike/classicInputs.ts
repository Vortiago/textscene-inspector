/**
 * The lit surface's inputs as the classic pipeline owns them: the textures and buffers it gives
 * every patched lit material (`../shaderPatch/litUniform.ts`). A node material that reads them draws
 * beside patched materials in one frame, from one shadow pass and one baked sky.
 */

import * as THREE from 'three';
import { directionalShadowAtlasDepth } from '../directionalShadow/shadowAtlas.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';
import { SKY_RADIANCE_UNIFORMS, skyRadianceUniforms } from '../sky/skyRadiance.js';
import type { LitSurfaceInputs } from './litSurfaceMaterial.js';

const DFG_UNIFORM = 'godotDfgTable';

/** Call after `installShaderPatches`, which creates the values. */
export function classicLitSurfaceInputs(): LitSurfaceInputs {
  const dfgTable = installedUniformValue(DFG_UNIFORM);
  if (!(dfgTable instanceof THREE.Texture)) {
    throw new Error(`expected the installed ${DFG_UNIFORM} texture, got ${String(dfgTable)}`);
  }
  const sky = skyRadianceUniforms();
  return {
    dfgTable,
    sky: {
      layers: sky[SKY_RADIANCE_UNIFORMS.layers]!.value as THREE.Texture,
      shown: sky[SKY_RADIANCE_UNIFORMS.shown]!.value as Float32Array,
      rotation: sky[SKY_RADIANCE_UNIFORMS.rotation]!.value as Float32Array,
    },
    sunShadow: {
      atlas: directionalShadowAtlasDepth(),
      // Turned back: `WebGLRenderer` draws the atlas with its rows the way the lookup counts them.
      atlasCoord: (uv) => uv.flipY(),
    },
  };
}
