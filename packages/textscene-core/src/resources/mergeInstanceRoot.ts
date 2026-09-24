/**
 * Instance root merge (ADR-0013): an instance Node becomes the single-root
 * `.tscn` it instances. The tree, the viewport `NodeDispatcher` and
 * `resolveLiveNode` all apply it, so node paths agree, which the
 * selection-driven Animation tab needs (ADR-0012).
 */
import { canonicalisePropertyBag } from '../godot/deprecated.js';
import type { SceneScope, TscnNode } from '../parser/types.js';
import { graftInstanceChildren } from './graftInstanceChildren.js';
import { nodeRegistry } from '../core/NodeRegistry.js';
import type { ParsedHeading } from '../parser/utils.js';

/**
 * The render-only type `processors/createSceneProcessor.ts` emits for a
 * `.glb`/`.gltf` instance. The merge skips it: its instance children are GLB
 * overrides matched by name through `GlbOverridesProvider`, which a collapse
 * would discard. Keep in step with the literal at the synthesis site.
 */
const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';

/**
 * The base `Node` parser emits `transform` and other keys as `undefined` for a
 * node with no such line, so stripping `undefined` lets an absent instance
 * property fall back to the root's, as in Godot. A defined falsy value
 * (`false`, `0`, `""`) still overrides.
 */
function definedProperties(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (props[key] !== undefined) out[key] = props[key];
  }
  return out;
}

/**
 * Fold a single-root `.tscn` sub-scene into its instance Node. Returns `null`
 * for a scene without exactly one top-level node, or a lone `GLBSceneRoot`, and
 * the caller keeps the nested-injection form. The merged Node takes the root's
 * `type`, `children` and own `instance` ref, so a nested root collapses again.
 */
export function mergeInstanceRoot(
  instanceNode: TscnNode,
  loadedScene: { nodes: readonly TscnNode[] },
  outerScope?: SceneScope
): TscnNode | null {
  if (loadedScene.nodes.length !== 1) return null;
  const root = loadedScene.nodes[0]!;
  if (root.type === GLB_SCENE_ROOT_TYPE) return null;

  const registration = nodeRegistry.getRegistration(root.type);
  // Instance keys win, so a type-specific override and its `transform` survive,
  // and a nested-root re-dispatch merges raw-first too. The override's keys are
  // canonicalised here: an `instance=` heading has no `type=`, so the scanner
  // leaves a pre-4.0 alias that would lose to the root's canonical key.
  const mergedRaw =
    root.rawProperties && instanceNode.rawProperties
      ? {
          ...canonicalisePropertyBag(root.type, root.rawProperties),
          ...canonicalisePropertyBag(root.type, instanceNode.rawProperties),
        }
      : undefined;

  let mergedProperties: TscnNode['properties'];
  if (mergedRaw && registration) {
    // Re-parse the merged raw map once with the root type's parser.
    const instanceIndex = (instanceNode.properties as { index?: number }).index;
    const heading: ParsedHeading = {
      type: 'node',
      attributes: {
        type: root.type,
        name: instanceNode.name,
        ...(instanceNode.parent !== undefined ? { parent: instanceNode.parent } : {}),
        ...(instanceNode.instance ? { instance: instanceNode.instance } : {}),
        ...(instanceIndex !== undefined ? { index: String(instanceIndex) } : {}),
      },
    };
    mergedProperties = registration.parser(heading, mergedRaw);
  } else {
    // A node without raw props (hand-built) or an unregistered root type
    // spreads the already-parsed properties, instance winning per key.
    mergedProperties = {
      ...root.properties,
      ...definedProperties(instanceNode.properties as Record<string, unknown>),
    };
  }

  return {
    ...instanceNode,
    type: root.type,
    // The instance node's own ref is consumed here. The tree's badge and
    // open-standalone affordance read the originating ref in the caller's scope.
    instance: root.instance,
    properties: mergedProperties,
    rawProperties: mergedRaw,
    // `mergedRaw`'s key order is neither file's order, so a file-order-sensitive
    // resolver (ADR-0035) must fall back to editor save order. Explicit `false`,
    // since the `...instanceNode` spread would carry the instance node's own
    // `rawPropertiesOrderReliable` through.
    rawPropertiesOrderReliable: false,
    // A host child whose parent path descends into this instance is grafted at
    // the sub-path it names (`graftInstanceChildren`). Direct children append.
    children: graftInstanceChildren(root.children, instanceNode.children, outerScope),
  };
}
