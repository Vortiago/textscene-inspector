/**
 * The leaf of every dispatch: one node's wrapper `<group>` and its registered
 * component. `NodeDispatcher.tsx` documents the walk this sits at the bottom of.
 */

import { Fragment, useCallback, useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import { joinPath } from '../utils/nodePath.js';
import {
  hasYSortDescendant,
  YSortSlotProvider,
  YSortZProvider,
  useYSortSlot,
  useYSortZContext,
} from './contexts/YSortContext.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { GenericNodeFallback } from './internal/generic-node-fallback/index';
import { placeholderUserData } from './internal/generic-node-fallback/placeholderUserData.js';
import { useCanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';
import { NodePathProvider } from './contexts/NodePathContext.js';
import { useSelection } from './contexts/SelectionContext.js';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { canvasModulateColor, CanvasModulateContext } from './canvasModulate.js';
import {
  CanvasLayerIndexProvider,
  DEFAULT_CANVAS_LAYER,
  EffectiveZProvider,
} from './lighting2d/canvasItemPlacement.js';
import { DispatchedNode, type DispatchedNodeProps } from './DispatchedNode.js';
import { fallbackTransform } from './nodeFallbackTransform.js';
import { drawsInWorkspace, isCanvasItemNode } from './nodeWorkspaceVisibility.js';

interface PlainNodeProps extends DispatchedNodeProps {
  /** Extra rendered subtree appended after the node's own inline children. */
  children?: ReactNode;
}

/**
 * Renders one non-instance node into its wrapper `<group>` + registered
 * component, dispatching its inline children and any `extraChildren` the
 * instance fallback supplies. This is the leaf of every dispatch: a merged
 * instance root (a plain node by the time it reaches here) renders through it
 * exactly like an authored node.
 */
export function PlainNode({
  node,
  path,
  children: extraChildren,
}: PlainNodeProps): ReactNode {
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  const { hiddenNodePaths, registerNodeObject, unregisterNodeObject } = useSelection();
  const workspace = useCanvasWorkspace();
  const parentSlot = useYSortSlot();
  const isHidden = hiddenNodePaths.has(path);

  const wrapperRef = useCallback(
    (object: THREE.Object3D | null) => {
      if (object) {
        registerNodeObject(path, object);
      } else {
        unregisterNodeObject(path);
      }
    },
    [path, registerNodeObject, unregisterNodeObject]
  );

  const isCanvasItem = isCanvasItemNode(node.type);
  // Memoized (before the early return, for rules-of-hooks) so the recursive
  // subtree scan for the slot distributor runs once per node, not every render.
  const hasYSortChild = useMemo(() => hasYSortDescendant(node), [node]);
  // A CanvasLayer is its OWN canvas: the root canvas's CanvasModulate does not
  // reach it, and any CanvasModulate inside it tints only this layer. The
  // subtree scan already refuses to descend into a CanvasLayer when LOOKING for
  // the tint, but the value it produced was published once for the whole tree —
  // so a HUD under a CanvasLayer took the world's night-time tint, and was lit
  // by main-canvas lights, neither of which happens in Godot.
  //
  // A light is handed to a CANVAS only when the canvas's layer falls inside the
  // light's `range_layer_min/max` window, and Godot's default window is 0..0
  // while a CanvasLayer's own default `layer` is 1 — so an untouched light
  // reaches the world and no HUD. The subtree also starts a fresh z
  // accumulation, because `_cull_canvas_item` walks each canvas from z 0.
  //
  // All three facts are one nullable, because they hold together: they are the
  // whole of "this subtree is its own canvas", and splitting them would let a
  // later change publish one without the others.
  const canvasLayer = useMemo(
    () =>
      node.type === 'CanvasLayer'
        ? {
            modulate: canvasModulateColor(node.children),
            index: (node.properties as { layer?: number }).layer ?? DEFAULT_CANVAS_LAYER,
          }
        : null,
    [node]
  );

  // A `pending` type mounts a base component, so `GenericNodeFallback`, the
  // only other place the placeholder marker is set, never runs for it. Publish
  // the marker on the wrapper, the Object3D `registerNodeObject` resolves for
  // this path. Spread, never `userData={undefined}`: that would wipe THREE's
  // own default `{}` off every other node's wrapper.
  const marker = useMemo(
    () =>
      nodeComponentRegistry.isPending(node.type) ? { userData: placeholderUserData(node) } : null,
    [node]
  );

  const rankZ = useYSortZContext();
  // The workspace split (`nodeWorkspaceVisibility`) is applied AFTER the hooks —
  // the skip is deterministic per mounted instance, but rules-of-hooks wants the
  // call order static.
  if (!drawsInWorkspace(node.type, workspace)) return null;

  // If this non-y-sort container has a y-sort descendant, divide its z-slot into a
  // tree-order sub-slot per child, so sibling y-sort subtrees (e.g. Floor vs Walls
  // under the non-y-sorted dungeon root) get DISJOINT, tree-ordered z-bands instead
  // of both landing in the same fine band. A y-sort child sorts within its slot; a
  // plain child just sits at its slot base. Pure non-y-sort scenes never distribute.
  const distribute =
    isCanvasItem &&
    (node.properties as { y_sort_enabled?: boolean }).y_sort_enabled !== true &&
    node.children.length > 0 &&
    hasYSortChild;
  // A y-sort pass hands its rank z to exactly ONE node — the item it sorted,
  // i.e. this one when `rankZ` is set. That rank is this node's whole draw
  // position; its descendants are part of the same atomic unit and draw at their
  // own z RELATIVE to it. So the rank is consumed here and cleared for the
  // subtree — leaving it in context would re-add it at every nesting level. The
  // slot is NOT reset: the y-sort pass already narrowed it to the gap before this
  // item's next-ranked sibling, which is exactly the band the subtree may use.
  const consumedRank = rankZ !== null;
  const subWidth = distribute ? parentSlot.width / node.children.length : 0;
  const inlineChildren = node.children.map((child, i) => {
    const el = <DispatchedNode key={child.name} node={child} path={joinPath(path, child.name)} />;
    return distribute ? (
      <YSortSlotProvider key={child.name} value={{ base: i * subWidth, width: subWidth }}>
        {el}
      </YSortSlotProvider>
    ) : (
      el
    );
  });

  const children: ReactNode[] = [];
  if (inlineChildren.length > 0) {
    children.push(
      consumedRank ? (
        <YSortZProvider key="__inline" value={null}>
          {inlineChildren}
        </YSortZProvider>
      ) : (
        <Fragment key="__inline">{inlineChildren}</Fragment>
      )
    );
  }
  if (extraChildren) {
    // Rank-cleared exactly like the inline children. These are an instance's
    // injected sub-scene ROOTS; leaving the parent's rank readable made every
    // root adopt it as its own z, collapsing a multi-root sub-scene onto one
    // draw position and discarding each root's own `z_index`.
    children.push(
      consumedRank ? (
        <YSortZProvider key="__extra" value={null}>
          {extraChildren}
        </YSortZProvider>
      ) : (
        <Fragment key="__extra">{extraChildren}</Fragment>
      )
    );
  }

  // The wrapper is registered (path <-> Object3D, both directions) so the
  // viewport's ONE delegated pointer-handler root can resolve which
  // node owns a raycasted mesh, and so SelectionHighlight/HoverHighlight can
  // find the Object3D for a path. Picking selects whichever node OWNS the
  // clicked geometry; if a child mesh is clicked, the child's wrapper wins
  // because `resolvePathFromObject` walks from the hit mesh UP, returning
  // the FIRST (nearest / innermost) registered ancestor.
  //
  // `NodePathProvider` makes the path available to descendant components
  // (e.g. Camera3D tags its THREE.Camera with this so the canvas can
  // later swap to it on "Use This Camera").
  //
  // `<ErrorBoundary>` isolates a thrown render exception (NaN into a
  // BufferGeometry, an unexpected GLB structure) to just THIS node instead
  // of unwinding the WHOLE R3F scene tree — `<Canvas>` mounts its own
  // react-reconciler root, so an uncaught error here would otherwise blank
  // the entire viewport, not just the offending node. `resetKeys={[node]}`
  // clears the caught error the moment a fresh parse hands this path a new
  // `node` object (e.g. the user fixed the authored data that crashed it).
  return (
    <NodePathProvider path={path}>
      <group ref={wrapperRef} visible={!isHidden} {...marker}>
        <ErrorBoundary
          resetKeys={[node]}
          fallback={() => (
            <MissingResourcePlaceholder shape="box" name={node.name} {...fallbackTransform(node)} />
          )}
        >
          <Component node={node}>
            {children.length > 0 ? (
              canvasLayer ? (
                <CanvasModulateContext.Provider value={canvasLayer.modulate}>
                  <CanvasLayerIndexProvider value={canvasLayer.index}>
                    <EffectiveZProvider value={0}>{children}</EffectiveZProvider>
                  </CanvasLayerIndexProvider>
                </CanvasModulateContext.Provider>
              ) : (
                <>{children}</>
              )
            ) : null}
          </Component>
        </ErrorBoundary>
      </group>
    </NodePathProvider>
  );
}
