/**
 * Puts back what the y-sort flattening took away. An item lifted out of one or more
 * y_sort_enabled containers is drawn as a flat sibling of the sort root, so the
 * containers' CanvasItem state and path segments are rebuilt around it.
 */

import { useContext, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { TextureSampler2DContext, inheritTextureSampler } from './canvasItemTextureSampler.js';
import { SkippedCanvasItemsScope } from './canvasItemState.js';
import { foldCanvasAncestors, INHERIT_PARENT_MATERIAL } from './canvasAncestors.js';
import {
  CanvasItemMaterialProvider,
  useCanvasAncestorMaterial,
} from './components/canvasItemMaterialContext.js';
import {
  node2DLocalTransform,
  node2dGroupPropsOf,
  node2dGroupSpread,
  threeMatrixFromTransform2D,
  type Node2DGroupProps,
} from './node2dTransform.js';
import { canvasItemFieldsOf } from './canvasItemFields.js';
import {
  multiplyTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../godot/math/transform2d.js';
import { CanvasSpaceProvider, useCanvasSpace } from './canvasRootScope.js';
import { useSceneResources } from './SceneResourcesContext.js';
import { joinPath } from '../utils/nodePath.js';
import { pathsAlong, useLiveDrawnChain } from './liveNodePatches.js';
import { useCanvasItemVisible } from './canvasItemVisible.js';
import {
  useControlTransform,
  useControlTransformsUnder,
  type ControlTransforms,
} from './contexts/ControlYSortContext.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';

/**
 * Puts back around `children` the CanvasItem state of the y_sort_enabled ancestors they were
 * lifted past, outermost first: their composed transform, modulate, z, sampler, the material a
 * `use_parent_material` item takes, and each one's visibility.
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
  const scope = useSceneResources();
  // The sort root is the parent item of the outermost lifted ancestor, so a chain that
  // defers all the way takes the root's material.
  const lifted = useMemo(
    () => foldCanvasAncestors(liftedPast, scope, INHERIT_PARENT_MATERIAL),
    [liftedPast, scope]
  );
  const groups = useMemo(
    () => liftedPast.map((ancestor) => node2dGroupPropsOf(ancestor.properties as Partial<Node2DProperties>)),
    [liftedPast]
  );
  const paths = useMemo(() => pathsAlong(liftedPast, basePath), [liftedPast, basePath]);
  const solved = useControlTransformsUnder(basePath);
  // The restored groups are real transforms in the rendered tree, so a canvas root
  // below them has to cancel them too (`canvasRootScope.tsx`).
  const ambient = useCanvasSpace();
  const liftedSpace = useMemo(() => {
    const own = threeMatrixFromTransform2D(liftedTransform(liftedPast, paths, solved));
    return ambient ? ambient.clone().multiply(own) : own;
  }, [liftedPast, paths, solved, ambient]);
  const parentSampler = useContext(TextureSampler2DContext);
  const sampler = useMemo(
    () => inheritTextureSampler(lifted.sampler, parentSampler),
    [lifted.sampler, parentSampler]
  );
  const material = useCanvasAncestorMaterial(lifted.material);

  return (
    <SkippedCanvasItemsScope skipped={lifted}>
      <CanvasItemMaterialProvider value={material}>
        <TextureSampler2DContext.Provider value={sampler}>
          <CanvasSpaceProvider value={liftedSpace}>
            <LiftedGroups chain={liftedPast} groups={groups} paths={paths}>
              {children}
            </LiftedGroups>
          </CanvasSpaceProvider>
        </TextureSampler2DContext.Provider>
      </CanvasItemMaterialProvider>
    </SkippedCanvasItemsScope>
  );
}

/**
 * The composed transform the restored groups draw in, outermost first. A Control link sits where
 * the Control walk solved it, which its properties do not state, as `LiftedGroup` places it.
 */
function liftedTransform(
  chain: readonly TscnNode[],
  paths: readonly string[],
  solved: ControlTransforms
): Transform2DColumns {
  return chain.reduce(
    (above, link, index) =>
      multiplyTransform2D(above, solved.get(paths[index]!) ?? node2DLocalTransform(canvasItemFieldsOf(link))),
    TRANSFORM2D_IDENTITY
  );
}

/**
 * `children` under one group per ancestor of `chain`, outermost first. The same `node2dGroupProps`
 * conjugation as every CanvasItem: `F·M1·F · F·M2·F = F·(M1·M2)·F`, so nesting reproduces the
 * tree's composition, skew included. One group per ancestor, since each hides on its own.
 */
function LiftedGroups({
  chain,
  groups,
  paths,
  children,
}: {
  chain: readonly TscnNode[];
  groups: readonly Node2DGroupProps[];
  paths: readonly string[];
  children: ReactNode;
}) {
  return chain.reduceRight<ReactNode>(
    (inner, ancestor, index) => (
      <LiftedGroup group={groups[index]!} ancestor={ancestor} path={paths[index]!}>
        {inner}
      </LiftedGroup>
    ),
    children
  );
}

/**
 * An ancestor's group: its transform, and its visibility as on the ordinary walk. A Control sits at
 * the transform the Control walk solved for it, which its own properties do not state.
 */
function LiftedGroup({
  group,
  ancestor,
  path,
  children,
}: {
  group: Node2DGroupProps;
  ancestor: TscnNode;
  path: string;
  children: ReactNode;
}) {
  const visible = useCanvasItemVisible(path, (ancestor.properties as Partial<Node2DProperties>).visible);
  const solved = useControlTransform(path);
  const matrix = useMemo(() => solved && threeMatrixFromTransform2D(solved), [solved]);
  if (matrix) {
    return (
      // paint-order-safe: as the group below, it wraps the item's own group.
      <group matrix={matrix} matrixAutoUpdate={false} visible={visible}>
        {children}
      </group>
    );
  }
  return (
    // paint-order-safe: a lifted ancestor's restored transform, which wraps the
    // item's own group rather than sitting inside it.
    <group {...node2dGroupSpread(group)} visible={visible}>
      {children}
    </group>
  );
}

/** The item's true path in the scene tree, including the levels it was lifted past. */
export function liftedPath(basePath: string, liftedPast: readonly TscnNode[], name: string): string {
  return joinPath(pathsAlong(liftedPast, basePath).at(-1) ?? basePath, name);
}
