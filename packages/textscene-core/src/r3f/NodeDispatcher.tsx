/**
 * Recursive walker that turns a parsed SceneGraph into a React tree.
 *
 * For each TscnNode in the scene's root list:
 *   1. Look up `nodeComponentRegistry.get(node.type)`.
 *   2. If a component is registered, render it with the node's pre-walked
 *      children passed as `children`.
 *   3. If `node.instance` is set (an `ExtResource("scene_id")` ref), also
 *      asynchronously load the referenced PackedScene and inject its
 *      root nodes as additional children of the instancing node. This is
 *      how Godot's external-scene composition (`integration-three-cubes.tscn`
 *      → `child_cube.tscn`) is rendered.
 *   4. Otherwise render `<GenericNodeFallback>` so unknown types stay
 *      visible in the viewport.
 *
 * The dispatcher itself only renders nodes; it does NOT mount a `<Canvas>`
 * or any context providers — those are owned by `<TscnCanvas>` and
 * `<TscnPreviewShell>` respectively.
 *
 * Event delegation: the WHOLE dispatched tree is wrapped in ONE
 * root `<group>` carrying `useViewportSelection`'s pointer handlers, instead
 * of every node's own wrapper group carrying a copy. R3F treats every
 * object with a registered pointer handler as its own interactive raycast
 * root, so N per-node handlers meant a mesh at depth d was triangle-tested
 * once per ancestor on every pointer move; one delegated root raycasts the
 * subtree exactly once. `resolvePathFromObject` recovers which node owns
 * the hit mesh from the event's `object` by walking ITS OWN THREE parent
 * chain against the reverse `objectPathMap` `<SelectionContext>` builds —
 * see `useViewportSelection`'s doc comment.
 */

import { Fragment, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { TscnExternalResource, TscnNode, TscnScene } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import {
  allocatePaintRange,
  CANVAS_LAYER_TYPES,
  declaredCanvasLayers,
  layerRanks,
  WHOLE_CANVAS_RANGE,
} from './canvasPaintOrder.js';
import {
  LayerRanksProvider,
  PaintRangeProvider,
  usePaintRange,
} from './contexts/PaintOrderContext.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { GenericNodeFallback } from './internal/generic-node-fallback/index';
import { useViewportSelection } from './hooks/useViewportSelection.js';
import { useCanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';
import { TWO_D_UI_TYPES } from './controls/has2DUIContent.js';
import {
  isViewportBoundary,
  isViewportSurface,
} from '../nodes/viewport/subviewport/viewportBoundary.js';
import { NodePathProvider } from './contexts/NodePathContext.js';
import { useResource, useResourceLoader } from '../resources/useResource.js';
import { collapseLiveNode, singleSceneCache } from './liveSceneTree.js';
import { parseResourceReference, resolveInstancePath } from '../resources/SubResourceResolver.js';
import {
  SceneResourcesProvider,
  useSceneResources,
} from './SceneResourcesContext.js';
import { useSelection } from './contexts/SelectionContext.js';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { transformFromNode3DProperties, type NodeTransform } from './nodeTransform.js';
import { node2dGroupProps } from './node2dTransform.js';
import { canvasModulateColor, CanvasModulateContext } from './canvasModulate.js';
import { CanvasLayerScope } from './canvasLayerScope.js';
import type { Node3DProperties } from '../nodes/base/node3d/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import { GlbOverridesProvider } from './internal/glb-scene-root/GlbOverridesContext.js';
import { prefetchCsgModule } from './csg/csgModule.js';

/** Does this subtree contain anything that needs boolean evaluation? */
function containsCsgShape(node: TscnNode): boolean {
  if (nodeComponentRegistry.isCsgShape(node.type)) return true;
  return node.children.some(containsCsgShape);
}

export interface NodeDispatcherProps {
  /** Root nodes from the active scene (typically `scene.scenes.get(rootScene).nodes`). */
  nodes: readonly TscnNode[];
}

/**
 * Position for the crash-fallback placeholder. `transformFromNode3DProperties`
 * reads `properties.transform` — a field only `Node3DProperties` carries, so
 * casting a Node2D-world node's properties to it silently resolves to the
 * origin (Node2DProperties has no `.transform`), placing the fallback box at
 * its parent's local origin instead of near where the crashed node actually
 * was. Route Node2D-world types (`nodeComponentRegistry.isCanvasItem` — the
 * SAME classification `<Node2D>` itself is built on, `node2dGroupProps`)
 * through the matching 2D transform math instead. Control/UI types
 * (`TWO_D_UI_TYPES`) keep the Node3D-shaped fallback: they lay out via
 * anchors/offsets, not position/rotation/scale, so there is no equivalent
 * "local transform" to place a 3D-space placeholder at — same origin
 * fallback `<GenericNodeFallback>` already uses for them today.
 */
function fallbackTransform(node: TscnNode): NodeTransform {
  if (nodeComponentRegistry.isCanvasItem(node.type)) {
    const props = node.properties as Node2DProperties;
    const { position, rotation, scale } = node2dGroupProps(props);
    return { position, rotation, scale };
  }
  return transformFromNode3DProperties(node.properties as Node3DProperties);
}

export function NodeDispatcher({ nodes }: NodeDispatcherProps) {
  const { handlers } = useViewportSelection();

  // Start fetching the CSG library the moment we know the scene needs it. CameraFit's
  // last auto-frame retry fires at 1100 ms, so a boolean result that lands after that
  // would be framed out of the opening view. This is the only CSG-aware line in the
  // dispatcher: the evaluation seam itself lives in CsgPrimitive, because PlainNode is
  // the sole caller of registerNodeObject and skipping CSG children here would strip
  // selection from every one of them.
  useEffect(() => {
    if (nodes.some(containsCsgShape)) prefetchCsgModule();
  }, [nodes]);

  const canvasModulate = useMemo(() => canvasModulateColor(nodes), [nodes]);
  // The canvas's layer ranks and the root nodes' draw-sequence runs, both pure
  // functions of the same tree — which is exactly why the Control walk can
  // derive the same numbers from the same nodes without this walk telling it.
  const ranks = useMemo(() => layerRanks(declaredCanvasLayers(nodes)), [nodes]);
  const rootRanges = useMemo(() => allocatePaintRange(WHOLE_CANVAS_RANGE, nodes).children, [nodes]);

  return (
    // paint-order-safe: the delegated pointer root, ABOVE every canvas
    // item — each item's own wrapper is nearer to its pixels.
    <group
      onPointerDown={handlers.onPointerDown}
      onPointerUp={handlers.onPointerUp}
      onPointerMove={handlers.onPointerMove}
      onPointerOut={handlers.onPointerOut}
    >
      {/* A CanvasModulate tints the CANVAS, not its subtree, so it is published
          on its own context rather than seeded into the inherited modulate:
          each item multiplies it into its OWN pixels once, and an Unshaded item
          skips it entirely, exactly as Godot's base pass does. */}
      <CanvasModulateContext.Provider value={canvasModulate}>
        <LayerRanksProvider value={ranks}>
          {nodes.map((node, i) => (
            <PaintRangeProvider key={node.name} value={rootRanges[i]!}>
              <DispatchedNode node={node} path={node.name} />
            </PaintRangeProvider>
          ))}
        </LayerRanksProvider>
      </CanvasModulateContext.Provider>
    </group>
  );
}

interface DispatchedNodeProps {
  node: TscnNode;
  path: string;
}

/**
 * Thin dispatch: a node with an `instance` ref resolves its sub-scene (and may
 * collapse via Instance root merge) in `InstancedNode`; every other node — and
 * every already-merged node — renders directly in `PlainNode`. Holds no hooks
 * itself so the branch is free of rules-of-hooks concerns.
 */
export function DispatchedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const dispatched = node.instance ? (
    <InstancedNode node={node} path={path} />
  ) : (
    <PlainNode node={node} path={path} />
  );

  return node.authoredResources ? (
    <AuthoredResourceScope resources={node.authoredResources}>{dispatched}</AuthoredResourceScope>
  ) : (
    dispatched
  );
}

/**
 * Restore the ExtResource table a grafted node was authored against.
 *
 * A node grafted into content loaded from ANOTHER scene keeps rendering under
 * that scene's provider, where its `ExtResource("3")` is a different resource or
 * absent entirely — a failure that shows up as something plausible rather than
 * as nothing, which is the worse kind.
 *
 * `internalResources` is carried through untouched rather than reset: the
 * provider would default it to empty, and a grafted node's `SubResource(...)`
 * would then resolve to nothing. Those ids belong to the outer scene too, so
 * this is not yet exactly right — but no corpus scene puts a SubResource in a
 * deep override, and keeping what is in scope beats wiping it.
 */
function AuthoredResourceScope({
  resources,
  children,
}: {
  resources: readonly TscnExternalResource[];
  children: ReactNode;
}): ReactNode {
  const { internalResources } = useSceneResources();
  return (
    <SceneResourcesProvider externalResources={resources} internalResources={internalResources}>
      {children}
    </SceneResourcesProvider>
  );
}

/**
 * The node with its DEEP children removed — those whose authored parent path
 * descended into this instance's content.
 *
 * They are addressed against the instanced scene, not against this node, so
 * rendering them here would put them at the INSTANCE's transform instead of
 * their real parent's: the platformer player's coin counter is a 3.33x-scaled
 * Label3D 7.5 units up, and misplacing it visibly breaks the scene's framing.
 * A node that cannot yet be placed correctly renders nowhere rather than
 * somewhere wrong.
 *
 * Override-only deep children reach their target through
 * `GlbOverridesProvider`, which still receives the FULL child list; they never
 * wanted a row of their own. What is still missing is the counterpart for a
 * TYPED deep child — it needs portalling onto the matched GLB object, which is
 * why the coin counter does not render at all yet.
 */
function withoutDeepChildren(node: TscnNode): TscnNode {
  // `some` before `filter`: the overwhelming majority of nodes have no deep
  // children, and returning the SAME reference is what keeps the downstream
  // `useMemo([node])`s in `PlainNode` from invalidating every render.
  if (!node.children.some((c) => c.instanceSubPath)) return node;
  return { ...node, children: node.children.filter((c) => !c.instanceSubPath) };
}

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
function PlainNode({
  node,
  path,
  children: extraChildren,
}: PlainNodeProps): ReactNode {
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  const { hiddenNodePaths, registerNodeObject, unregisterNodeObject } = useSelection();
  const workspace = useCanvasWorkspace();
  const paintRange = usePaintRange();
  // Before the early returns, for rules-of-hooks. Memoized because
  // `allocatePaintRange` sizes each child by walking its whole subtree:
  // unmemoized, every node re-walks its descendants on every render, which is
  // quadratic in depth across a scene.
  const allocated = useMemo(
    () =>
      allocatePaintRange(
        paintRange,
        node.children,
        (node.properties as { y_sort_enabled?: boolean }).y_sort_enabled === true
      ),
    [paintRange, node.children, node.properties]
  );
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

  // Godot editor workspace split (ADR-0006 amendment): the 3D viewport never
  // draws CanvasItems (Node2D world, Control UI, CanvasLayer subtrees); the
  // 2D world canvas never draws registered 3D content. Plain/unregistered
  // containers (e.g. a `Node` root) pass through in both so children of
  // either kind stay reachable. (After the hooks — the skip is deterministic
  // per mounted instance, but rules-of-hooks wants the call order static.)
  // A viewport surface (SubViewportContainer) is a Control, so it is in
  // TWO_D_UI_TYPES — but it must NOT be dropped here, or a contained
  // sub-viewport's 3D content goes with it, and that content really does draw
  // in Godot's 3D view (shared World3D unless `own_world_3d`). ADR-0033.
  const isCanvasItem =
    !isViewportSurface(node.type) &&
    (nodeComponentRegistry.isCanvasItem(node.type) || TWO_D_UI_TYPES.has(node.type));
  // A CanvasLayer is its OWN canvas — what that means is `<CanvasLayerScope>`,
  // shared with the Control walk's `CanvasLayer` painter.
  const startsCanvas = CANVAS_LAYER_TYPES.has(node.type);

  if (workspace === '3d' && isCanvasItem) return null;
  if (
    workspace === '2d' &&
    !isCanvasItem &&
    // A sub-viewport is not drawn by either canvas — it renders OFFSCREEN, and
    // a `ViewportTexture` consumer in this workspace (a Sprite2D showing a 3D
    // sub-scene) needs that target. Dropping it here would mean the publisher
    // never mounts, so the texture could never resolve. Its subtree still
    // never reaches this canvas: the component portals it into a detached
    // scene rather than rendering it inline. ADR-0033.
    !isViewportBoundary(node.type) &&
    nodeComponentRegistry.get(node.type) &&
    !nodeComponentRegistry.isContainer(node.type)
  ) {
    return null;
  }

  // Every child gets its own run of draw-sequence values, in the order Godot's
  // walk visits them — `show_behind_parent` children ahead of this node, the
  // rest after it. A child's run covers its whole subtree, so nothing inside it
  // can reach a sibling's sequence however deeply it nests.
  const inlineChildren = node.children.map((child, i) => (
    <PaintRangeProvider key={child.name} value={allocated.children[i]!}>
      <DispatchedNode node={child} path={joinPath(path, child.name)} />
    </PaintRangeProvider>
  ));

  const children: ReactNode[] = [];
  if (inlineChildren.length > 0) {
    children.push(<Fragment key="__inline">{inlineChildren}</Fragment>);
  }
  if (extraChildren) {
    // An instance's injected sub-scene roots draw after this node's authored
    // children, from the room `reservesRoom` held back for exactly them.
    children.push(
      <PaintRangeProvider key="__extra" value={allocated.tail}>
        {extraChildren}
      </PaintRangeProvider>
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
      {/* paint-order-safe: the selection wrapper, OUTSIDE the item's own
          group — `<CanvasItem2D>` renders that one inside this and it is
          nearer to every mesh. A type that draws without the CanvasItem
          ritual takes the key from `useCanvasItemRenderOrder` instead. */}
      <group ref={wrapperRef} visible={!isHidden}>
        <ErrorBoundary
          resetKeys={[node]}
          fallback={() => (
            <MissingResourcePlaceholder shape="box" name={node.name} {...fallbackTransform(node)} />
          )}
        >
          <Component node={node}>
            {children.length > 0 ? (
              startsCanvas ? (
                <CanvasLayerScope node={node}>{children}</CanvasLayerScope>
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

/**
 * Resolves a node's `instance = ExtResource("id")` ref to a `res://` path,
 * loads the PackedScene via `useResource`, and composes it into the tree.
 *
 * Single-root `.tscn` instances collapse via **Instance root merge** (ADR-0013):
 * the instance node *becomes* the sub-scene root (adopting its type, children,
 * and merged properties — the instance transform replacing the root's) and is
 * re-dispatched at the SAME path. Nested-root instances recurse naturally: the
 * merged node carries the root's own instance ref, so re-dispatch collapses the
 * next level too, and each authored child instance merges on its own turn.
 *
 * `.glb` synthetic roots and multi-root scenes fall back to the historical
 * nested-injection form — the instancing node's own component renders, the
 * loaded roots are injected as children, and `GlbOverridesProvider` exposes the
 * instance's inline children so `GLBSceneRoot` can match GLB internals by name.
 *
 * Either way the loaded scene's `internalResources` / `externalResources` are
 * scoped to descendants via a nested `<SceneResourcesProvider>` so SubResource
 * lookups inside the instanced subtree resolve against the loaded pool.
 */
function InstancedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const { externalResources } = useSceneResources();
  const loader = useResourceLoader();
  const paintRange = usePaintRange();
  const instanceRef = node.instance ?? '';
  const scenePath = resolveInstancePath(instanceRef, externalResources);

  // Register the PackedScene with SceneLoader before the `useResource`
  // request kicks in. SceneLoader's `loadSceneFromProvider` looks up
  // metadata to learn the resource's type/path; without registration
  // it throws "Scene metadata not found". Registration is idempotent
  // (MetadataStore overwrites on duplicate id), so re-registering on every
  // relevant-input change is safe — the alternative (effect in
  // SceneResourcesProvider) ran AFTER the dispatcher's useResource effect
  // because React runs child effects before parent effects.
  //
  // Lives in an effect (not the render body) so this instancing subtree's
  // render stays a pure computation — the loader mutation only happens once
  // per commit for a given instance ref, not on every re-render.
  useEffect(() => {
    if (!loader || !scenePath) return;
    const parsed = parseResourceReference(instanceRef);
    if (parsed && parsed.type === 'ExtResource') {
      const ext = externalResources.find((r) => r.id === parsed.id);
      if (ext) {
        loader.register({ id: ext.id, path: ext.path, type: ext.type });
      }
    }
  }, [loader, scenePath, instanceRef, externalResources]);

  const result = useResource<TscnScene>(scenePath ?? '', 'PackedScene');
  const loadedScene = result.status === 'loaded' ? result.value ?? null : null;

  // Instance root merge via the shared `collapseLiveNode` — the SAME decision
  // the tree, inspector, and panels make, so ADR-0013 lives in one place instead
  // of each walker re-deriving it. The single-entry cache hands it just this
  // instance's loaded scene, keyed to its path. `effective !== node` means a
  // single non-GLB root collapsed in: re-dispatch the merged node at the SAME
  // path under the sub-scene's resource scope. `.glb`/multi-root return `node`
  // unchanged → the historical nested-injection fallback below.
  //
  // Memoized (and called unconditionally, ahead of the early returns below,
  // to satisfy rules-of-hooks) so an unrelated re-render (selection/hover
  // elsewhere in the tree) doesn't re-merge + re-parse this instance's
  // subtree every frame — the same fix TreeNode.tsx already applies to its
  // own collapseLiveNode call.
  const effective = useMemo(
    () =>
      loadedScene
        ? collapseLiveNode(node, externalResources, singleSceneCache(scenePath, loadedScene))
        : node,
    [node, externalResources, scenePath, loadedScene]
  );

  // Memoized because `withoutDeepChildren` allocates a new node whenever there
  // IS a deep child — exactly the case this feature creates — and `PlainNode`
  // memoizes a recursive subtree scan on node identity, so an unmemoized strip
  // would re-run that scan on every render of every instance with an override.
  const shallow = useMemo(() => withoutDeepChildren(node), [node]);
  // The injected roots are dispatched INSIDE `shallow`'s PlainNode, which hands
  // them its tail; splitting that tail here keeps each root's subtree in a run
  // of its own, exactly as an authored child would get.
  const injectedRanges = useMemo(
    () =>
      allocatePaintRange(allocatePaintRange(paintRange, shallow.children).tail, loadedScene?.nodes ?? [])
        .children,
    [paintRange, shallow.children, loadedScene?.nodes]
  );

  // Unresolvable ref or failed load: keep the node visible with a magenta
  // placeholder child, matching the missing-texture UX.
  if (!scenePath || result.status === 'unavailable') {
    return (
      <PlainNode node={shallow} path={path}>
        <MissingResourcePlaceholder shape="box" />
      </PlainNode>
    );
  }
  // Still loading: render the instancing node's own subtree; the merged
  // result swaps in once the sub-scene arrives.
  if (result.status === 'pending' || !loadedScene) {
    return <PlainNode node={shallow} path={path} />;
  }

  if (effective !== node) {
    return (
      <SceneResourcesProvider
        internalResources={loadedScene.internalResources}
        externalResources={loadedScene.externalResources}
      >
        <DispatchedNode node={effective} path={path} />
      </SceneResourcesProvider>
    );
  }

  // Fallback (`.glb` synthetic root / multi-root): historical nested form.
  return (
    <GlbOverridesProvider overrides={node.children}>
      <PlainNode node={shallow} path={path}>
        <SceneResourcesProvider
          internalResources={loadedScene.internalResources}
          externalResources={loadedScene.externalResources}
        >
          {loadedScene.nodes.map((child, i) => (
            <PaintRangeProvider key={child.name} value={injectedRanges[i]!}>
              <DispatchedNode node={child} path={joinPath(path, child.name)} />
            </PaintRangeProvider>
          ))}
        </SceneResourcesProvider>
      </PlainNode>
    </GlbOverridesProvider>
  );
}
