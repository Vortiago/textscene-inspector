/**
 * Instance root merge (ADR-0013): an instance Node becomes the single-root
 * `.tscn` it instances. The tree, the viewport `NodeDispatcher` and
 * `resolveLiveNode` all apply it, so node paths agree, which the
 * selection-driven Animation tab needs (ADR-0012).
 */
import { canonicalisePropertyBag } from '../godot/deprecated.js';
import type { SceneScope, TscnNode } from '../parser/types.js';
import type { LiveNode } from './liveNode.js';
import { graftInstanceChildren, type InstanceScopes } from './graftInstanceChildren.js';
import { rehomeOverride } from './rehomeOverride.js';
import { nodeRegistry, type NodeTypeRegistration } from '../core/NodeRegistry.js';
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

/** The instance node's raw properties re-homed and laid over the root's, and the scope they resolve in. */
interface MergedRaw {
  raw: Record<string, string>;
  scope: SceneScope;
}

/**
 * Instance keys win, so a type-specific override and its `transform` survive, and a
 * nested-root re-dispatch merges raw-first too. The instance node's keys were written
 * against the outer scope, the root's against the sub-scene's, so the instance's are
 * re-homed first. They are canonicalised here: an `instance=` heading has no `type=`, so
 * the scanner leaves a pre-4.0 alias that would lose to the root's canonical key.
 */
function mergeRaw(
  instanceRaw: Record<string, string>,
  root: LiveNode,
  rootRaw: Record<string, string>,
  scopes: InstanceScopes
): MergedRaw {
  const { raw: rehomed, scope } = rehomeOverride(instanceRaw, scopes.outer, scopes.content);
  return {
    raw: {
      ...canonicalisePropertyBag(root.type, rootRaw),
      ...canonicalisePropertyBag(root.type, rehomed),
    },
    scope,
  };
}

/** The merged raw map parsed once with the root type's parser. */
function parseMerged(
  instanceNode: LiveNode,
  root: LiveNode,
  raw: Record<string, string>,
  registration: NodeTypeRegistration
): TscnNode['properties'] {
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
  return registration.parser(heading, raw);
}

/**
 * The parsed properties spread, instance winning per key, for a hand-built node with no raw
 * map. The instance's string values are the references it can hold, re-homed from the outer
 * scope into `into`.
 */
function spreadParsed(
  instanceNode: LiveNode,
  root: LiveNode,
  outer: SceneScope,
  into: SceneScope
): { properties: TscnNode['properties']; scope: SceneScope } {
  const instanceProperties = definedProperties(instanceNode.properties as Record<string, unknown>);
  const { raw: rehomed, scope } = rehomeOverride(stringValues(instanceProperties), outer, into);
  return { properties: { ...root.properties, ...instanceProperties, ...rehomed }, scope };
}

function stringValues(props: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/** The merged raw map when both nodes have one, the typed properties and their scope. */
function mergeProperties(
  instanceNode: LiveNode,
  root: LiveNode,
  scopes: InstanceScopes
): { raw: Record<string, string> | undefined; properties: TscnNode['properties']; scope: SceneScope } {
  if (!root.rawProperties || !instanceNode.rawProperties) {
    return { raw: undefined, ...spreadParsed(instanceNode, root, scopes.outer, scopes.content) };
  }
  const { raw, scope } = mergeRaw(instanceNode.rawProperties, root, root.rawProperties, scopes);
  return { raw, properties: parseMerged(instanceNode, root, raw, parserRegistrationOf(root.type)), scope };
}

/** A type the registry lacks parses as a Node, as `parseNodeWithRegistry` parses it. */
function parserRegistrationOf(type: string): NodeTypeRegistration {
  const registration = nodeRegistry.getRegistration(type) ?? nodeRegistry.getRegistration('Node');
  if (!registration) throw new Error(`expected a registered parser for ${type} or Node, found neither`);
  return registration;
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

  const { raw: mergedRaw, properties: mergedProperties, scope } = mergeProperties(instanceNode, root, scopes);

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
    children: graftInstanceChildren(root.children, instanceNode.children, scopes),
    // The sub-scene's scope replaces the instance node's own: the merged node sits inside it.
    scope,
  };
}
