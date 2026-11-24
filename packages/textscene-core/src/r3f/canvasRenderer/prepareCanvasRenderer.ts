/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import type { RootState } from '@react-three/fiber';
import { installTargetCopies } from '../../shaders/uniforms/textureCopies.js';
import { heldLiveTargetCopy } from '../liveTargets.js';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';
import { installGodotOpaqueOrder } from '../../shaders/pipeline/opaqueOrder.js';
import { installGodotPolygonMode } from '../../shaders/pipeline/polygonMode.js';

/** Installs the shader patches, the live target copies, Godot's opaque order and its polygon mode. */
export function prepareCanvasRenderer({ gl }: Pick<RootState, 'gl'>): void {
  installShaderPatches();
  installTargetCopies(heldLiveTargetCopy);
  installGodotOpaqueOrder(gl);
  installGodotPolygonMode(gl);
}
