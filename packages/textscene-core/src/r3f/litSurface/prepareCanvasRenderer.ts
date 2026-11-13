/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import type { RootState } from '@react-three/fiber';
import { installNodesHandler } from '../../shaders/nodesHandler.js';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';

/**
 * Installs the shader patches, then the nodes handler, which draws nothing until a node material
 * exists. The handler writes linear, because the compositor tone maps and encodes once (ADR-0061).
 * The 2D canvas gets both too, since a SubViewport there can hold a 3D scene.
 */
export function prepareCanvasRenderer({ gl }: RootState): void {
  installShaderPatches();
  installNodesHandler(gl, 'linear');
}
