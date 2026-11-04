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
import type { CanvasItemTint } from '../canvasItemModulate';
import { useNode2DTextureSampler } from '../canvasItemTextureSampler';
import { LitCanvasItemPixels, type CanvasItemPixelMaterial } from './LitCanvasItemPixels';
import { useNodePaintSequence } from '../contexts/PaintOrderContext';
import { useAnimatedValue } from '../contexts/AnimatedValueContext';
import { CanvasItemKeyProvider } from './CanvasItemGroup';
import { useCanvasItemMaterial } from './canvasItemMaterialContext';
import { CanvasItemChildScope, useCanvasItemState } from '../canvasItemState';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import type { CanvasItemSurface } from '../lighting2d/normalMappedLighting';

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
  /** The normal and specular maps `body` lights its pixels with, or null to light them flat. */
  surface?: CanvasItemSurface | null;
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

export function CanvasItem2D({ node, props, body, surface = null, ownItems, children }: CanvasItem2DProps) {
  const local = useMemo(() => node2dGroupProps(props), [props]);
  const transform = useMemo(() => node2dGroupSpread(local), [local]);
  // What a canvas root nested below this item cancels: the transform every
  // `<CanvasItem2D>` group between it and the canvas contributes.
  const ambient = useCanvasSpace();
  const canvasSpace = useMemo(() => {
    const own = node2dGroupMatrix(local);
    return ambient ? ambient.clone().multiply(own) : own;
  }, [ambient, local]);
  // What this node's descendants inherit. Its own pixels sample through the same fold, which the
  // node's component takes before this group exists, so it repeats the call on its own properties.
  const sampler = useNode2DTextureSampler(props);
  const state = useCanvasItemState({
    modulate: props.modulate,
    selfModulate: props.self_modulate,
    zIndex: props.z_index,
    zAsRelative: props.z_as_relative,
    material: useCanvasItemMaterial(props),
    sampler,
    lightMask: props.light_mask,
    sequence: useNodePaintSequence(node),
  });
  const { key, zFinal, tint, material } = state;
  // A pushed `visible` takes the place of the authored one, as for a Node3D.
  const animatedVisible = useAnimatedValue('visible', (value) => value[0] !== 0);

  // Draw order is `renderOrder`, which three compares before distance, so every canvas item
  // stays in the z=0 plane. three compares the nearest group's order first, so the item's meshes
  // keep their own `renderOrder` for private layering, such as an atlas batch's source index.
  return (
    <group
      name={node.name}
      {...transform}
      visible={animatedVisible ?? props.visible !== false}
      renderOrder={key}
    >
      <CanvasItemKeyProvider value={key}>
        {body && (
          <LitCanvasItemPixels
            material={material}
            lightMask={state.lightMask}
            zFinal={zFinal}
            surface={surface}
          >
            {(pixelMaterial) => body(tint, material, pixelMaterial)}
          </LitCanvasItemPixels>
        )}
        {ownItems?.(tint, material, zFinal)}
      </CanvasItemKeyProvider>
      <CanvasItemChildScope state={state}>
        <CanvasSpaceProvider value={canvasSpace}>{children}</CanvasSpaceProvider>
      </CanvasItemChildScope>
    </group>
  );
}
