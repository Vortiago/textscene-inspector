/**
 * A `CanvasItemPixelMaterial` as a lit canvas item hands its meshes, for a test of a material that
 * must sample the light list and take the item's blend state.
 */

import { canvasItemFacing } from '../../canvasItemFacing';
import { canvasItemLightingProps } from '../canvasItemLighting';
import { canvasItemBlendState } from '../../../resources/materials/canvasitemmaterial/renderer';
import { CanvasItemMaterialBlendMode } from '../../../godot/scene/canvasItemMaterial';
import type { CanvasItemPixelMaterial } from '../../components/LitCanvasItemPixels';

/** Additive, so a test sees the blend state apart from the default. */
export function litPixelMaterial(): CanvasItemPixelMaterial {
  const uniform = { value: null };
  return {
    ...canvasItemFacing(),
    ...canvasItemBlendState(CanvasItemMaterialBlendMode.ADD),
    ...canvasItemLightingProps({
      lightBuffer: uniform,
      shadowTintBuffer: uniform,
      isLit: uniform,
      resolution: uniform,
      canvasModulate: uniform,
      lightMode: uniform,
    }),
  };
}
