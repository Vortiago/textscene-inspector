/**
 * Instance root merge — collapse the redundant sub-scene wrapper level so an
 * instance Node *becomes* the single-root `.tscn` it instances (Godot parity).
 *
 * See ADR-0013 and the "Instance root merge" glossary entry. Applied
 * identically in both render paths (tree `useSubSceneChildren`/`TreeNode` and
 * viewport `NodeDispatcher`) plus the live-tree `resolveLiveNode` (which the
 * inspector reads via `useLiveNode`), so node paths stay consistent —
 * load-bearing for the selection-driven Animation tab (ADR-0012).
 */
import { canonicalisePropertyBag } from '../godot/deprecated.js';
import type { SceneScope, TscnNode } from '../parser/types.js';
import { graftInstanceChildren } from './graftInstanceChildren.js';
import { nodeRegistry } from '../core/NodeRegistry.js';
import type { ParsedHeading } from '../parser/utils.js';

/**
 * Synthetic render-only type the scene processor emits for `.glb`/`.gltf`
 * instances (see `processors/createSceneProcessor.ts`). A GLB scene is also
 * single-root, so the merge must explicitly skip it: its instance children are
 * GLB property overrides matched by name through `GlbOverridesProvider`, which
 * the collapse would discard. Mirrors the literal used at the synthesis site.
 */
const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';

/**
 * The instance node overrides only the properties it actually specifies. The
 * base `Node` parser emits a `transform` key (and others) for EVERY node — set
 * to `undefined` when the `.tscn` has no such line — so a raw spread of the
 * instance properties would erase the root's real values. Stripping `undefined`
 * keeps Godot's semantics: an absent instance property falls back to the root's.
 * (Defined falsy values — `false`, `0`, `""` — still override, as they should.)
 */
function definedProperties(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (props[key] !== undefined) out[key] = props[key];
  }
  return out;
}

/**
 * Fold a single-root `.tscn` sub-scene into its instance Node, returning the
 * merged Node — or `null` when the merge does not apply, signalling the caller
 * to keep today's nested-injection form.
 *
 * The merged Node adopts the root's `type` and `children`, and computes its
 * `properties` by merging at the RAW level: `{ ...root.rawProperties,
 * ...instanceNode.rawProperties }` re-parsed ONCE with the root type's
 * registered parser, so a type-specific instance override (a GridMap `data`, a
 * Camera3D `fov`, …) layers onto the root and is parsed with the correct type
 * (the instance wins per-key, so its `transform` *replaces* the root's). When
 * raw props or a registered root parser are unavailable — e.g.
 * hand-built nodes in tests, or an unregistered root type — it falls back to
 * spreading the already-parsed properties (instance wins per-key; an undefined
 * instance value does not clobber the root). Host-added children are appended.
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
  loadedScene: { nodes: readonly TscnNode[] },
  outerScope?: SceneScope
): TscnNode | null {
  if (loadedScene.nodes.length !== 1) return null;
  const root = loadedScene.nodes[0]!;
  if (root.type === GLB_SCENE_ROOT_TYPE) return null;

  const registration = nodeRegistry.getRegistration(root.type);
  // Layer the instance's raw overrides onto the root's raw props whenever both
  // are available, so a type-specific override survives the merge. Carried on
  // the merged node too, so a nested-root re-dispatch keeps merging raw-first.
  // The override's keys are canonicalised HERE because the scanner could not:
  // an `instance=` heading carries no `type=`, so a pre-4.0 alias in the
  // override survived as-is and lost to the root's own canonical key.
  const mergedRaw =
    root.rawProperties && instanceNode.rawProperties
      ? {
          ...canonicalisePropertyBag(root.type, root.rawProperties),
          ...canonicalisePropertyBag(root.type, instanceNode.rawProperties),
        }
      : undefined;

  let mergedProperties: TscnNode['properties'];
  if (mergedRaw && registration) {
    // Re-parse the merged raw map ONCE with the root type's parser.
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
    // Fallback: nodes without raw props (hand-built/test) or an unregistered
    // root type — spread the already-parsed properties as before.
    mergedProperties = {
      ...root.properties,
      ...definedProperties(instanceNode.properties as Record<string, unknown>),
    };
  }

  return {
    ...instanceNode,
    type: root.type,
    instance: root.instance,
    properties: mergedProperties,
    rawProperties: mergedRaw,
    // `mergedRaw`'s key order is neither file's real order (a shared key
    // keeps ROOT's position but the INSTANCE's value; an instance-only key
    // is appended after every root key) — explicit `false` here, since the
    // `...instanceNode` spread above would otherwise carry the instance
    // node's OWN (reliable, but not applicable to this merged node)
    // `rawPropertiesOrderReliable` through unchanged. A file-order-sensitive
    // resolver (ADR-0035) must fall back to the editor-save-order assumption
    // for a node built this way.
    rawPropertiesOrderReliable: false,
    // A host child whose parent path descended INTO this instance is grafted at
    // the sub-path it named rather than appended at the root — see
    // `graftInstanceChildren`. Direct children still append, as before.
    children: graftInstanceChildren(root.children, instanceNode.children, outerScope),
  };
}
