/**
 * What every lit program reads of the reflection probes (`probeShaderChunk.ts`): the reflection
 * atlas, the probes' rows, their count and the atlas's layout, and the drawn instance's layers. Each
 * scene with probes shows its own before each of its renders, and none after, so a scene without
 * probes reads none.
 */

import * as THREE from 'three';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../godot/visualLayers.js';
import { sharedTexture } from '../sharedTexture.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';

export const REFLECTION_PROBE_UNIFORMS = {
  atlas: 'godotReflectionAtlas',
  rows: 'godotReflectionProbeRows',
  probes: 'godotReflectionProbes',
  instanceLayers: 'godotInstanceLayers',
} as const;

/**
 * The textures a lit material samples the atlas and the rows through. three never uploads them, as
 * their version stays 0 (three r186 `WebGLTextures.js:626`), and binds whatever handle each holds:
 * the shown scene's, or three's empty texture.
 */
class AtlasSlot extends sharedTexture(THREE.DataArrayTexture) {}
class RowsSlot extends sharedTexture(THREE.DataTexture) {}

/** After a dev server reloads this module, each is the one the earlier evaluation installed. */
function installed<T>(name: string, isInstalled: (value: unknown) => value is T, make: () => T): T {
  const value = installedUniformValue(name);
  return isInstalled(value) ? value : make();
}

export const atlasSlot = installed(
  REFLECTION_PROBE_UNIFORMS.atlas,
  (value): value is THREE.DataArrayTexture => value instanceof THREE.DataArrayTexture,
  () => new AtlasSlot()
);

export const rowsSlot = installed(
  REFLECTION_PROBE_UNIFORMS.rows,
  (value): value is THREE.DataTexture => value instanceof THREE.DataTexture,
  () => new RowsSlot()
);

/**
 * The shown probes' count, the atlas's border size and its last layer. Arrays, not scalars: three
 * caches a scalar uniform by its value (r186 `WebGLUniforms.js:163-173`), and `cloneUniforms` keeps a
 * typed array by reference, so every material reads these buffers.
 */
export const shownProbes = installed(
  REFLECTION_PROBE_UNIFORMS.probes,
  (value): value is Float32Array => value instanceof Float32Array,
  () => new Float32Array(4)
);

/** The layers of the instance being drawn, Godot's default between draws. */
export const instanceLayers = installed(
  REFLECTION_PROBE_UNIFORMS.instanceLayers,
  (value): value is Uint32Array => value instanceof Uint32Array,
  () => Uint32Array.of(GODOT_DEFAULT_VISUAL_LAYERS)
);
