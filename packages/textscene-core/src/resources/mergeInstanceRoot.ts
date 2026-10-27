/**
 * Instance root merge (ADR-0013): an instance Node becomes the single-root
 * `.tscn` it instances. The tree, the viewport `NodeDispatcher` and
 * `resolveLiveEntry` all apply it, so node paths agree, which the
 * selection-driven Animation tab needs (ADR-0012).
 */
import { scopeOf, type LiveNode } from './liveNode.js';
import { graftInstanceChildren, type InstanceScopes } from './graftInstanceChildren.js';
import { holdsDeepChildren, seatInInstance, type CollapseInstance } from './seatEscaped.js';
import { rehomeOverride } from './rehomeOverride.js';
import { layerRawOverride } from './layerRawOverride.js';
import { GLB_SCENE_ROOT_TYPE } from './glbSceneRoot.js';
import type { UniqueNamePaths } from './instanceNameTable.js';
import { cachedUniqueNamesBelowRoot } from '../utils/uniqueNames.js';

/**
 * The instance node's keys were written against the outer scope, the root's against the
 * sub-scene's, so the instance's are re-homed into the sub-scene's before they layer on.
 * The sub-scene's scope replaces the instance node's own: the merged node sits inside it.
 */
function mergeProperties(instanceNode: LiveNode, root: LiveNode, scopes: InstanceScopes) {
  const rehomed = rehomeOverride(instanceNode.rawProperties, scopes.outer, scopes.content);
  return { ...layerRawOverride(instanceNode, root, rehomed.raw), scope: rehomed.scope };
}

/**
 * Fold a single-root `.tscn` sub-scene into its instance Node. Returns `null`
 * for a scene without exactly one top-level node, or a lone `GLBSceneRoot`, and
 * the caller keeps the nested-injection form. The merged Node takes the root's
 * `type`, `children` and `instance` ref. An inherited root arrives composed over its base
 * already, carrying the table that composition built, which the host's settings land on.
 *
 * `collapse` collapses an instance node inside the merged tree: it gives the graft the table of a
 * nested instance, and seats the host children that a nested instance hands back. The default
 * leaves a nested instance as it is, for a caller with no scene cache.
 */
export function mergeInstanceRoot(
  instanceNode: LiveNode,
  loadedScene: { nodes: readonly LiveNode[] },
  scopes: InstanceScopes,
  collapse: CollapseInstance = (node) => node
): LiveNode | null {
  if (loadedScene.nodes.length !== 1) return null;
  const root = loadedScene.nodes[0]!;
  // A GLB's instance children are overrides matched by name through `GlbInstanceProvider`,
  // which a collapse would discard.
  if (root.type === GLB_SCENE_ROOT_TYPE) return null;

  const merged = mergeProperties(instanceNode, root, scopes);
  // The graft below lands these settings. A root that inherits a base the cache could not
  // compose it over (the dispatcher's one-scene cache) carries its own file's settings on, so
  // the next collapse over that base lands them. A composed root carries none.
  const { instanceNameSettings: settings = [], seatedPlacements, ...host } = instanceNode;
  const composed = root.uniqueNames;
  const own = composed ? () => composed.paths() : () => cachedUniqueNamesBelowRoot(loadedScene.nodes);
  // A host child whose parent path descends into this instance is grafted at
  // the sub-path it names (`graftInstanceChildren`). Direct children append.
  const nestedTables = new Map<LiveNode, UniqueNamePaths | undefined>();
  const nested = (node: LiveNode) => {
    if (!nestedTables.has(node)) nestedTables.set(node, collapse(node, scopes.content).uniqueNames?.paths());
    return nestedTables.get(node);
  };
  const hasUnloadedBase = Boolean(root.instance) && composed === undefined;
  const graft = graftInstanceChildren(root.children, instanceNode.children, scopes, {
    own,
    settings,
    nested,
    hasUnloadedBase,
  });

  const grafted: LiveNode = {
    ...host,
    type: root.type,
    // The instance node's own ref is consumed here. The tree's badge and
    // open-standalone affordance read the originating ref in the caller's scope.
    instance: root.instance,
    ...(root.instanceNameSettings ? { instanceNameSettings: root.instanceNameSettings } : {}),
    ...merged,
    children: graft.children,
    uniqueNames: graft.uniqueNames,
    uniqueParentPlacements: seatedPlacements
      ? new Map([...graft.uniqueParentPlacements, ...seatedPlacements])
      : graft.uniqueParentPlacements,
    ...(graft.escaped.length > 0 ? { escaped: graft.escaped } : {}),
  };
  return holdsDeepChildren(instanceNode) ? seatedInstance(grafted, scopes, collapse) : grafted;
}

/** `merged` with the host children that its nested instances hand back seated, or passed on in `escaped`. */
function seatedInstance(merged: LiveNode, scopes: InstanceScopes, collapse: CollapseInstance): LiveNode {
  const table = merged.uniqueNames!;
  const seated = seatInInstance(
    {
      root: merged,
      scope: scopeOf(merged, scopes.content),
      claimed: (key) => table.paths().get(key),
      handedBack: [],
    },
    collapse
  );
  if (seated.root === merged) return merged;
  const escaped = [...(merged.escaped ?? []), ...seated.escaped];
  return escaped.length > 0 ? { ...seated.root, escaped } : seated.root;
}
