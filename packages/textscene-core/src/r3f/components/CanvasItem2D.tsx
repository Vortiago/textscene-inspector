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
import { TextureSampler2DContext, useNode2DTextureSampler } from '../canvasItemTextureSampler';
import { LitCanvasItemPixels, type CanvasItemPixelMaterial } from './LitCanvasItemPixels';
import { EffectiveZProvider, accumulateCanvasItemZ, useEffectiveZ } from '../lighting2d/canvasItemPlacement';
import { useCanvasItemRenderOrder } from '../contexts/PaintOrderContext';
import { useAnimatedValue } from '../contexts/AnimatedValueContext';
import { CanvasItemKeyProvider } from './CanvasItemGroup';
import { CanvasItemMaterialProvider, useCanvasItemMaterial } from './canvasItemMaterialContext';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';

interface CanvasItem2DProps {
  node: TscnNode;
  props: Node2DProperties;
  /**
   * Renders this node's own pixels with the own-pixel tint and the CanvasItemMaterial
   * in force, resolved through `use_parent_material`, or `null`. Each mesh merges
   * `pixelMaterial`, which carries that material's blend state and the light list.
   */
  body?: (
    tint: CanvasItemTint,
    material: CanvasItemMaterialProperties | null,
    pixelMaterial: CanvasItemPixelMaterial
  ) => ReactNode;
  /**
   * Draws this node's own child canvas items, each with its own light list, as a TileMapLayer's
   * rendering quadrants are. A node that draws them passes no `body`. They take the own-pixel tint,
   * the material in force and this node's `z_final`.
   */
  ownItems?: (
    tint: CanvasItemTint,
    material: CanvasItemMaterialProperties | null,
    zFinal: number
  ) => ReactNode;
  children?: ReactNode;
}

export function CanvasItem2D({ node, props, body, ownItems, children }: CanvasItem2DProps) {
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
  // What this node's descendants inherit. Its own pixels sample through the same fold, which the
  // node's component takes before this group exists, so it repeats the call on its own properties.
  const sampler = useNode2DTextureSampler(props);
  // Godot's `z_final`: the integer z_index accumulated down the tree and
  // clamped, which is both what a light's z window is tested against and the
  // bucket the draw-order key below sorts by.
  const parentEffectiveZ = useEffectiveZ();
  const effectiveZ = accumulateCanvasItemZ(parentEffectiveZ, props);

  // Godot's draw order on this group: three compares the nearest group's order
  // first, so the item's meshes keep their `renderOrder` for private layering,
  // such as an atlas batch's source index.
  const renderOrder = useCanvasItemRenderOrder(node, effectiveZ);
  // A pushed `visible` takes the place of the authored one, as for a Node3D.
  const animatedVisible = useAnimatedValue('visible', (value) => value[0] !== 0);

  return (
    <group
      name={node.name}
      {...transform}
      visible={animatedVisible ?? props.visible !== false}
      renderOrder={renderOrder}
    >
      <CanvasItemKeyProvider value={renderOrder}>
        {body && (
          <LitCanvasItemPixels material={material} lightMask={props.light_mask} zFinal={effectiveZ}>
            {(pixelMaterial) => body(tint, material, pixelMaterial)}
          </LitCanvasItemPixels>
        )}
        {ownItems?.(tint, material, effectiveZ)}
      </CanvasItemKeyProvider>
      <Modulate2DContext.Provider value={tint.inherited}>
        {/* Descendants inherit through `use_parent_material` what this node
            resolved, a null included, which stops an inherited material. */}
        <EffectiveZProvider value={effectiveZ}>
          <CanvasItemMaterialProvider value={material}>
            <TextureSampler2DContext.Provider value={sampler}>
              <CanvasSpaceProvider value={canvasSpace}>{children}</CanvasSpaceProvider>
            </TextureSampler2DContext.Provider>
          </CanvasItemMaterialProvider>
        </EffectiveZProvider>
      </Modulate2DContext.Provider>
    </group>
  );
}
