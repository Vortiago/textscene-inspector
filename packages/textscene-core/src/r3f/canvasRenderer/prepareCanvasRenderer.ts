/** The one `onCreated` of every canvas: what its renderer needs before its first frame. */

import type { RootState } from '@react-three/fiber';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';
import { installGodotOpaqueOrder } from '../../shaders/pipeline/opaqueOrder.js';

/** Installs the shader patches and Godot's opaque order. A node material's user loads the nodes handler. */
export function prepareCanvasRenderer({ gl }: Pick<RootState, 'gl'>): void {
  installShaderPatches();
  installGodotOpaqueOrder(gl);
}
