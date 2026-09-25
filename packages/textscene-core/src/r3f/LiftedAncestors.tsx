/**
 * Putting back what the y-sort flattening took away. An item lifted out of one
 * or more y_sort_enabled containers is re-rendered as a flat sibling of the sort
 * root, so the containers' transforms, CanvasItem state and path segments have
 * to be rebuilt around it.
 */

import { useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import {
  Modulate2DContext,
  multiplyModulate,
  useParentModulate,
  WHITE_MODULATE,
} from './canvasItemModulate.js';
import {
  EffectiveZProvider,
  accumulateCanvasItemZ,
  useEffectiveZ,
} from './lighting2d/canvasItemPlacement.js';
import { node2dGroupMatrix, node2dGroupProps, node2dGroupSpread } from './node2dTransform.js';
import { CanvasSpaceProvider, useCanvasSpace } from './canvasRootScope.js';
import { joinPath } from '../utils/nodePath.js';

/**
 * Rebuild the `<group>` transforms of the y_sort_enabled ancestors an item was lifted
 * past, outermost first, around `element`. The same `node2dGroupProps` conjugation as
 * every CanvasItem: `F·M1·F · F·M2·F = F·(M1·M2)·F`, so nesting reproduces the tree's
 * composition, skew included, with no second transform path.
 */
export function LiftedAncestors({
  liftedPast,
  children,
}: {
  liftedPast: readonly TscnNode[];
  children: ReactNode;
}) {
  // Flattening drops the ancestors' CanvasItem state. `visible` and `modulate` inherit
  // in Godot, so a hidden or tinted y-sorted container keeps hiding or tinting the
  // descendants lifted out of it, as its own body does through CanvasItem2D.
  const parentModulate = useParentModulate();
  // The same goes for the z the lights are culled against: `z_index` accumulates
  // down the tree, so an item lifted out of two nested containers has to be told
  // what those containers contributed before it adds its own.
  const parentEffectiveZ = useEffectiveZ();
  // The restored groups are real transforms in the rendered tree, so a canvas
  // root below them has to cancel them too (`canvasRootScope.tsx`).
  const ambient = useCanvasSpace();
  const liftedZ = useMemo(
    () =>
      liftedPast.reduce((z, ancestor) => {
        const props = ancestor.properties as Partial<Node2DProperties>;
        return accumulateCanvasItemZ(z, {
          z_index: props.z_index ?? 0,
          z_as_relative: props.z_as_relative,
        });
      }, parentEffectiveZ),
    [liftedPast, parentEffectiveZ]
  );

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

  // Only `modulate` inherits, not `self_modulate`. A colour, so it applies outside the
  // groups. Memoised for identity: the fold feeds a context, and a fresh object would
  // re-render every consumer in the lifted subtree. With no ancestors it returns
  // `parentModulate` itself.
  const inherited = useMemo(
    () =>
      liftedPast.reduce(
        (acc, a) => multiplyModulate(acc, (a.properties as Partial<Node2DProperties>).modulate ?? WHITE_MODULATE),
        parentModulate
      ),
    [liftedPast, parentModulate]
  );

  return (
    <Modulate2DContext.Provider value={inherited}>
      <EffectiveZProvider value={liftedZ}>
        <CanvasSpaceProvider value={liftedSpace}>{wrapped}</CanvasSpaceProvider>
      </EffectiveZProvider>
    </Modulate2DContext.Provider>
  );
}

/** The item's true path in the scene tree, including the levels it was lifted past. */
export function liftedPath(basePath: string, liftedPast: readonly TscnNode[], name: string): string {
  return joinPath(liftedPast.reduce((p, a) => joinPath(p, a.name), basePath), name);
}
