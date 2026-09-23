/**
 * The shared CanvasItem ritual of a 2D-canvas node (ADR-0006): a named <group>
 * with the Node2D transform, draw order, visibility and modulate context. `body`
 * draws the node's own pixels with the linear tint, inherited modulate ×
 * self_modulate, and scene children render inside the modulate provider.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { node2dGroupMatrix, node2dGroupProps, node2dGroupSpread } from '../node2dTransform';
import { CanvasSpaceProvider, useCanvasSpace } from '../canvasRootScope';
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
   * Renders this node's own pixels with the own-pixel tint and the CanvasItemMaterial
   * in force, resolved through `use_parent_material`, or `null`. A slice that ignores
   * the material draws with Godot's default MIX blending.
   */
  body?: (
    tint: CanvasItemTint,
    material: CanvasItemMaterialProperties | null,
    /**
     * Material props that sample the 2D light accumulation, spread like the blend
     * state. They declare `transparent` and are the same for every light mode and
     * count, both uniforms (`lighting2d/canvasItemLighting`).
     */
    lighting: CanvasItemLightingProps
  ) => ReactNode;
  children?: ReactNode;
}

export function CanvasItem2D({ node, props, body, children }: CanvasItem2DProps) {
  // Draw order is `renderOrder` below, which three compares before distance, so
  // every canvas item stays in the z=0 plane.
  const local = useMemo(() => node2dGroupProps(props), [props]);
  const transform = useMemo(() => node2dGroupSpread(local), [local]);
  // What a canvas root nested below this item cancels: the transform every
  // `<CanvasItem2D>` group between it and the canvas contributes.
  const ambient = useCanvasSpace();
  const canvasSpace = useMemo(() => {
    const own = node2dGroupMatrix(local);
    return ambient ? ambient.clone().multiply(own) : own;
  }, [ambient, local]);
  const material = useCanvasItemMaterial(props);
  // The canvas tint reaches this item's own pixels when its light mode admits it,
  // never the modulate its children read. The light injection divides this value
  // back out, so both come from the one hook.
  const canvasModulate = useCanvasModulateFor(material);
  const tint = useCanvasItemTint(props, canvasModulate);
  // Godot's `z_final`: the integer z_index accumulated down the tree and
  // clamped, which is both what a light's z window is tested against and the
  // bucket the draw-order key below sorts by.
  const parentEffectiveZ = useEffectiveZ();
  const effectiveZ = accumulateCanvasItemZ(parentEffectiveZ, props);
  const lighting = useCanvasItemLighting(material, props.light_mask, effectiveZ);

  // Godot's draw order on this group: three compares the nearest group's order
  // first, so the item's meshes keep their `renderOrder` for private layering,
  // such as an atlas batch's source index.
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
        {/* Descendants inherit through `use_parent_material` what this node
            resolved, a null included, which stops an inherited material. */}
        <EffectiveZProvider value={effectiveZ}>
          <CanvasItemMaterialProvider value={material}>
            <CanvasSpaceProvider value={canvasSpace}>{children}</CanvasSpaceProvider>
          </CanvasItemMaterialProvider>
        </EffectiveZProvider>
      </Modulate2DContext.Provider>
    </group>
  );
}
