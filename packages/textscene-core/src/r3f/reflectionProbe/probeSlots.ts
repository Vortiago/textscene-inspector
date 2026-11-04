/**
 * What every lit program reads of the reflection probes (`probeShaderChunk.ts`): the reflection
 * atlas, and their count and the atlas's layout. The probes' rows are in the scene rows
 * (`sceneRows.ts`). Each scene with probes shows its own before each of its renders, and none
 * after, so a scene without probes reads none.
 */

import * as THREE from 'three';
import { installedSlot } from '../sharedTexture.js';
import { installedOr } from '../shaderPatch/litUniform.js';

export const REFLECTION_PROBE_UNIFORMS = {
  atlas: 'godotReflectionAtlas',
  probes: 'godotReflectionProbes',
} as const;

/**
 * The texture a lit material samples the atlas through. three never uploads it, as its version
 * stays 0 (three r187 `WebGLTextures.js:653`), and binds whatever handle it holds: the shown
 * scene's, or three's empty texture.
 */
export const atlasSlot = installedSlot(REFLECTION_PROBE_UNIFORMS.atlas, THREE.DataArrayTexture);

/** The exposure a render with no CameraAttributes writes, which shows each probe at 1 (`light_storage.cpp:1810`). */
export const NO_RENDER_EXPOSURE = -1;

/**
 * The shown probes' count, the atlas's border size, its last layer, and the exposure of the render,
 * `NO_RENDER_EXPOSURE` for none. Arrays, not scalars: three
 * caches a scalar uniform by its value (r187 `WebGLUniforms.js:165-175`), and `cloneUniforms` keeps a
 * typed array by reference, so every material reads these buffers. After a dev server reloads this
 * module, it is the buffer the earlier evaluation installed.
 */
export const shownProbes = installedOr(
  REFLECTION_PROBE_UNIFORMS.probes,
  Float32Array,
  () => new Float32Array(4)
);
