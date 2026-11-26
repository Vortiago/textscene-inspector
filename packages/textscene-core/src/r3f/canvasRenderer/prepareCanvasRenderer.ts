/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import type { RootState } from '@react-three/fiber';
import { installTargetCopies } from '../../shaders/uniforms/textureCopies.js';
import { heldLiveTargetCopy } from '../liveTargets.js';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';
import { installGodotOpaqueOrder } from '../../shaders/pipeline/opaqueOrder.js';
import { installGodotPolygonMode } from '../../shaders/pipeline/polygonMode.js';
import { decideStoredDepthRead } from '../directionalShadow/storedDepthRead.js';
import { formatDirectionalShadowColour } from '../directionalShadow/shadowAtlas.js';

/** Decides the stored depth's read, which the patches follow, then installs every renderer hook. */
export function prepareCanvasRenderer({ gl }: Pick<RootState, 'gl'>): void {
  formatDirectionalShadowColour(decideStoredDepthRead(gl));
  installShaderPatches();
  installTargetCopies(heldLiveTargetCopy);
  installGodotOpaqueOrder(gl);
  installGodotPolygonMode(gl);
}
