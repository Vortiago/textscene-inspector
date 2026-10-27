/**
 * The texture every program samples the scene rows through (`sceneRowsChunk.ts`). Each scene with
 * probes or decals shows its own before each of its renders. three never uploads it, as its version
 * stays 0 (three r186 `WebGLTextures.js:626`), and binds whatever handle it holds: the shown scene's,
 * or three's empty texture.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import { installedOr } from '../shaderPatch/litUniform.js';

export const SCENE_ROWS_UNIFORM = 'godotSceneRows';

class SceneRowsSlot extends sharedTexture(THREE.DataTexture) {}

// After a dev server reloads this module, the value is the one the earlier evaluation installed.
export const sceneRowsSlot = installedOr(SCENE_ROWS_UNIFORM, THREE.DataTexture, () => new SceneRowsSlot());
