/**
 * <CanvasItem2D> — the shared CanvasItem ritual for 2D-canvas nodes: a named
 * <group> carrying the conjugated Node2D transform (see node2dTransform) with
 * the z_index draw-order offset, visibility, and the hierarchical modulate
 * context. The node's own pixels render through the `body` render-prop, which
 * receives the resolved linear-space tint (inherited modulate × self_modulate);
 * scene children render inside the inherited-modulate provider. Extracted from
 * the sprite slices (ADR-0006); TileMap/TileMapLayer are further consumers.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { node2dGroupProps, node2dGroupSpread, canvasItemZ } from '../node2dTransform';
import { Modulate2DContext, useCanvasItemTint, type CanvasItemTint } from '../canvasItemModulate';
import { useYSortZContext, useYSortSlot } from '../contexts/YSortContext';
import { useCanvasModulateFor } from '../canvasModulate';
import {
  useCanvasItemLighting,
  type CanvasItemLightingProps,
} from '../lighting2d/useCanvasItemLighting';
import {
  CanvasItemMaterialProvider,
  useCanvasItemMaterial,
} from './canvasItemMaterialContext';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';

export interface CanvasItem2DProps {
  node: TscnNode;
  props: Node2DProperties;
  /**
   * Renders this node's own pixels with the resolved own-pixel tint and the
   * CanvasItemMaterial in force (already resolved through `use_parent_material`,
   * `null` when there is none). A slice that ignores the material draws with
   * Godot's default MIX blending, which is what it did before the material
   * existed.
   */
  body?: (
    tint: CanvasItemTint,
    material: CanvasItemMaterialProperties | null,
    /**
     * Material props that make this item sample the 2D light accumulation.
     * Spread onto the item's material like the blend state; empty when the
     * scene has no lights or the item is `Unshaded`.
     */
    lighting: CanvasItemLightingProps
  ) => ReactNode;
  children?: ReactNode;
}

export function CanvasItem2D({ node, props, body, children }: CanvasItem2DProps) {
  const zSortZ = useYSortZContext();
  const slot = useYSortSlot();
  // When y-sort provides a rank-based z offset, use it directly — the tree-order slot
  // base is already baked into the enclosing y-sort group's z, so adding it here would
  // double-count. Otherwise (a leaf CanvasItem sitting directly in a tree-order slot,
  // e.g. a top-level TileMapLayer between two y-sort subtrees) shift by the slot base so
  // it lands in its slot rather than the shared layer base.
  const z = zSortZ !== null
    ? zSortZ
    : canvasItemZ(props) + slot.base;
  const transform = useMemo(
    () => node2dGroupSpread(node2dGroupProps(props, z)),
    [props, z]
  );
  const material = useCanvasItemMaterial(props);
  // The canvas tint rides this item's own pixels only, and only when its light
  // mode admits it — never the inherited modulate its children read. The light
  // injection divides this same value back out to recover the albedo, so the
  // two must be resolved from the one hook.
  const canvasModulate = useCanvasModulateFor(material);
  const tint = useCanvasItemTint(props, canvasModulate);
  const lighting = useCanvasItemLighting(material);

  return (
    <group name={node.name} {...transform} visible={props.visible !== false}>
      {body?.(tint, material, lighting)}
      <Modulate2DContext.Provider value={tint.inherited}>
        {/* Descendants inherit this node's material through `use_parent_material`,
            so the provider carries what THIS node resolved — including a null,
            which correctly stops an inherited material at a node that clears it. */}
        <CanvasItemMaterialProvider value={material}>{children}</CanvasItemMaterialProvider>
      </Modulate2DContext.Provider>
    </group>
  );
}
