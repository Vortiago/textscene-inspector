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
import { node2dGroupProps, node2dGroupSpread, threeMatrixFromTransform2D } from './node2dTransform.js';
import { CanvasSpaceProvider, useCanvasSpace } from './canvasRootScope.js';
import { useSceneResources } from './SceneResourcesContext.js';
import { joinPath } from '../utils/nodePath.js';
import { pathsAlong, useLiveDrawnChain } from './liveNodePatches.js';
import { useAnimatedValueAt } from './contexts/AnimatedValueContext.js';
import { useOptionalSelection } from './contexts/SelectionContext.js';
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
  const matrix = useMemo(() => threeMatrixFromTransform2D(lifted.transform), [lifted.transform]);
  // The restored group is a real transform in the rendered tree, so a canvas root
  // below it has to cancel it too (`canvasRootScope.tsx`).
  const ambient = useCanvasSpace();
  const liftedSpace = useMemo(() => (ambient ? ambient.clone().multiply(matrix) : matrix), [ambient, matrix]);
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
            <LiftedGroups chain={liftedPast} basePath={basePath}>
              {children}
            </LiftedGroups>
          </CanvasSpaceProvider>
        </TextureSampler2DContext.Provider>
      </CanvasItemMaterialProvider>
    </SkippedCanvasItemsScope>
  );
}

/**
 * `children` under one group per ancestor of `chain`, outermost first. The same `node2dGroupProps`
 * conjugation as every CanvasItem: `F·M1·F · F·M2·F = F·(M1·M2)·F`, so nesting reproduces the
 * tree's composition, skew included. One group per ancestor, since each hides on its own.
 */
function LiftedGroups({
  chain,
  basePath,
  children,
}: {
  chain: readonly TscnNode[];
  basePath: string;
  children: ReactNode;
}) {
  const paths = useMemo(() => pathsAlong(chain, basePath), [chain, basePath]);
  return chain.reduceRight<ReactNode>(
    (inner, ancestor, index) => (
      <LiftedGroup ancestor={ancestor} path={paths[index]!}>
        {inner}
      </LiftedGroup>
    ),
    children
  );
}

/**
 * `ancestor`'s transform, and its visibility as its own group hides its descendants on the
 * ordinary walk: its `visible`, a pushed `visible`, or the eye toggle.
 */
function LiftedGroup({
  ancestor,
  path,
  children,
}: {
  ancestor: TscnNode;
  path: string;
  children: ReactNode;
}) {
  const props = ancestor.properties as Partial<Node2DProperties>;
  const spread = useMemo(
    () =>
      node2dGroupSpread(
        node2dGroupProps({
          position: props.position ?? { x: 0, y: 0 },
          rotation: props.rotation ?? 0,
          scale: props.scale ?? { x: 1, y: 1 },
          skew: props.skew,
        })
      ),
    [props]
  );
  const animated = useAnimatedValueAt(path, 'visible', (value) => value[0] !== 0);
  const isHidden = useOptionalSelection()?.hiddenNodePaths.has(path) ?? false;
  const visible = (animated ?? props.visible !== false) && !isHidden;
  return (
    // paint-order-safe: a lifted ancestor's restored transform, which wraps the
    // item's own group rather than sitting inside it.
    <group {...spread} visible={visible}>
      {children}
    </group>
  );
}

/** The item's true path in the scene tree, including the levels it was lifted past. */
export function liftedPath(basePath: string, liftedPast: readonly TscnNode[], name: string): string {
  return joinPath(pathsAlong(liftedPast, basePath).at(-1) ?? basePath, name);
}
