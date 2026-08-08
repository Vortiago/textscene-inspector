/**
 * The `instance = ExtResource("id")` branch of the dispatch walk: load the
 * referenced PackedScene and compose it into the tree. `NodeDispatcher.tsx`
 * documents the walk as a whole.
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import type { TscnNode, TscnScene } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { useResource, useResourceLoader } from '../resources/useResource.js';
import { collapseLiveNode, singleSceneCache } from './liveSceneTree.js';
import { parseResourceReference, resolveInstancePath } from '../resources/SubResourceResolver.js';
import { SceneResourcesProvider, useSceneResources } from './SceneResourcesContext.js';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder.js';
import { GlbOverridesProvider } from './internal/glb-scene-root/GlbOverridesContext.js';
import { DispatchedNode, type DispatchedNodeProps } from './DispatchedNode.js';
import { PlainNode } from './PlainNode.js';

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
export function InstancedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const { externalResources } = useSceneResources();
  const loader = useResourceLoader();
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
          {loadedScene.nodes.map((child) => (
            <DispatchedNode key={child.name} node={child} path={joinPath(path, child.name)} />
          ))}
        </SceneResourcesProvider>
      </PlainNode>
    </GlbOverridesProvider>
  );
}
