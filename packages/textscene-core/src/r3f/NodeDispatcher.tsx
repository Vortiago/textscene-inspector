/**
 * Recursive walker that turns a parsed scene into a React tree, one registered
 * component per node, loading instanced sub-scenes as it goes. It mounts no
 * `<Canvas>` and no context provider: `<TscnCanvas>` and `<TscnPreviewShell>` own those.
 */

import { Fragment, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { SceneScope, TscnNode, TscnScene } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import {
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
import { TWO_D_UI_TYPES } from './controls/has2DUIContent.js';
import {
  isViewportBoundary,
  isViewportSurface,
} from '../nodes/viewport/subviewport/viewportBoundary.js';
import { NodePathProvider } from './contexts/NodePathContext.js';
import { useResource, useResourceLoader } from '../resources/useResource.js';
import { collapseLiveNode, singleSceneCache } from './liveSceneTree.js';
import {
  findExtResource,
  parseResourceReference,
  resolveInstancePath,
} from '../resources/SubResourceResolver.js';
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
import { SpriteBase3DChildAccum } from './spriteBase3DColorAccum.js';
import { CanvasLayerScope } from './canvasLayerScope.js';
import {
  CanvasRootScope,
  ParentIsCanvasItemProvider,
  useParentIsCanvasItem,
} from './canvasRootScope.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
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

/** Position for the crash-fallback placeholder, near where the crashed node was. */
function fallbackTransform(node: TscnNode): NodeTransform {
  // A Node2D has no `.transform`, so the 3D reader would place it at the origin.
  // A Control lays out with anchors, has no local transform, and keeps the origin.
  if (nodeComponentRegistry.isCanvasItem(node.type)) {
    const props = node.properties as Node2DProperties;
    const { position, rotation, scale } = node2dGroupProps(props);
    return { position, rotation, scale };
  }
  return transformFromNode3DProperties(node.properties as Node3DProperties);
}

export function NodeDispatcher({ nodes }: NodeDispatcherProps) {
  const { handlers } = useViewportSelection();

  // Fetch the CSG library early: CameraFit's last auto-frame retry fires at
  // 1100 ms, and a boolean result that lands later is framed out of view.
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
            {nodes.map((node, i) => (
              <PaintRangeProvider key={node.name} value={canvasRoots.get(node) ?? rootRanges[i]!}>
                <DispatchedNode node={node} path={node.name} />
              </PaintRangeProvider>
            ))}
          </CanvasRootRangesProvider>
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
 * Sends a node with an `instance` ref to `InstancedNode` and every other node to
 * `PlainNode`. It holds no hooks, so the branch is free of rules-of-hooks concerns.
 */
export function DispatchedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const dispatched = node.instance ? (
    <InstancedNode node={node} path={path} />
  ) : (
    <PlainNode node={node} path={path} />
  );

  return node.authoredScope ? (
    <AuthoredResourceScope scope={node.authoredScope}>{dispatched}</AuthoredResourceScope>
  ) : (
    dispatched
  );
}

/**
 * Restores both resource pools a grafted node was authored against. Under the
 * other scene's provider its `ExtResource("3")` and `SubResource("1")` name a
 * different resource or none. The provider prepends onto the ambient pool, so
 * the authoring scene wins an id both scenes hold.
 */
function AuthoredResourceScope({
  scope,
  children,
}: {
  scope: SceneScope;
  children: ReactNode;
}): ReactNode {
  return (
    <SceneResourcesProvider
      externalResources={scope.externalResources}
      internalResources={scope.internalResources}
    >
      {children}
    </SceneResourcesProvider>
  );
}

/**
 * The node without its deep children, whose parent path descends into this
 * instance's content. Here they would take the instance's transform, so they render
 * nowhere. `GlbOverridesProvider` still gets them all. A typed deep child does not
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
function PlainNode({
  node,
  path,
  children: extraChildren,
}: PlainNodeProps): ReactNode {
  // An unregistered type renders the fallback, so it stays visible.
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  const { hiddenNodePaths, registerNodeObject, unregisterNodeObject } = useSelection();
  const workspace = useCanvasWorkspace();
  const paintRange = usePaintRange();
  // Before the early returns, for rules-of-hooks. Memoized: `allocatePaintRange`
  // walks each child's whole subtree, which on every render is quadratic in depth.
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
  const inheritedCanvasRoots = useCanvasRootRanges();
  // A CanvasLayer is a canvas of its own, so the roots below it are indexed by
  // its counter over its children (`canvas_layer.cpp:261-267`).
  const startsCanvas = isCanvasLayerType(node.type);
  const canvasRoots = useMemo(
    () => (startsCanvas ? canvasRootRanges(node.children, allocated.children) : inheritedCanvasRoots),
    [startsCanvas, node.children, allocated.children, inheritedCanvasRoots]
  );

  // Whether `Object::cast_to<CanvasItem>(get_parent())` succeeds for this node.
  // The parent publishes it, since only the parent knows its type.
  const parentIsCanvasItem = useParentIsCanvasItem();

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

  // Workspace split (ADR-0006): the 3D viewport draws no CanvasItem, and the 2D
  // canvas draws no registered 3D content. An unregistered container passes
  // through in both. A SubViewportContainer is kept: its sub-viewport's 3D content
  // draws in Godot's 3D view, sharing World3D unless `own_world_3d` (ADR-0033).
  const isCanvasItem =
    !isViewportSurface(node.type) &&
    (nodeComponentRegistry.isCanvasItem(node.type) || TWO_D_UI_TYPES.has(node.type));
  if (workspace === '3d' && isCanvasItem) return null;
  if (
    workspace === '2d' &&
    !isCanvasItem &&
    // A sub-viewport renders offscreen, and a `ViewportTexture` consumer here
    // needs its target, so it mounts. Its component portals the subtree into a
    // detached scene, so nothing reaches this canvas (ADR-0033).
    !isViewportBoundary(node.type) &&
    nodeComponentRegistry.get(node.type) &&
    !nodeComponentRegistry.isContainer(node.type)
  ) {
    return null;
  }

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
    <NodePathProvider path={path}>
      {/* paint-order-safe: the selection wrapper, outside the item's own group,
          which `<CanvasItem2D>` renders nearer to every mesh. A type that draws
          without that ritual takes its key from `useCanvasItemRenderOrder`. */}
      <group ref={wrapperRef} visible={!isHidden}>
        {/* Inside the eye-toggle group: a canvas root drops its ancestors'
            transform and tint but not their visibility. */}
        <CanvasRootScope node={node} parentIsCanvasItem={parentIsCanvasItem}>
          <ErrorBoundary
            resetKeys={[node]}
            fallback={() => (
              <MissingResourcePlaceholder shape="box" name={node.name} {...fallbackTransform(node)} />
            )}
          >
            <Component node={node}>
              {children.length > 0 ? (
                /* At every level, so a non-sprite parent overwrites with white:
                   `sprite_3d.cpp:75` accumulates from the immediate parent only. */
                <SpriteBase3DChildAccum node={node}>
                  {/* The cast each child runs against its parent
                      (`canvas_item.cpp:565-571`), answered with this node's type:
                      for a merged instance, the sub-scene root's type. */}
                  <ParentIsCanvasItemProvider value={descendsFrom(node.type, 'CanvasItem')}>
                    {startsCanvas ? (
                      <CanvasLayerScope node={node}>
                        {/* `<CanvasLayerScope>` is shared with the Control walk's
                            `CanvasLayer` painter. */}
                        <CanvasRootRangesProvider value={canvasRoots}>{children}</CanvasRootRangesProvider>
                      </CanvasLayerScope>
                    ) : (
                      <>{children}</>
                    )}
                  </ParentIsCanvasItemProvider>
                </SpriteBase3DChildAccum>
              ) : null}
            </Component>
          </ErrorBoundary>
        </CanvasRootScope>
      </group>
    </NodePathProvider>
  );
}

/**
 * Loads the PackedScene a node's `instance` ref names and composes it into the
 * tree. A single-root `.tscn` merges into the instance node at the same path
 * (ADR-0013). A `.glb` or multi-root scene injects its roots as children. Either
 * way the loaded scene's resources are scoped to the subtree.
 */
function InstancedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const ambientScope = useSceneResources();
  const { externalResources } = ambientScope;
  const loader = useResourceLoader();
  const paintRange = usePaintRange();
  const instanceRef = node.instance ?? '';
  const scenePath = resolveInstancePath(instanceRef, externalResources);

  // Registered here, not in a parent: `loadSceneFromProvider` throws "Scene
  // metadata not found" without it, and React runs a parent's effect after this
  // component's `useResource` effect. An effect keeps the render pure. Idempotent.
  useEffect(() => {
    if (!loader || !scenePath) return;
    const parsed = parseResourceReference(instanceRef);
    if (parsed && parsed.type === 'ExtResource') {
      const ext = findExtResource(externalResources, parsed.id);
      if (ext) {
        loader.register({ id: ext.id, path: ext.path, type: ext.type });
      }
    }
  }, [loader, scenePath, instanceRef, externalResources]);

  const result = useResource<TscnScene>(scenePath ?? '', 'scene');
  const loadedScene = result.status === 'loaded' ? result.value ?? null : null;

  // The same merge the tree, inspector and panels make. `effective !== node`
  // means a single root merged in. A `.glb` or multi-root scene returns `node`.
  // Memoized ahead of the early returns, so a hover elsewhere does not re-merge
  // this subtree every frame.
  const effective = useMemo(
    () =>
      loadedScene
        ? collapseLiveNode(node, ambientScope, singleSceneCache(scenePath, loadedScene))
        : node,
    [node, ambientScope, scenePath, loadedScene]
  );

  // Memoized: `PlainNode` memoizes a subtree scan on node identity, and a
  // stripped node is a new object.
  const shallow = useMemo(() => withoutDeepChildren(node), [node]);
  // The injected roots draw from the tail of `shallow`'s range. Splitting it
  // gives each root a run of its own, as an authored child gets.
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

  // A `.glb` or multi-root scene: the loaded roots are injected as children.
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
