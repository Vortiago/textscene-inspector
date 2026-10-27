/**
 * What every lit program reads of the reflection probes (`probeShaderChunk.ts`): the reflection
 * atlas, and their count and the atlas's layout. The probes' rows are in the scene rows
 * (`sceneRows.ts`). Each scene with probes shows its own before each of its renders, and none
 * after, so a scene without probes reads none.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import { installedOr } from '../shaderPatch/litUniform.js';

export const REFLECTION_PROBE_UNIFORMS = {
  atlas: 'godotReflectionAtlas',
  probes: 'godotReflectionProbes',
} as const;

/**
 * The texture a lit material samples the atlas through. three never uploads it, as its version
 * stays 0 (three r186 `WebGLTextures.js:626`), and binds whatever handle it holds: the shown
 * scene's, or three's empty texture.
 */
class AtlasSlot extends sharedTexture(THREE.DataArrayTexture) {}

// After a dev server reloads this module, each value below is the one the earlier evaluation installed.
export const atlasSlot = installedOr(
  REFLECTION_PROBE_UNIFORMS.atlas,
  THREE.DataArrayTexture,
  () => new AtlasSlot()
);

/**
 * The shown probes' count, the atlas's border size and its last layer. Arrays, not scalars: three
 * caches a scalar uniform by its value (r186 `WebGLUniforms.js:163-173`), and `cloneUniforms` keeps a
 * typed array by reference, so every material reads these buffers.
 */
export const shownProbes = installedOr(
  REFLECTION_PROBE_UNIFORMS.probes,
  Float32Array,
  () => new Float32Array(4)
);
