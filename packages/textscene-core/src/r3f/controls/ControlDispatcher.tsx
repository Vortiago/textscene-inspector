/**
 * Recursive DOM walker that turns a Control subtree into nested <div>s — the
 * 2D analogue of NodeDispatcher. For each node it looks up the registered
 * Control component (GenericControlFallback when absent) and renders it with
 * its recursively-dispatched children; each component decides how to lay those
 * children out (a container provides its layout kind via ControlParentContext).
 *
 * Descends the **Live scene tree**, not the parsed SceneGraph: at an `instance=`
 * boundary the parsed node is a childless `Node`, so walking `node.children`
 * renders a HUD assembled by instancing as an empty passthrough. A loaded
 * sub-scene is composed in two shapes (ADR-0013): a single-root one collapses,
 * the instance node BECOMING that root, so the node itself renders in the
 * sub-scene's scope; a multi-root one keeps the instance node and injects the
 * loaded roots beneath it. Either way the subtree mounts under its own
 * `<SceneResourcesProvider>` — a sub-scene's texture/StyleBox ids are its own,
 * and the host's scope would resolve them to different files. That nested
 * override is what ADR-0009 carves out as load-bearing for instancing, distinct
 * from the overlay's own top-level mount.
 *
 * Honors the scene-tree eye toggle the same way NodeDispatcher does in 3D: a
 * node whose path is in `SelectionContext.hiddenNodePaths` (and its subtree) is
 * not rendered. Paths follow the tree scheme — root = node name, child =
 * `parent/child` — so a single hidden set drives both viewports.
 *
 * Stops at a **viewport boundary** (ADR-0030): a `SubViewport` always owns its
 * own World2D, so its Control subtree is drawn by its viewport surface, not
 * here. Without that stop the subtree leaked into the parent HUD through the
 * fallback's `display: contents`.
 */

import { useEffect, type ReactNode } from 'react';
import type { TscnNode, TscnScene } from '../../parser/types';
import { joinPath } from '../../utils/nodePath';
import { useOptionalSelection } from '../contexts/SelectionContext';
import { useResource, useResourceLoader } from '../../resources/useResource';
import { SceneResourcesProvider, useSceneResources } from '../SceneResourcesContext';
import { collapseLiveNode } from '../liveSceneTree';
import { parseResourceReference, resolveInstancePath } from '../../resources/SubResourceResolver';
import { controlComponentRegistry } from './ControlComponentRegistry';
import { GenericControlFallback } from './GenericControlFallback';
import { isViewportBoundary } from '../../nodes/viewport/subviewport/viewportBoundary';

const NO_HIDDEN: ReadonlySet<string> = new Set();

/** Stand-in when no loader is mounted (linter callers, isolated overlay tests). */
const EMPTY_SCENE_CACHE = { getCached: () => undefined };

export interface ControlDispatcherProps {
  nodes: readonly TscnNode[];
  /** Path of the parent node; '' for scene roots. Children join onto it. */
  parentPath?: string;
}

export function ControlDispatcher({ nodes, parentPath = '' }: ControlDispatcherProps) {
  // Optional: the overlay still renders standalone (no provider → nothing hidden).
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;
  return (
    <>
      {nodes.map((node) => {
        const path = parentPath ? joinPath(parentPath, node.name) : node.name;
        if (hiddenNodePaths.has(path)) return null;
        // A sub-viewport owns its own World2D, so its Control subtree is drawn
        // by its viewport surface (a SubViewportContainer, or a ViewportTexture
        // consumer) and never by the parent overlay — ADR-0030. Stopping HERE
        // rather than inside DispatchedControl also skips the fallback's
        // `display: contents` passthrough, which is what leaked the subtree.
        if (isViewportBoundary(node.type)) return null;
        return <DispatchedControl key={node.name} node={node} path={path} />;
      })}
    </>
  );
}

function DispatchedControl({ node, path }: { node: TscnNode; path: string }): ReactNode {
  const loader = useResourceLoader();
  const { externalResources } = useSceneResources();
  const sceneCache = loader?.scenes ?? EMPTY_SCENE_CACHE;

  // The sub-scene behind an `instance=`, once loaded. Its resources scope BOTH
  // the merged node's own properties and its children — a collapsed instance IS
  // the sub-scene's root (ADR-0013), so its `texture`/`theme` refs are the
  // sub-scene's ids, which the host's scope would resolve to different files.
  const scenePath = node.instance ? resolveInstancePath(node.instance, externalResources) : null;
  // Register the PackedScene before the request: the scene processor looks up
  // metadata to learn a resource's type/path and otherwise throws "Scene
  // metadata not found". The 3D dispatcher registers the refs IT walks, but a
  // ref that only exists inside an instanced sub-scene's own scope (a HUD
  // instancing a widget) is reached solely by this walk. Idempotent, so
  // re-registering per commit is safe.
  useEffect(() => {
    if (!loader || !scenePath || !node.instance) return;
    const parsed = parseResourceReference(node.instance);
    if (parsed?.type !== 'ExtResource') return;
    const ext = externalResources.find((r) => r.id === parsed.id);
    if (ext) loader.register({ id: ext.id, path: ext.path, type: ext.type });
  }, [loader, scenePath, node.instance, externalResources]);

  // Requests the PackedScene when it isn't cached AND subscribes, so the overlay
  // composes the sub-scene on its own rather than depending on the 2D world layer
  // (its sibling in Canvas2DStage) having walked the tree first. Requests are
  // deduped by path, so overlapping with that walk costs nothing.
  useResource<TscnScene>(scenePath ?? '', 'scene');
  const subScene = scenePath ? sceneCache.getCached(scenePath) : undefined;
  const live = collapseLiveNode(node, externalResources, sceneCache);

  if (subScene) {
    const scoped = (children: ReactNode) => (
      <SceneResourcesProvider
        internalResources={subScene.internalResources}
        externalResources={subScene.externalResources}
      >
        {children}
      </SceneResourcesProvider>
    );
    // Single root → the instance BECAME it, so the node itself is in scope too.
    if (live !== node) return scoped(<RenderedControl node={live} path={path} />);
    // Multi-root → no collapse; the instance node stays and the loaded roots are
    // injected beneath it, each keeping the sub-scene's scope.
    return (
      <RenderedControl node={node} path={path}>
        {scoped(<ControlDispatcher nodes={subScene.nodes} parentPath={path} />)}
      </RenderedControl>
    );
  }
  return <RenderedControl node={live} path={path} />;
}

/**
 * The component lookup + child walk, run inside whatever scope wraps it.
 * `extraChildren` carries a multi-root sub-scene's injected roots, which render
 * alongside any children the host authored on the instance node.
 */
function RenderedControl({
  node,
  path,
  children: extraChildren,
}: {
  node: TscnNode;
  path: string;
  children?: ReactNode;
}): ReactNode {
  const Component = controlComponentRegistry.get(node.type) ?? GenericControlFallback;
  const inline =
    node.children.length > 0 ? (
      <ControlDispatcher nodes={node.children} parentPath={path} />
    ) : null;
  return (
    <Component node={node} path={path}>
      {inline || extraChildren ? (
        <>
          {inline}
          {extraChildren}
        </>
      ) : null}
    </Component>
  );
}
