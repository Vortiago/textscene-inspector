/**
 * `CanvasItemMaterial` resource slice entry point (ADR-0031): the routing claim and the
 * decode surface. The claim routes a `.tres` CanvasItemMaterial to the generic `resource`
 * slot, not the material processor, which refuses it. THREE-free: only `build.ts` imports three.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'canvasitemmaterial',
  kind: 'godot-text',
  typeNames: ['CanvasItemMaterial'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeCanvasItemMaterial } from './decode';
export {
  CanvasItemBlendMode,
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from './types';
