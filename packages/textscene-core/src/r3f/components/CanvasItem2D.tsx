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
import { node2dGroupProps, node2dGroupSpread } from '../node2dTransform';
import { Modulate2DContext, useCanvasItemTint, type CanvasItemTint } from '../canvasItemModulate';
import { useCanvasModulateFor } from '../canvasModulate';
import {
  useCanvasItemLighting,
  type CanvasItemLightingProps,
} from '../lighting2d/useCanvasItemLighting';
import {
  EffectiveZProvider,
  accumulateCanvasItemZ,
  useEffectiveZ,
} from '../lighting2d/canvasItemPlacement';
import { useCanvasItemRenderOrder } from '../contexts/PaintOrderContext';
import { CanvasItemKeyProvider } from './CanvasItemGroup';
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
  // Draw order does NOT ride the group's z — it is `renderOrder` below, which
  // three compares before camera distance. The group stays in the z=0 plane
  // with every other canvas item, so a 2D scene occupies no depth at all.
  const transform = useMemo(() => node2dGroupSpread(node2dGroupProps(props)), [props]);
  const material = useCanvasItemMaterial(props);
  // The canvas tint rides this item's own pixels only, and only when its light
  // mode admits it — never the inherited modulate its children read. The light
  // injection divides this same value back out to recover the albedo, so the
  // two must be resolved from the one hook.
  const canvasModulate = useCanvasModulateFor(material);
  const tint = useCanvasItemTint(props, canvasModulate);
  // Godot's `z_final`: the integer z_index accumulated down the tree and
  // clamped, which is both what a light's z window is tested against and the
  // bucket the draw-order key below sorts by.
  const parentEffectiveZ = useEffectiveZ();
  const effectiveZ = accumulateCanvasItemZ(parentEffectiveZ, props);
  const lighting = useCanvasItemLighting(material, props.light_mask, effectiveZ);

  // Godot's draw order, as the one integer three sorts on. It rides THIS group
  // rather than the pixels inside it: three takes `groupOrder` from the nearest
  // enclosing group and compares it before anything else, so the item's own
  // meshes are free to use their `renderOrder` for the item's private layering
  // (an atlas batch's source index) without touching its place in the canvas.
  const renderOrder = useCanvasItemRenderOrder(node, effectiveZ);

  return (
    <group
      name={node.name}
      {...transform}
      visible={props.visible !== false}
      renderOrder={renderOrder}
    >
      <CanvasItemKeyProvider value={renderOrder}>{body?.(tint, material, lighting)}</CanvasItemKeyProvider>
      <Modulate2DContext.Provider value={tint.inherited}>
        {/* Descendants inherit this node's material through `use_parent_material`,
            so the provider carries what THIS node resolved — including a null,
            which correctly stops an inherited material at a node that clears it. */}
        <EffectiveZProvider value={effectiveZ}>
          <CanvasItemMaterialProvider value={material}>{children}</CanvasItemMaterialProvider>
        </EffectiveZProvider>
      </Modulate2DContext.Provider>
    </group>
  );
}
