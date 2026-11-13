/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import type { RootState } from '@react-three/fiber';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';
import { prepareLitShading } from './litShading.js';

/**
 * Installs the shader patches, then the shader module's shading, whose nodes handler draws nothing
 * until a node material exists. The 2D canvas gets both too, since a SubViewport there can hold a
 * 3D scene.
 */
export function prepareCanvasRenderer({ gl }: RootState): void {
  installShaderPatches();
  prepareLitShading(gl);
}
