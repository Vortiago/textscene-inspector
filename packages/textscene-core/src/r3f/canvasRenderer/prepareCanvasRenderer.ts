/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import type { RootState } from '@react-three/fiber';
import { installTargetCopies } from '../../shaders/uniforms/textureCopies.js';
import { heldLiveTargetCopy } from '../liveTargets.js';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';
import { installGodotOpaqueOrder } from '../../shaders/pipeline/opaqueOrder.js';

/** Installs the shader patches, the live target copies and Godot's opaque order. */
export function prepareCanvasRenderer({ gl }: Pick<RootState, 'gl'>): void {
  installShaderPatches();
  installTargetCopies(heldLiveTargetCopy);
  installGodotOpaqueOrder(gl);
}
