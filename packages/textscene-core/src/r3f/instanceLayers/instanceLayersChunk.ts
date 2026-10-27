/**
 * The layers of the instance being drawn, in every program that tests a mask against them: the
 * reflection probes' (`probeShaderChunk.ts`) and the decals' (`decalShaderChunk.ts`). The draw hooks
 * write the value (`instanceLayers.ts`), and Godot's default holds between draws.
 */

import * as THREE from 'three';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../godot/scene/visualLayers.js';
import { FOG_UNIFORMS_MERGE, installedOr, installMergedUniform } from '../shaderPatch/litUniform.js';

export const INSTANCE_LAYERS_UNIFORM = 'godotInstanceLayers';

/** The chunk that declares the uniform, which each patch that reads it includes. */
export const INSTANCE_LAYERS_CHUNK = 'godot_instance_layers_pars';

/**
 * Guarded, so a program that includes it from two patches declares the uniform once. An array of one,
 * not a scalar, so every material reads the one buffer (`decalSlots.ts` says why).
 */
const INSTANCE_LAYERS_GLSL = /* glsl */ `
#ifndef GODOT_INSTANCE_LAYERS
#define GODOT_INSTANCE_LAYERS
uniform uint ${INSTANCE_LAYERS_UNIFORM}[ 1 ];
#endif
`;

// After a dev server reloads this module, the value is the one the earlier evaluation installed.
export const instanceLayers = installedOr(INSTANCE_LAYERS_UNIFORM, Uint32Array, () =>
  Uint32Array.of(GODOT_DEFAULT_VISUAL_LAYERS)
);

/**
 * Declares the layers uniform for a patch to include, and gives it to every program with a fog
 * uniform, which is every program a surface or a helper draws with. True: it cannot fail. A second
 * call changes nothing.
 */
export function installInstanceLayers(): boolean {
  Object.assign(THREE.ShaderChunk, { [INSTANCE_LAYERS_CHUNK]: INSTANCE_LAYERS_GLSL });
  installMergedUniform(FOG_UNIFORMS_MERGE, INSTANCE_LAYERS_UNIFORM, instanceLayers);
  return true;
}
