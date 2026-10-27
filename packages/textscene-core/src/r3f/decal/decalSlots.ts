/**
 * What every program reads of the decals (`decalShaderChunk.ts`): the decal atlas, the decals' rows,
 * and their count and mipmap bias. Each scene with decals shows its own before each of its renders,
 * and none after, so a scene without decals reads none.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import { installedOr } from '../shaderPatch/litUniform.js';

export const DECAL_UNIFORMS = {
  atlas: 'godotDecalAtlas',
  rows: 'godotDecalRows',
  shown: 'godotDecals',
} as const;

/**
 * The textures a program samples the atlas and the rows through. three never uploads them, as their
 * version stays 0 (three r186 `WebGLTextures.js:626`), and binds whatever handle each holds: the
 * shown scene's, or three's empty texture.
 */
class AtlasSlot extends sharedTexture(THREE.DataTexture) {}
class RowsSlot extends sharedTexture(THREE.DataTexture) {}

// After a dev server reloads this module, each value below is the one the earlier evaluation installed.
export const decalAtlasSlot = installedOr(DECAL_UNIFORMS.atlas, THREE.DataTexture, () => new AtlasSlot());

export const decalRowsSlot = installedOr(DECAL_UNIFORMS.rows, THREE.DataTexture, () => new RowsSlot());

/** The `shownDecals` slot that holds the number of shown decals. */
export const SHOWN_COUNT = 0;
/** The `shownDecals` slot that holds the viewport's `texture_mipmap_bias`. */
export const SHOWN_MIPMAP_BIAS = 1;

/**
 * The shown decals' count and the mipmap bias of the render. An array, not scalars: three caches a
 * scalar uniform by its value (r186 `WebGLUniforms.js:163-173`), and `cloneUniforms` keeps a typed
 * array by reference, so every material reads this buffer.
 */
export const shownDecals = installedOr(DECAL_UNIFORMS.shown, Float32Array, () => new Float32Array(4));
