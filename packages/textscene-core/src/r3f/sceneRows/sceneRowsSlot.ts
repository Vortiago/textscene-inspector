/**
 * The texture every program samples the scene rows through (`sceneRowsChunk.ts`). Each scene with
 * probes or decals shows its own before each of its renders. three never uploads it, as its version
 * stays 0 (three r186 `WebGLTextures.js:626`), and binds whatever handle it holds: the shown scene's,
 * or three's empty texture.
 */

import * as THREE from 'three';
import { installedSlot } from '../sharedTexture.js';

export const SCENE_ROWS_UNIFORM = 'godotSceneRows';

export const sceneRowsSlot = installedSlot(SCENE_ROWS_UNIFORM, THREE.DataTexture);
