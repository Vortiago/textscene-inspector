/**
 * Instance root merge (ADR-0013): an instance Node becomes the single-root
 * `.tscn` it instances. The tree, the viewport `NodeDispatcher` and
 * `resolveLiveEntry` all apply it, so node paths agree, which the
 * selection-driven Animation tab needs (ADR-0012).
 */
import type { LiveNode } from './liveNode.js';
import { graftInstanceChildren, type InstanceScopes } from './graftInstanceChildren.js';
import { rehomeOverride } from './rehomeOverride.js';
import { layerRawOverride } from './layerRawOverride.js';
import { GLB_SCENE_ROOT_TYPE } from './glbSceneRoot.js';
import { cachedUniqueNameClaims } from '../utils/uniqueNames.js';

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
 * The live path below the sub-scene root that its own table gives `key`, read only when a sub-path
 * holds a `%Name`. The graft walks the composed tree, where a claimant inside a nested instance
 * sits at its live path, not at its heading.
 */
function claimedBelowRoot(roots: readonly LiveNode[], key: string): string | undefined {
  const claim = cachedUniqueNameClaims(roots).get(key);
  // The root claims nothing (it has no owner), so a claim's path always continues below it.
  return claim?.livePath.slice(claim.livePath.indexOf('/') + 1);
}

/**
 * Fold a single-root `.tscn` sub-scene into its instance Node. Returns `null`
 * for a scene without exactly one top-level node, or a lone `GLBSceneRoot`, and
 * the caller keeps the nested-injection form. The merged Node takes the root's
 * `type`, `children` and own `instance` ref, so a nested root collapses again.
 */
export function mergeInstanceRoot(
  instanceNode: LiveNode,
  loadedScene: { nodes: readonly LiveNode[] },
  scopes: InstanceScopes
): LiveNode | null {
  if (loadedScene.nodes.length !== 1) return null;
  const root = loadedScene.nodes[0]!;
  // A GLB's instance children are overrides matched by name through `GlbInstanceProvider`,
  // which a collapse would discard.
  if (root.type === GLB_SCENE_ROOT_TYPE) return null;

  const merged = mergeProperties(instanceNode, root, scopes);
  // The graft below lands these settings, so a further collapse of the chain never reads them.
  const { instanceNameSettings: settings = [], ...host } = instanceNode;

  return {
    ...host,
    type: root.type,
    // The instance node's own ref is consumed here. The tree's badge and
    // open-standalone affordance read the originating ref in the caller's scope.
    instance: root.instance,
    ...merged,
    // A host child whose parent path descends into this instance is grafted at
    // the sub-path it names (`graftInstanceChildren`). Direct children append.
    children: graftInstanceChildren(root.children, instanceNode.children, scopes, {
      own: (key) => claimedBelowRoot(loadedScene.nodes, key),
      settings,
    }),
  };
}
