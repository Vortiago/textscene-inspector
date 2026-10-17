/**
 * A canvas item's own pixels and their light list: the object the per-item cap measures for the
 * item's rect, and the one material state it hands the meshes inside.
 */

import { useMemo, type ReactNode } from 'react';
import { useCanvasItemLighting, type CanvasItemLightingProps } from '../lighting2d/useCanvasItemLighting';
import { canvasItemFacing, type CanvasItemFacing } from '../canvasItemFacing';
import {
  canvasItemBlendState,
  type CanvasItemBlendState,
} from '../../resources/materials/canvasitemmaterial/renderer';
import {
  CanvasItemBlendMode,
  type CanvasItemMaterialProperties,
} from '../../resources/materials/canvasitemmaterial/types';

/**
 * What every canvas-item mesh merges into its material, as one `materialProgramInputs` part: the
 * facing, the blend state of the material in force and the light-list sampling, in that order, so
 * the lighting's forced `transparent` wins.
 */
export type CanvasItemPixelMaterial = CanvasItemFacing & CanvasItemBlendState & CanvasItemLightingProps;

interface LitCanvasItemPixelsProps {
  material: CanvasItemMaterialProperties | null;
  /** The item's `light_mask`, Godot's default 1 (`canvas_item.h:98`) when unset. */
  lightMask: number | undefined;
  /** The item's `z_final`, which a light's z window tests. */
  zFinal: number;
  children: (pixelMaterial: CanvasItemPixelMaterial) => ReactNode;
}

export function LitCanvasItemPixels({ material, lightMask, zFinal, children }: LitCanvasItemPixelsProps) {
  const { props: lighting, geometryRef } = useCanvasItemLighting(material, lightMask, zFinal);
  const blendMode = material?.blendMode ?? CanvasItemBlendMode.MIX;
  const pixelMaterial = useMemo<CanvasItemPixelMaterial>(
    () => ({ ...canvasItemFacing(), ...canvasItemBlendState(blendMode), ...lighting }),
    [blendMode, lighting]
  );
  // An `object3D`, not a group: three takes a group's `renderOrder` as the draw key.
  return <object3D ref={geometryRef}>{children(pixelMaterial)}</object3D>;
}
