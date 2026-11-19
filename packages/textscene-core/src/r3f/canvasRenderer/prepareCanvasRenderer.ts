/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import { installTargetCopies } from '../../shaders/uniforms/textureCopies.js';
import { heldLiveTargetCopy } from '../liveTargets.js';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';

/** A node material's user loads the nodes handler itself (`canvasNodesHandler.ts`). */
export function prepareCanvasRenderer(): void {
  installShaderPatches();
  installTargetCopies(heldLiveTargetCopy);
}
