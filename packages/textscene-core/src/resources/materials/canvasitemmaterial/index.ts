/**
 * `CanvasItemMaterial` resource slice entry point (ADR-0031): the routing claim
 * plus the decode surface. THREE-free — `build.ts` is the only file here that
 * imports three, and nothing routing-side may pull it in.
 *
 * The claim is what makes an `[ext_resource] type="CanvasItemMaterial"` load:
 * the substring routing this replaces sent it to the material processor (which
 * builds THREE materials and refuses it), so a working decode sat behind a
 * permanent missing-resources row. A `.tres` CanvasItemMaterial is a
 * ParsedResource — the generic `resource` slot — and this slice's decode gives
 * that body meaning.
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
