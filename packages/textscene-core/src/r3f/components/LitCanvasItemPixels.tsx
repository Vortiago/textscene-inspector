/**
 * A canvas item's own pixels and their light list: the object the per-item cap measures for the
 * item's rect, and the one material state it hands the meshes inside.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { LIT_ITEM_USER_DATA } from '../lighting2d/itemLightCap';
import { useCanvasItemLighting, type CanvasItemLightingProps } from '../lighting2d/useCanvasItemLighting';
import { canvasItemFacing, type CanvasItemFacing } from '../canvasItemFacing';
import {
  canvasItemBlendState,
  type CanvasItemBlendState,
} from '../../resources/materials/canvasitemmaterial/renderer';
import { type CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import { CanvasItemMaterialBlendMode } from '../../godot/scene/canvasItemMaterial';

/**
 * What every canvas-item mesh merges into its material, as one `materialProgramInputs` part: the
 * facing, the blend state of the material in force and the light-list sampling, in that order, so
 * the lighting's forced `transparent` wins.
 */
export type CanvasItemPixelMaterial = CanvasItemFacing & CanvasItemBlendState & CanvasItemLightingProps;

/** Undefined outside a lit item, where a mesh stays unlit as every 3D consumer needs. */
const CanvasItemPixelMaterialContext = createContext<CanvasItemPixelMaterial | undefined>(undefined);
CanvasItemPixelMaterialContext.displayName = 'CanvasItemPixelMaterialContext';

/**
 * The pixel material of the enclosing lit canvas item, for a leaf mesh deep inside a painter that
 * the item's `children` render prop does not reach.
 *
 * @canonical The lit pixel material of the enclosing canvas item
 */
export function useCanvasItemPixelMaterial(): CanvasItemPixelMaterial | undefined {
  return useContext(CanvasItemPixelMaterialContext);
}

/**
 * The `materialProgramInputs` `merge` of a leaf mesh in a canvas item: the facing, then the lit
 * pixel material of the enclosing item. A leaf outside one stays unlit.
 */
export function useCanvasItemMerge(): [CanvasItemFacing, CanvasItemPixelMaterial | undefined] {
  const pixelMaterial = useCanvasItemPixelMaterial();
  return useMemo(() => [canvasItemFacing(), pixelMaterial], [pixelMaterial]);
}

interface LitCanvasItemPixelsProps {
  material: CanvasItemMaterialProperties | null;
  /** The item's `light_mask`, Godot's default 1 (`canvas_item.h:98`) when unset. */
  lightMask: number | undefined;
  /** The item's `z_final`, which a light's z window tests. */
  zFinal: number;
  /** A render prop for a mesh that merges the pixel material itself, else leaves read the context. */
  children: ReactNode | ((pixelMaterial: CanvasItemPixelMaterial) => ReactNode);
}

export function LitCanvasItemPixels({ material, lightMask, zFinal, children }: LitCanvasItemPixelsProps) {
  const { props: lighting, geometryRef } = useCanvasItemLighting(material, lightMask, zFinal);
  const blendMode = material?.blendMode ?? CanvasItemMaterialBlendMode.MIX;
  const pixelMaterial = useMemo<CanvasItemPixelMaterial>(
    () => ({ ...canvasItemFacing(), ...canvasItemBlendState(blendMode), ...lighting }),
    [blendMode, lighting]
  );
  // An `object3D`, not a group: three takes a group's `renderOrder` as the draw key.
  return (
    <object3D ref={geometryRef} userData={LIT_ITEM_USER_DATA}>
      <CanvasItemPixelMaterialContext.Provider value={pixelMaterial}>
        {typeof children === 'function' ? children(pixelMaterial) : children}
      </CanvasItemPixelMaterialContext.Provider>
    </object3D>
  );
}
