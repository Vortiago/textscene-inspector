/**
 * The shared CanvasItem ritual of a 2D-canvas node (ADR-0006): a named <group>
 * with the Node2D transform, draw order, visibility and modulate context. `body`
 * draws the node's own pixels with the linear tint, inherited modulate ×
 * self_modulate, and scene children render inside the modulate provider.
 */

import { useMemo, useState, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { node2dGroupMatrix, node2dGroupProps, node2dGroupSpread } from '../node2dTransform';
import { CanvasSpaceProvider, useCanvasSpace } from '../canvasRootScope';
import { OwnCanvasModulateProvider, type CanvasItemTint } from '../canvasItemModulate';
import { useNode2DTextureSampler } from '../canvasItemTextureSampler';
import { CanvasItemSurfaceSource } from '../canvasItemSurface';
import type { CanvasItemTexture } from '../canvasItemTexture';
import { LitCanvasItemPixels, type CanvasItemPixelMaterial } from './LitCanvasItemPixels';
import { useNodePaintSequence, usePaintRange } from '../contexts/PaintOrderContext';
import { useAnimatedValue } from '../contexts/AnimatedValueContext';
import { CanvasItemProvider } from './CanvasItemGroup';
import { useCanvasItemMaterial } from './canvasItemMaterialContext';
import {
  CanvasItemChildScope,
  node2dZStep,
  useCanvasItemState,
  type CanvasItemState,
} from '../canvasItemState';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import type { CanvasItemSurface } from '../lighting2d/normalMappedLighting';
import { ClipChildrenScope } from '../../nodes/2d/canvasgroup/ClipChildrenScope';

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
   * The CanvasTexture `body` draws, if any, with the sampler it draws with. Its normal and
   * specular maps light the pixels, and without a normal map they light flat (`canvas.glsl:652-665`).
   */
  canvasTexture?: CanvasItemTexture;
  /** Whether `body` draws any pixels, true when omitted. A body that draws none declares no light read. */
  isDrawn?: boolean;
  /**
   * Draws this node's own child canvas items, each with its own light list, as a TileMapLayer's
   * rendering quadrants are. A node that draws them passes no `body`. They take this node's
   * CanvasItem state: its own-pixel tint, the material in force, sampler, `z_final` and keys.
   */
  ownItems?: (state: CanvasItemState) => ReactNode;
  children?: ReactNode;
}

export function CanvasItem2D({
  node,
  props,
  body,
  canvasTexture,
  isDrawn,
  ownItems,
  children,
}: CanvasItem2DProps) {
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
  const [surface, setSurface] = useState<CanvasItemSurface | null>(null);
  const state = useCanvasItemState({
    modulate: props.modulate,
    selfModulate: props.self_modulate,
    ...node2dZStep(props),
    material: useCanvasItemMaterial(props),
    sampler,
    lightMask: props.light_mask,
    sequence: useNodePaintSequence(node),
  });
  const paintRange = usePaintRange();
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
      <CanvasItemProvider value={key}>
        <OwnCanvasModulateProvider value={tint.canvasModulate}>
          <ClipChildrenScope mode={props.clip_children} state={state} node={node} range={paintRange}>
            {body && (
              <LitCanvasItemPixels
                material={material}
                lightMask={state.lightMask}
                zFinal={zFinal}
                surface={surface}
                isDrawn={isDrawn}
              >
                {(pixelMaterial) => body(tint, material, pixelMaterial)}
              </LitCanvasItemPixels>
            )}
            {ownItems?.(state)}
          </ClipChildrenScope>
        </OwnCanvasModulateProvider>
        {canvasTexture?.slot.texture.normalTexture && (
          <CanvasItemSurfaceSource
            slot={canvasTexture.slot}
            sampler={canvasTexture.sampler}
            onSurface={setSurface}
          />
        )}
      </CanvasItemProvider>
      <CanvasItemChildScope state={state}>
        <CanvasSpaceProvider value={canvasSpace}>{children}</CanvasSpaceProvider>
      </CanvasItemChildScope>
    </group>
  );
}
