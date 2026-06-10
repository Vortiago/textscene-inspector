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
 *      → `child_cube.tscn`) is rendered (WI-R3F-12).
 *   4. Otherwise render `<GenericNodeFallback>` so unknown types stay
 *      visible in the viewport.
 *
 * The dispatcher itself only renders nodes; it does NOT mount a `<Canvas>`
 * or any context providers — those are owned by `<TscnCanvas>` and
 * `<TscnPreviewShell>` respectively.
 *
 * Each rendered subtree is wrapped in `<PickableGroup>`, which attaches
 * the viewport selection handlers from `useViewportSelection` to the
 * subtree's pointer events. Click bubbles UP from the leaf mesh; the
 * handler at the leaf wins because R3F propagates pointer events from
 * the innermost hit object outward.
 */

import { Fragment, useCallback } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { TscnNode, TscnScene } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { GenericNodeFallback } from './internal/generic-node-fallback/index';
import { useViewportSelection } from './hooks/useViewportSelection.js';
import { NodePathProvider } from './contexts/NodePathContext.js';
import { useResource, useResourceLoader } from '../resources/useResource.js';
import { parseResourceReference, resolveInstancePath } from '../resources/SubResourceResolver.js';
import {
  SceneResourcesProvider,
  useSceneResources,
} from './SceneResourcesContext.js';
import { useSelection } from './contexts/SelectionContext.js';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder.js';
import { GlbOverridesProvider } from './internal/glb-scene-root/GlbOverridesContext.js';

export interface NodeDispatcherProps {
  /** Root nodes from the active scene (typically `scene.scenes.get(rootScene).nodes`). */
  nodes: readonly TscnNode[];
}

export function NodeDispatcher({ nodes }: NodeDispatcherProps) {
  const { withNodePath } = useViewportSelection();
  return (
    <>
      {nodes.map((node) => (
        <DispatchedNode
          key={node.name}
          node={node}
          path={node.name}
          withNodePath={withNodePath}
        />
      ))}
    </>
  );
}

interface DispatchedNodeProps {
  node: TscnNode;
  path: string;
  withNodePath: (path: string) => ReturnType<ReturnType<typeof useViewportSelection>['withNodePath']>;
}

function DispatchedNode({ node, path, withNodePath }: DispatchedNodeProps): ReactNode {
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  const handlers = withNodePath(path);
  const { hiddenNodePaths, registerNodeObject, unregisterNodeObject } = useSelection();
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

  const inlineChildren = node.children.map((child) => (
    <DispatchedNode
      key={child.name}
      node={child}
      path={joinPath(path, child.name)}
      withNodePath={withNodePath}
    />
  ));

  // Nodes with `instance = ExtResource("scene_id")` are external-scene
  // instances. The referenced PackedScene loads asynchronously via
  // `useResource`; while pending we render only the instancing node's
  // own subtree, and once loaded we inject the loaded scene's root
  // nodes as additional children. The instancing node's component
  // (typically Node3D) already wraps everything in a transform-aware
  // <group>, so the loaded subtree inherits the instance transform.
  // When an instancing node also declares inline children, those children
  // are Godot instance-property overrides. If the instance resolves to a
  // GLB, `GLBSceneRoot` matches them onto the GLB's internal nodes by name
  // (BUG 2 — see GlbOverridesContext). Publishing `node.children` here is a
  // no-op for non-GLB instances (no GLBSceneRoot consumes the context).
  const instanceChildren = node.instance ? (
    <GlbOverridesProvider overrides={node.children}>
      <InstancedSceneSubtree
        instanceRef={node.instance}
        path={path}
        withNodePath={withNodePath}
      />
    </GlbOverridesProvider>
  ) : null;

  const children: ReactNode[] = [];
  if (inlineChildren.length > 0) {
    children.push(<Fragment key="__inline">{inlineChildren}</Fragment>);
  }
  if (instanceChildren) {
    children.push(<Fragment key="__instance">{instanceChildren}</Fragment>);
  }

  // The pickable wrapper lives above the rendered component so that any
  // mesh / light / camera inside the subtree dispatches its pointer
  // events to the same node-path handler. Picking selects whichever node
  // OWNS the clicked geometry; if a child mesh is clicked, the child's
  // wrapper wins because R3F walks the hit-tree from inner to outer.
  //
  // `NodePathProvider` makes the path available to descendant components
  // (e.g. Camera3D tags its THREE.Camera with this so the canvas can
  // later swap to it on "Use This Camera").
  return (
    <NodePathProvider path={path}>
      <group
        ref={wrapperRef}
        visible={!isHidden}
        onPointerDown={handlers.onPointerDown}
        onPointerUp={handlers.onPointerUp}
        onPointerOver={handlers.onPointerOver}
        onPointerOut={handlers.onPointerOut}
      >
        <Component node={node}>
          {children.length > 0 ? <>{children}</> : null}
        </Component>
      </group>
    </NodePathProvider>
  );
}

interface InstancedSceneSubtreeProps {
  /** Raw TSCN instance reference, typically `ExtResource("1_cube")`. */
  instanceRef: string;
  /** Path of the instancing node (used as the prefix for loaded children). */
  path: string;
  withNodePath: DispatchedNodeProps['withNodePath'];
}

/**
 * Resolves the `ExtResource("id")` form to a `res://` path via the parent
 * scene's `externalResources`, hits `useResource('PackedScene', path)`,
 * and dispatches the loaded scene's root nodes. Missing/error states
 * render a magenta placeholder + drei `<Text>` label naming the path,
 * matching the missing-texture UX from WI-R3F-7.
 *
 * The loaded scene's `internalResources` / `externalResources` are
 * scoped to descendants via a nested `<SceneResourcesProvider>` so
 * SubResource lookups inside the instanced subtree (mesh references,
 * material overrides) resolve against the loaded scene's resource
 * pool, not the parent's. Nested instancing falls out naturally:
 * each `<DispatchedNode>` inside an already-instanced subtree runs
 * the same recursion if it carries its own `instance` ref.
 */
function InstancedSceneSubtree({
  instanceRef,
  path,
  withNodePath,
}: InstancedSceneSubtreeProps): ReactNode {
  const { externalResources } = useSceneResources();
  const loader = useResourceLoader();
  const scenePath = resolveInstancePath(instanceRef, externalResources);

  // Register the PackedScene with SceneLoader before the `useResource`
  // request kicks in. SceneLoader's `loadSceneFromProvider` looks up
  // metadata to learn the resource's type/path; without registration
  // it throws "Scene metadata not found". Registration is idempotent
  // (MetadataStore overwrites on duplicate id), so calling it on every
  // render of an instancing subtree is safe — the alternative (effect
  // in SceneResourcesProvider) ran AFTER the dispatcher's useResource
  // effect because React runs child effects before parent effects.
  if (loader && scenePath) {
    const parsed = parseResourceReference(instanceRef);
    if (parsed && parsed.type === 'ExtResource') {
      const ext = externalResources.find((r) => r.id === parsed.id);
      if (ext) {
        loader.register({ id: ext.id, path: ext.path, type: ext.type });
      }
    }
  }

  const result = useResource<TscnScene>(scenePath ?? '', 'PackedScene');

  if (!scenePath) {
    return (
      <MissingResourcePlaceholder shape="box" />
    );
  }
  if (result.status === 'unavailable') {
    return <MissingResourcePlaceholder shape="box" />;
  }
  if (result.status === 'pending' || !result.value) {
    return null;
  }

  const loadedScene = result.value;
  return (
    <SceneResourcesProvider
      internalResources={loadedScene.internalResources}
      externalResources={loadedScene.externalResources}
    >
      {loadedScene.nodes.map((child) => (
        <DispatchedNode
          key={child.name}
          node={child}
          path={joinPath(path, child.name)}
          withNodePath={withNodePath}
        />
      ))}
    </SceneResourcesProvider>
  );
}
