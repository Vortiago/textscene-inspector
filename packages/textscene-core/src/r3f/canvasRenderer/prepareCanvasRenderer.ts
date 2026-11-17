/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';

/** Installs the shader patches. A node material's user loads the nodes handler (`canvasNodesHandler.ts`). */
export function prepareCanvasRenderer(): void {
  installShaderPatches();
}
