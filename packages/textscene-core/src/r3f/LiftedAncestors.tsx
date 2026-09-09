/**
 * Putting back what the y-sort flattening took away. An item lifted out of one
 * or more y_sort_enabled containers is re-rendered as a flat sibling of the sort
 * root, so the containers' transforms, CanvasItem state and path segments have
 * to be rebuilt around it.
 */

import { useMemo, type ReactNode } from 'react';
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
import { node2dGroupProps, node2dGroupSpread } from './node2dTransform.js';
import { joinPath } from '../utils/nodePath.js';

/**
 * Rebuild the local `<group>` transforms of the y_sort_enabled ancestors an
 * item was lifted past, outermost first, around `element`.
 *
 * Deliberately the SAME `node2dGroupProps` conjugation every CanvasItem renders
 * through rather than a composed matrix of its own: `F·M1·F · F·M2·F =
 * F·(M1·M2)·F`, so nesting the groups reproduces the tree's composition exactly
 * (skew included) with no second transform path to keep in step.
 */
export function LiftedAncestors({
  liftedPast,
  children,
}: {
  liftedPast: readonly TscnNode[];
  children: ReactNode;
}) {
  // Flattening drops the ancestors' CanvasItem state along with their groups.
  // `visible` and `modulate` both inherit down the tree in Godot, so an
  // invisible or tinted y-sorted container has to keep hiding/tinting the
  // descendants that were lifted out of it — otherwise half a subtree takes the
  // tint (the ancestor's own body still goes through CanvasItem2D) and half
  // does not.
  const parentModulate = useParentModulate();
  // The same goes for the z the lights are culled against: `z_index` accumulates
  // down the tree, so an item lifted out of two nested containers has to be told
  // what those containers contributed before it adds its own.
  const parentEffectiveZ = useEffectiveZ();
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
      <group {...spread} visible={props.visible !== false}>
        {wrapped}
      </group>
    );
  }

  // `modulate` inherits; `self_modulate` does not, so only the former is folded
  // in here. Applied outside the groups because it is a colour, not a transform.
  // Memoised for its IDENTITY, not its cost: `multiplyModulate` mints a fresh
  // object, and this one feeds a context — an unmemoised fold re-renders every
  // consumer in the lifted subtree on each render with the same four numbers.
  // With no ancestors the fold returns `parentModulate` itself, so the ordinary
  // unlifted item already pays nothing.
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
      <EffectiveZProvider value={liftedZ}>{wrapped}</EffectiveZProvider>
    </Modulate2DContext.Provider>
  );
}

/** The item's true path in the scene tree, including the levels it was lifted past. */
export function liftedPath(basePath: string, liftedPast: readonly TscnNode[], name: string): string {
  return joinPath(liftedPast.reduce((p, a) => joinPath(p, a.name), basePath), name);
}
