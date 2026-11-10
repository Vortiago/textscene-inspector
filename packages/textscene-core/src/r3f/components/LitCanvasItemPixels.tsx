/**
 * A canvas item's own pixels and their light list: the object the per-item cap measures for the
 * item's rect, and the material state each surface inside takes from it.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { LIT_ITEM_USER_DATA } from '../lighting2d/itemLightCap';
import { useLitItem, useSurfaceLighting, type LitItem } from '../lighting2d/useLitItem';
import type { CanvasItemLightingProps } from '../lighting2d/canvasItemLighting';
import type { CanvasItemSurface } from '../lighting2d/normalMappedLighting';
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

interface LitCanvasItemProps {
  material: CanvasItemMaterialProperties | null;
  /** The item's `light_mask`, Godot's default 1 (`canvas_item.h:98`) when unset. */
  lightMask: number | undefined;
  /** The item's `z_final`, which a light's z window tests. */
  zFinal: number;
  children: ReactNode;
}

/** What a surface inside a lit item reads: the item, and the blend state of its material. */
interface LitItemScope {
  item: LitItem;
  blendMode: CanvasItemMaterialProperties['blendMode'];
}

const LitItemScopeContext = createContext<LitItemScope | undefined>(undefined);
LitItemScopeContext.displayName = 'LitItemScopeContext';

function blendModeOf(material: CanvasItemMaterialProperties | null) {
  return material?.blendMode ?? CanvasItemMaterialBlendMode.MIX;
}

/**
 * A lit canvas item whose surfaces light themselves: each calls `useSurfacePixelMaterial` with its
 * own maps. A tile item has a surface for each atlas source it draws from.
 */
export function LitCanvasItem({ material, lightMask, zFinal, children }: LitCanvasItemProps) {
  const item = useLitItem({ material, lightMask, zFinal });
  const blendMode = blendModeOf(material);
  const scope = useMemo(() => ({ item, blendMode }), [item, blendMode]);
  // An `object3D`, not a group: three takes a group's `renderOrder` as the draw key.
  return (
    <object3D ref={item.geometryRef} userData={LIT_ITEM_USER_DATA}>
      <LitItemScopeContext.Provider value={scope}>{children}</LitItemScopeContext.Provider>
    </object3D>
  );
}

/**
 * The pixel material of a surface of the enclosing `LitCanvasItem` that draws with `surface`, or
 * with no normal map while `surface` is null.
 */
export function useSurfacePixelMaterial(surface: CanvasItemSurface | null): CanvasItemPixelMaterial {
  const scope = useContext(LitItemScopeContext);
  if (!scope) throw new Error('expected a LitCanvasItem around the surface, found none');
  const { item, blendMode } = scope;
  const lighting = useSurfaceLighting(item, surface);
  return useMemo(
    () => ({ ...canvasItemFacing(), ...canvasItemBlendState(blendMode), ...lighting }),
    [blendMode, lighting]
  );
}

interface LitCanvasItemPixelsProps extends Omit<LitCanvasItemProps, 'children'> {
  /** The normal and specular maps of the item's pixels, or null to light them flat. */
  surface?: CanvasItemSurface | null;
  /** A render prop for a mesh that merges the pixel material itself, else leaves read the context. */
  children: ReactNode | ((pixelMaterial: CanvasItemPixelMaterial) => ReactNode);
}

/** A lit canvas item whose pixels are one surface. */
export function LitCanvasItemPixels({ surface = null, children, ...item }: LitCanvasItemPixelsProps) {
  return (
    <LitCanvasItem {...item}>
      <SurfacePixels surface={surface}>{children}</SurfacePixels>
    </LitCanvasItem>
  );
}

/** The one surface of a `LitCanvasItemPixels`, which hands its pixel material to the meshes inside. */
function SurfacePixels({
  surface,
  children,
}: Pick<LitCanvasItemPixelsProps, 'children'> & { surface: CanvasItemSurface | null }) {
  const pixelMaterial = useSurfacePixelMaterial(surface);
  return (
    <CanvasItemPixelMaterialContext.Provider value={pixelMaterial}>
      {typeof children === 'function' ? children(pixelMaterial) : children}
    </CanvasItemPixelMaterialContext.Provider>
  );
}
