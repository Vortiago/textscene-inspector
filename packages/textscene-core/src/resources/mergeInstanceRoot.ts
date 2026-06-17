/**
 * Instance root merge — collapse the redundant sub-scene wrapper level so an
 * instance Node *becomes* the single-root `.tscn` it instances (Godot parity).
 *
 * See ADR-0013 and the "Instance root merge" glossary entry. Applied
 * identically in both render paths (tree `useSubSceneChildren`/`TreeNode` and
 * viewport `NodeDispatcher`) plus `resolveNodeByPath`, so node paths stay
 * consistent — load-bearing for the selection-driven Animation tab (ADR-0012).
 */
import type { TscnNode } from '../parser/types.js';

/**
 * Synthetic render-only type the scene processor emits for `.glb`/`.gltf`
 * instances (see `processors/createSceneProcessor.ts`). A GLB scene is also
 * single-root, so the merge must explicitly skip it: its instance children are
 * GLB property overrides matched by name through `GlbOverridesProvider`, which
 * the collapse would discard. Mirrors the literal used at the synthesis site.
 */
const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';

/**
 * Fold a single-root `.tscn` sub-scene into its instance Node, returning the
 * merged Node — or `null` when the merge does not apply, signalling the caller
 * to keep today's nested-injection form.
 *
 * The merged Node adopts the root's `type` and `children`, merges the root's
 * parsed `properties` under the instance's own overrides (instance wins
 * per-key, so the instance `transform` *replaces* the root's), and appends any
 * children the host added under the instance.
 *
 * The merged Node's `instance` ref is the ROOT's own instance ref (not the
 * instance node's, which is consumed by this merge step). For the common case
 * the root is a plain node, so the merged node carries no `instance` and
 * dispatches as an ordinary node. When the root is *itself* an instance
 * (nested-root topology), the merged node keeps that ref so re-dispatch
 * collapses the next level too. The tree row's 📦 badge and ⤢ open-standalone
 * affordance are driven by the originating instance ref held in the caller's
 * scope, not by this field.
 *
 * Returns `null` for the fallback cases: a scene with anything other than a
 * single top-level node, or a lone synthetic `GLBSceneRoot`.
 */
export function mergeInstanceRoot(
  instanceNode: TscnNode,
  loadedScene: { nodes: readonly TscnNode[] }
): TscnNode | null {
  if (loadedScene.nodes.length !== 1) return null;
  const root = loadedScene.nodes[0]!;
  if (root.type === GLB_SCENE_ROOT_TYPE) return null;

  return {
    ...instanceNode,
    type: root.type,
    instance: root.instance,
    properties: { ...root.properties, ...instanceNode.properties },
    children: [...root.children, ...instanceNode.children],
  };
}
