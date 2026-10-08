/**
 * Recursive walker that turns a parsed scene into a React tree, one registered
 * component per node, loading instanced sub-scenes as it goes. It mounts no
 * `<Canvas>` and no context provider: `<TscnCanvas>` and `<TscnPreviewShell>` own those.
 */

import { Fragment, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { SceneScope, TscnNode } from '../parser/types.js';
import type { LiveNode } from '../resources/liveNode.js';
import { joinPath } from '../utils/nodePath.js';
import {
  allocateNodePaintRange,
  allocatePaintRange,
  canvasRootRanges,
  isCanvasLayerType,
  declaredCanvasLayers,
  layerRanks,
  WHOLE_CANVAS_RANGE,
} from './canvasPaintOrder.js';
import {
  CanvasRootRangesProvider,
  LayerRanksProvider,
  PaintRangeProvider,
  useCanvasRootRanges,
  usePaintRange,
} from './contexts/PaintOrderContext.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { GenericNodeFallback } from './internal/generic-node-fallback/index';
import { useViewportSelection } from './hooks/useViewportSelection.js';
import { useCanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';
import { drawsInWorkspace } from './nodeWorkspaceVisibility.js';
import { NodePathProvider } from './contexts/NodePathContext.js';
import { VisibilityParentScope } from './visibilityRange/VisibilityParentContext.js';
import {
  InstancedScenePathsProvider,
  useInstancedScenePaths,
} from './contexts/InstancedScenePathsContext.js';
import { collapseLiveNode, singleSceneCache } from './liveSceneTree.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { useInstancedScene } from './hooks/useInstancedScene.js';
import { SceneResourcesProvider, useSceneResources } from './SceneResourcesContext.js';
import { useSelection } from './contexts/SelectionContext.js';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { fallbackTransform } from './nodeFallbackTransform.js';
import { canvasModulateColor, CanvasModulateContext } from './canvasModulate.js';
import { SpriteBase3DChildAccum } from './spriteBase3DColorAccum.js';
import { CanvasLayerScope } from './canvasLayerScope.js';
import { CanvasRootScope } from './canvasRootScope.js';
import {
  ParentTypeProvider,
  ParentSpaceScope,
  TopLevelScope,
  useParentSpaceFamily,
  WorldRoot,
} from './parentSpaceScope.js';
import { GlbInstanceProvider } from './internal/glb-scene-root/GlbInstanceContext.js';
import { prefetchCsgModule } from './csg/csgModule.js';
import { warn } from '../logger.js';

/** Does this subtree contain anything that needs boolean evaluation? */
function containsCsgShape(node: TscnNode): boolean {
  if (nodeComponentRegistry.isCsgShape(node.type)) return true;
  return node.children.some(containsCsgShape);
}

export interface NodeDispatcherProps {
  /** Root nodes from the active scene (typically `scene.scenes.get(rootScene).nodes`). */
  nodes: readonly TscnNode[];
}

export function NodeDispatcher({ nodes }: NodeDispatcherProps) {
  const { handlers } = useViewportSelection();

  // Fetch the CSG library early, so a boolean result reaches the opening frame
  // sooner: CameraFit re-frames it only once the loader has settled.
  // Evaluation lives in CsgPrimitive: skipping CSG children here strips their selection.
  useEffect(() => {
    if (nodes.some(containsCsgShape)) prefetchCsgModule();
  }, [nodes]);

  const canvasModulate = useMemo(() => canvasModulateColor(nodes), [nodes]);
  // Pure functions of the tree, so the Control walk derives the same numbers on its own.
  const ranks = useMemo(() => layerRanks(declaredCanvasLayers(nodes)), [nodes]);
  const rootRanges = useMemo(() => allocatePaintRange(WHOLE_CANVAS_RANGE, nodes).children, [nodes]);
  // Where each canvas root of the viewport's own canvas draws: an item whose
  // parent is not a CanvasItem is drawn in its pre-order rank among the
  // canvas's roots, not at the slot its nesting gives it (`canvasRootRanges`).
  const canvasRoots = useMemo(() => canvasRootRanges(nodes, rootRanges), [nodes, rootRanges]);

  return (
    // paint-order-safe: the delegated pointer root, above every canvas item.
    // One root raycasts a mesh once per pointer move. A handler per node raycasts
    // it once per ancestor, since R3F makes each handler its own raycast root.
    <group
      onPointerDown={handlers.onPointerDown}
      onPointerUp={handlers.onPointerUp}
      onPointerMove={handlers.onPointerMove}
      onPointerOut={handlers.onPointerOut}
    >
      {/* A CanvasModulate tints the canvas, not its subtree, so it has its own
          context: each item multiplies it into its own pixels once, and an
          Unshaded item skips it, as Godot's base pass does. */}
      <CanvasModulateContext.Provider value={canvasModulate}>
        <LayerRanksProvider value={ranks}>
          <CanvasRootRangesProvider value={canvasRoots}>
            {/* Inside the pointer root, so a click on a node that escaped its parent reaches it. */}
            <WorldRoot>
              {nodes.map((node, i) => (
                <PaintRangeProvider key={node.name} value={canvasRoots.get(node) ?? rootRanges[i]!}>
                  <DispatchedNode node={node} path={node.name} />
                </PaintRangeProvider>
              ))}
            </WorldRoot>
          </CanvasRootRangesProvider>
        </LayerRanksProvider>
      </CanvasModulateContext.Provider>
    </group>
  );
}

interface DispatchedNodeProps {
  node: LiveNode;
  path: string;
}

/**
 * Sends a node with an `instance` ref to `InstancedNode` and every other node to
 * `PlainNode`. It holds no hooks, so the branch is free of rules-of-hooks concerns.
 */
export function DispatchedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const dispatched = node.instance ? (
    <InstancedNode node={node} path={path} />
  ) : (
    <PlainNode node={node} path={path} />
  );

  return node.scope ? <OwnResourceScope scope={node.scope}>{dispatched}</OwnResourceScope> : dispatched;
}

/**
 * Provides the scope a node carries (`LiveNode.scope`). Under another scene's provider a
 * grafted node's `ExtResource("3")` and `SubResource("1")` name a different resource or
 * none. The provider prepends onto the ambient pool, so the node's own scope wins an id
 * both hold. Its enclosing scenes come too, so the node may instance the scene it sits in.
 */
function OwnResourceScope({ scope, children }: { scope: SceneScope; children: ReactNode }): ReactNode {
  const resources = (
    <SceneResourcesProvider
      externalResources={scope.externalResources}
      internalResources={scope.internalResources}
    >
      {children}
    </SceneResourcesProvider>
  );
  return scope.instancedScenePaths ? (
    <InstancedScenePathsProvider paths={scope.instancedScenePaths}>{resources}</InstancedScenePathsProvider>
  ) : (
    resources
  );
}

/**
 * The node without its deep children, whose parent path descends into this
 * instance's content. Here they would take the instance's transform, so they render
 * nowhere. `GlbInstanceProvider` still gets them all. A typed deep child does not
 * render: it needs portalling onto the matched GLB object.
 */
function withoutDeepChildren(node: TscnNode): TscnNode {
  // `some` before `filter`: most nodes have no deep children, and the same
  // reference keeps the `useMemo([node])`s in `PlainNode` valid.
  if (!node.children.some((c) => c.instanceSubPath)) return node;
  return { ...node, children: node.children.filter((c) => !c.instanceSubPath) };
}

interface PlainNodeProps extends DispatchedNodeProps {
  /** Extra rendered subtree appended after the node's own inline children. */
  children?: ReactNode;
}

/**
 * Renders one non-instance node into its wrapper `<group>` and registered
 * component, with its inline children and the `extraChildren` of the instance
 * fallback. A merged instance root renders here like an authored node.
 */
function PlainNode({ node, path, children: extraChildren }: PlainNodeProps): ReactNode {
  // An unregistered type renders the fallback, so it stays visible.
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  const { hiddenNodePaths, registerNodeObject, unregisterNodeObject } = useSelection();
  const workspace = useCanvasWorkspace();
  const paintRange = usePaintRange();
  // Before the early returns, for rules-of-hooks. Memoized: `allocateNodePaintRange`
  // walks each child's whole subtree, which on every render is quadratic in depth.
  const allocated = useMemo(() => allocateNodePaintRange(paintRange, node), [paintRange, node]);
  const isHidden = hiddenNodePaths.has(path);
  const inheritedCanvasRoots = useCanvasRootRanges();
  // A CanvasLayer is a canvas of its own, so the roots below it are indexed by
  // its counter over its children (`canvas_layer.cpp:261-267`).
  const startsCanvas = isCanvasLayerType(node.type);
  const canvasRoots = useMemo(
    () => (startsCanvas ? canvasRootRanges(node.children, allocated.children) : inheritedCanvasRoots),
    [startsCanvas, node.children, allocated.children, inheritedCanvasRoots]
  );

  // Whether `Object::cast_to<CanvasItem>(get_parent())` succeeds for this node.
  const parentIsCanvasItem = useParentSpaceFamily() === 'CanvasItem';

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

  if (!drawsInWorkspace(node.type, workspace)) return null;

  // Each child gets its own run of draw-sequence values in Godot's walk order:
  // `show_behind_parent` children before this node, the rest after it. A run
  // covers the child's whole subtree, so nothing reaches a sibling's sequence.
  const inlineChildren = node.children.map((child, i) => (
    <PaintRangeProvider key={child.name} value={canvasRoots.get(child) ?? allocated.children[i]!}>
      <DispatchedNode node={child} path={joinPath(path, child.name)} />
    </PaintRangeProvider>
  ));

  const children: ReactNode[] = [];
  if (inlineChildren.length > 0) {
    children.push(<Fragment key="__inline">{inlineChildren}</Fragment>);
  }
  if (extraChildren) {
    // Injected sub-scene roots draw after the authored children, in the room
    // `reservesRoom` holds back for them.
    children.push(
      <PaintRangeProvider key="__extra" value={allocated.tail}>
        {extraChildren}
      </PaintRangeProvider>
    );
  }

  // The wrapper is registered both ways: the pointer root resolves a hit mesh to
  // its nearest registered ancestor, and the highlights find a path's Object3D.
  // `<ErrorBoundary>` keeps a render error to this node: uncaught, it blanks the
  // viewport, since `<Canvas>` is its own reconciler root. A new `node` resets it.
  return (
    <ParentSpaceScope node={node}>
      <NodePathProvider path={path}>
        <VisibilityParentScope node={node} path={path}>
          {/* paint-order-safe: the selection wrapper, outside the item's own group,
            which `<CanvasItem2D>` renders nearer to every mesh. A type that draws
            without that ritual takes its key from `useCanvasItemRenderOrder`. */}
          <group ref={wrapperRef} visible={!isHidden}>
            {/* Inside the eye-toggle group: a top_level canvas root drops its
              ancestors' transform and tint but not their visibility. A root whose
              parent is no CanvasItem left them all in `<ParentSpaceScope>`. */}
            <TopLevelScope node={node}>
              <CanvasRootScope node={node} parentIsCanvasItem={parentIsCanvasItem}>
                <ErrorBoundary
                  resetKeys={[node]}
                  fallback={() => (
                    <MissingResourcePlaceholder shape="box" name={node.name} {...fallbackTransform(node)} />
                  )}
                >
                  {/* The cast each descendant the component renders runs against this node
                    (`node_3d.cpp:150`, `canvas_item.cpp:565-571`), answered with its type: for a
                    merged instance, the sub-scene root's type. A y-sort reorder keeps it, since
                    every level it lifts past is a CanvasItem. */}
                  <ParentTypeProvider value={node.type}>
                    <Component node={node}>
                      {children.length > 0 ? (
                        /* At every level, so a non-sprite parent overwrites with white:
                         `sprite_3d.cpp:75` accumulates from the immediate parent only. */
                        <SpriteBase3DChildAccum node={node}>
                          {startsCanvas ? (
                            <CanvasLayerScope node={node}>
                              {/* `<CanvasLayerScope>` is shared with the Control walk's
                                `CanvasLayer` painter. A canvas root below draws on this
                                layer's canvas (`canvas_item.cpp:246-252`), so a node that
                                escapes inside it stays under the layer's own group. */}
                              <WorldRoot>
                                <CanvasRootRangesProvider value={canvasRoots}>
                                  {children}
                                </CanvasRootRangesProvider>
                              </WorldRoot>
                            </CanvasLayerScope>
                          ) : (
                            <>{children}</>
                          )}
                        </SpriteBase3DChildAccum>
                      ) : null}
                    </Component>
                  </ParentTypeProvider>
                </ErrorBoundary>
              </CanvasRootScope>
            </TopLevelScope>
          </group>
        </VisibilityParentScope>
      </NodePathProvider>
    </ParentSpaceScope>
  );
}

/**
 * Loads the PackedScene a node's `instance` ref names and composes it into the
 * tree. A single-root `.tscn` merges into the instance node at the same path
 * (ADR-0013). A `.glb` or multi-root scene injects its roots as children. Either
 * way the loaded scene's resources are scoped to the subtree. An instance of a
 * scene that already encloses it (cyclic instancing) renders as a failed load.
 */
function InstancedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const ambientScope = useSceneResources();
  const { externalResources } = ambientScope;
  const enclosingScenePaths = useInstancedScenePaths();
  const paintRange = usePaintRange();
  const instanceRef = node.instance ?? '';
  const scenePath = resolveInstancePath(instanceRef, externalResources);
  const isCyclic = scenePath !== null && enclosingScenePaths.includes(scenePath);
  // Null for a scene this node never loads: an unresolvable ref or a cycle.
  const loadPath = isCyclic ? null : scenePath;

  useEffect(() => {
    if (!isCyclic) return;
    warn(
      `[NodeDispatcher] "${path}" instances ${scenePath}, which already encloses it: Godot refuses cyclic instancing`
    );
  }, [isCyclic, path, scenePath]);

  // Registered here, not in a parent: React runs a parent's effect after this
  // component's load effect.
  const result = useInstancedScene(instanceRef, externalResources, loadPath);
  const loadedScene = result.status === 'loaded' ? (result.value ?? null) : null;

  // The scenes that enclose a multi-root or GLB instance's content. A stable identity,
  // since it keys the provider below.
  const contentScenePaths = useMemo(
    () => (loadPath ? [...enclosingScenePaths, loadPath] : enclosingScenePaths),
    [enclosingScenePaths, loadPath]
  );

  // The same merge the tree, inspector and panels make. `effective !== node`
  // means a single root merged in. A `.glb` or multi-root scene returns `node`.
  // Memoized ahead of the early returns, so a hover elsewhere does not re-merge
  // this subtree every frame.
  const effective = useMemo(() => {
    if (!loadedScene) return node;
    const scope: SceneScope = { ...ambientScope, instancedScenePaths: enclosingScenePaths };
    return collapseLiveNode(node, scope, singleSceneCache(loadPath, loadedScene));
  }, [node, ambientScope, enclosingScenePaths, loadPath, loadedScene]);

  // Memoized: `PlainNode` memoizes a subtree scan on node identity, and a
  // stripped node is a new object.
  const shallow = useMemo(() => withoutDeepChildren(node), [node]);
  // The injected roots draw from the tail of `shallow`'s range. Splitting it
  // gives each root a run of its own, as an authored child gets.
  const injectedRanges = useMemo(
    () =>
      allocatePaintRange(allocateNodePaintRange(paintRange, shallow).tail, loadedScene?.nodes ?? []).children,
    [paintRange, shallow, loadedScene?.nodes]
  );

  // Unresolvable ref, cycle or failed load: keep the node visible with a
  // magenta placeholder child, matching the missing-texture UX.
  if (!loadPath || result.status === 'unavailable') {
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

  // The merged node carries the sub-scene's scope, which `DispatchedNode` provides.
  if (effective !== node) return <DispatchedNode node={effective} path={path} />;

  // A `.glb` or multi-root scene: the loaded roots are injected as children.
  return (
    <GlbInstanceProvider node={node} path={path}>
      <PlainNode node={shallow} path={path}>
        <SceneResourcesProvider
          internalResources={loadedScene.internalResources}
          externalResources={loadedScene.externalResources}
        >
          <InstancedScenePathsProvider paths={contentScenePaths}>
            {loadedScene.nodes.map((child, i) => (
              <PaintRangeProvider key={child.name} value={injectedRanges[i]!}>
                <DispatchedNode node={child} path={joinPath(path, child.name)} />
              </PaintRangeProvider>
            ))}
          </InstancedScenePathsProvider>
        </SceneResourcesProvider>
      </PlainNode>
    </GlbInstanceProvider>
  );
}
