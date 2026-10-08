/**
 * A canvas item's own pixels and their light list: the object the per-item cap measures for the
 * item's rect, and the lighting props it hands the meshes inside.
 */

import type { ReactNode } from 'react';
import { useCanvasItemLighting, type CanvasItemLightingProps } from '../lighting2d/useCanvasItemLighting';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';

interface LitCanvasItemPixelsProps {
  material: CanvasItemMaterialProperties | null;
  /** The item's `light_mask`, Godot's default 1 (`canvas_item.h:98`) when unset. */
  lightMask: number | undefined;
  /** The item's `z_final`, which a light's z window tests. */
  zFinal: number;
  children: (lighting: CanvasItemLightingProps) => ReactNode;
}

export function LitCanvasItemPixels({ material, lightMask, zFinal, children }: LitCanvasItemPixelsProps) {
  const { props, geometryRef } = useCanvasItemLighting(material, lightMask, zFinal);
  // An `object3D`, not a group: three takes a group's `renderOrder` as the draw key.
  return <object3D ref={geometryRef}>{children(props)}</object3D>;
}
