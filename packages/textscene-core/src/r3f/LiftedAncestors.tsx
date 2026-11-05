/**
 * Putting back what the y-sort flattening took away. An item lifted out of one
 * or more y_sort_enabled containers is re-rendered as a flat sibling of the sort
 * root, so the containers' transforms, CanvasItem state and path segments have
 * to be rebuilt around it.
 */

import { useContext, useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import { multiplyModulate, WHITE_MODULATE } from './canvasItemModulate.js';
import {
  TextureSampler2DContext,
  inheritTextureSampler,
  type AmbientTextureSampler,
} from './canvasItemTextureSampler.js';
import { SkippedCanvasItemsScope, type SkippedCanvasItems } from './canvasItemState.js';
import { node2dGroupMatrix, node2dGroupProps, node2dGroupSpread } from './node2dTransform.js';
import { CanvasSpaceProvider, useCanvasSpace } from './canvasRootScope.js';
import { joinPath } from '../utils/nodePath.js';
import { pathsAlong, useLiveDrawnChain } from './liveNodePatches.js';

/**
 * Rebuild the `<group>` transforms of the y_sort_enabled ancestors an item was lifted
 * past, outermost first, around `element`. The same `node2dGroupProps` conjugation as
 * every CanvasItem: `F·M1·F · F·M2·F = F·(M1·M2)·F`, so nesting reproduces the tree's
 * composition, skew included, with no second transform path.
 */
export function LiftedAncestors({
  liftedPast: authoredLiftedPast,
  basePath,
  children,
}: {
  liftedPast: readonly TscnNode[];
  /** The live path the lifted ancestors sit below, as {@link liftedPath} takes it. */
  basePath: string;
  children: ReactNode;
}) {
  // The properties the live scene passes bind, such as the pose a RemoteTransform2D pushes.
  const liftedPast = useLiveDrawnChain(authoredLiftedPast, basePath);
  // Flattening drops the ancestors' CanvasItem state. `visible` and `modulate` inherit
  // in Godot, so a hidden or tinted y-sorted container keeps hiding or tinting the
  // descendants lifted out of it, as its own body does through CanvasItem2D.
  // The same goes for the z the lights are culled against: `z_index` accumulates
  // down the tree, so an item lifted out of two nested containers has to be told
  // what those containers contributed before it adds its own.
  const skipped = useMemo(() => liftedCanvasItems(liftedPast), [liftedPast]);
  const parentSampler = useContext(TextureSampler2DContext);
  // The restored groups are real transforms in the rendered tree, so a canvas
  // root below them has to cancel them too (`canvasRootScope.tsx`).
  const ambient = useCanvasSpace();

  const liftedSpace = useMemo(
    () =>
      liftedPast.reduce<THREE.Matrix4 | null>((space, ancestor) => {
        const props = ancestor.properties as Partial<Node2DProperties>;
        const own = node2dGroupMatrix(
          node2dGroupProps({
            position: props.position ?? { x: 0, y: 0 },
            rotation: props.rotation ?? 0,
            scale: props.scale ?? { x: 1, y: 1 },
            skew: props.skew,
          })
        );
        return space ? space.clone().multiply(own) : own;
      }, ambient),
    [liftedPast, ambient]
  );

  let wrapped = children;
  for (let i = liftedPast.length - 1; i >= 0; i--) {
    const ancestor = liftedPast[i]!;
    const props = ancestor.properties as Partial<Node2DProperties>;
    const spread = node2dGroupSpread(
      node2dGroupProps({
        position: props.position ?? { x: 0, y: 0 },
        rotation: props.rotation ?? 0,
        scale: props.scale ?? { x: 1, y: 1 },
        skew: props.skew,
      })
    );
    wrapped = (
      // paint-order-safe: a lifted ancestor's restored transform, which
      // wraps the item's own group rather than sitting inside it.
      <group {...spread} visible={props.visible !== false}>
        {wrapped}
      </group>
    );
  }

  // The filter and repeat inherit too, innermost ancestor last so that it wins, as in the tree.
  const inheritedSampler = useMemo(
    () =>
      liftedPast.reduce<AmbientTextureSampler>((acc, a) => {
        const props = a.properties as Partial<Node2DProperties>;
        return inheritTextureSampler({ filter: props.texture_filter, repeat: props.texture_repeat }, acc);
      }, parentSampler),
    [liftedPast, parentSampler]
  );

  return (
    <SkippedCanvasItemsScope skipped={skipped}>
      <TextureSampler2DContext.Provider value={inheritedSampler}>
        <CanvasSpaceProvider value={liftedSpace}>{wrapped}</CanvasSpaceProvider>
      </TextureSampler2DContext.Provider>
    </SkippedCanvasItemsScope>
  );
}

/**
 * The lifted ancestors' `modulate` and z steps, outermost first. Only `modulate` inherits, not
 * `self_modulate`, so it applies outside the restored groups.
 */
function liftedCanvasItems(liftedPast: readonly TscnNode[]): SkippedCanvasItems {
  const props = liftedPast.map((ancestor) => ancestor.properties as Partial<Node2DProperties>);
  return {
    modulate: props.reduce((acc, p) => multiplyModulate(acc, p.modulate ?? WHITE_MODULATE), WHITE_MODULATE),
    z: props.map((p) => ({ zIndex: p.z_index ?? 0, zAsRelative: p.z_as_relative !== false })),
  };
}

/** The item's true path in the scene tree, including the levels it was lifted past. */
export function liftedPath(basePath: string, liftedPast: readonly TscnNode[], name: string): string {
  return joinPath(pathsAlong(liftedPast, basePath).at(-1) ?? basePath, name);
}
