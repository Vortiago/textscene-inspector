/**
 * Instance root merge (ADR-0013): an instance Node becomes the single-root
 * `.tscn` it instances. The tree, the viewport `NodeDispatcher` and
 * `resolveLiveNode` all apply it, so node paths agree, which the
 * selection-driven Animation tab needs (ADR-0012).
 */
import type { LiveNode } from './liveNode.js';
import { graftInstanceChildren, type InstanceScopes } from './graftInstanceChildren.js';
import { rehomeOverride } from './rehomeOverride.js';
import { layerRawOverride } from './layerRawOverride.js';

/**
 * The render-only type `processors/createSceneProcessor.ts` emits for a
 * `.glb`/`.gltf` instance. The merge skips it: its instance children are GLB
 * overrides matched by name through `GlbOverridesProvider`, which a collapse
 * would discard. Keep in step with the literal at the synthesis site.
 */
const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';

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
 * `type`, `children` and own `instance` ref, so a nested root collapses again.
 */
export function mergeInstanceRoot(
  instanceNode: LiveNode,
  loadedScene: { nodes: readonly LiveNode[] },
  scopes: InstanceScopes
): LiveNode | null {
  if (loadedScene.nodes.length !== 1) return null;
  const root = loadedScene.nodes[0]!;
  if (root.type === GLB_SCENE_ROOT_TYPE) return null;

  const merged = mergeProperties(instanceNode, root, scopes);

  return {
    ...instanceNode,
    type: root.type,
    // The instance node's own ref is consumed here. The tree's badge and
    // open-standalone affordance read the originating ref in the caller's scope.
    instance: root.instance,
    ...merged,
    // A host child whose parent path descends into this instance is grafted at
    // the sub-path it names (`graftInstanceChildren`). Direct children append.
    children: graftInstanceChildren(root.children, instanceNode.children, scopes),
  };
}
