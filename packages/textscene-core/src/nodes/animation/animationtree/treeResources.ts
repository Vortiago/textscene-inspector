/**
 * Render-side resolution of an AnimationTree's `tree_root` into a typed `AnimNode` graph for
 * `evaluateTree`. THREE-free and React-free: it reads only the SubResource `data` strings, the
 * `internalResources` that `resolveAnimations` also reads. A `tree_root` is a BlendTree (sub-nodes
 * wired by `node_connections`) or a StateMachine, whose leaves are `AnimationNodeAnimation` clips.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { unquoteLiteral } from '../../../parser/utils';
import { findSubResource } from '../../../resources/SubResourceResolver';
import {
  ARRAY_LITERAL_RE,
  arrayLiteralBody,
  boolSlotValue,
  dropTrailingComma,
  ruleInt,
  splitTopLevel,
  subResourceRefAnywhere,
} from '../../../godot/index.js';

/** One node of a resolved AnimationTree. */
export type AnimNode =
  | AnimationLeaf
  | Blend2Node
  | Add2Node
  | TimeScaleNode
  | StateMachineNode
  | PassthroughNode;

/** Plays a single named clip from the resolved AnimationPlayer. */
export interface AnimationLeaf {
  kind: 'animation';
  /** Clip name (the `&"name"` StringName of `AnimationNodeAnimation.animation`). */
  clip: string;
}

/** Linear blend: `out = in0·(1−amount) + in1·amount` (Godot `AnimationNodeBlend2`). */
export interface Blend2Node {
  kind: 'blend2';
  /** BlendTree-local node name, used for `parameters/<name>/blend_amount`. */
  name: string;
  in0: AnimNode | null;
  in1: AnimNode | null;
  /** `filter_enabled`: recorded, but the clip-weight approximation does not model it per bone. */
  filtered: boolean;
}

/** Additive blend: `out = base + add·amount` (Godot `AnimationNodeAdd2`). */
export interface Add2Node {
  kind: 'add2';
  /** BlendTree-local node name, used for `parameters/<name>/add_amount`. */
  name: string;
  base: AnimNode | null;
  add: AnimNode | null;
}

/** Scales the playback rate of its input (Godot `AnimationNodeTimeScale`). */
export interface TimeScaleNode {
  kind: 'timescale';
  /** BlendTree-local node name, used for `parameters/<name>/scale`. */
  name: string;
  input: AnimNode | null;
}

/** A state machine: the active state's node plays at full weight. */
export interface StateMachineNode {
  kind: 'statemachine';
  /** BlendTree-local node name (`''` when this is the `tree_root` itself), used
   *  to scope the `parameters/<name>/current_state` lookup. */
  name: string;
  /** State name → resolved node, in authored order. */
  states: Array<{ name: string; node: AnimNode | null }>;
  /** State to enter when no `current_state` parameter is set (start node). */
  startState: string | null;
}

/**
 * A single-input AnimationNode this does not model precisely (OneShot, Transition, BlendSpace,
 * nested unknown). Evaluation passes its input through unchanged, so the tree does not go blank.
 */
export interface PassthroughNode {
  kind: 'passthrough';
  /** Original Godot type, for debugging / linting. */
  type: string;
  name: string;
  input: AnimNode | null;
}

export function resolveTreeRoot(
  treeRootRef: string | undefined,
  resources: readonly TscnInternalResource[]
): AnimNode | null {
  if (!treeRootRef) return null;
  const id = extractSubResourceId(treeRootRef);
  if (id === null) return null;
  return resolveNodeById(id, resources, new Set());
}

/** Extract the id from a `SubResource("id")` reference. */
function extractSubResourceId(ref: string): string | null {
  return subResourceRefAnywhere(ref);
}

/**
 * The one door from a sub-resource id to a node, so the cycle guard covers every recursion path.
 * Godot allows a cycle (animation_blend_tree.cpp:1489-1493 and :1615-1619 refuse neither), and a
 * re-entry in this render-phase `useMemo` would blank the preview. `visiting` is the per-branch
 * path, not a visited set, so one sub-resource wired into two ports resolves on both.
 */
function resolveNodeById(
  id: string,
  resources: readonly TscnInternalResource[],
  visiting: Set<string>,
  name = '',
  inputs: (port: number) => AnimNode | null = () => null
): AnimNode | null {
  if (visiting.has(id)) return null;
  const resource = findSubResource(resources, id);
  if (!resource) return null;
  return resolveInnerNode(resource, name, resources, new Set(visiting).add(id), inputs);
}

/**
 * Resolve a non-BlendTree AnimationNode whose inputs (if any) come from a
 * surrounding BlendTree's connections. `name` is the node's BlendTree-local
 * name (empty when the node is the `tree_root` itself, with no inputs). The
 * `inputs` map yields an input port's resolved node.
 */
function resolveInnerNode(
  resource: TscnInternalResource,
  name: string,
  resources: readonly TscnInternalResource[],
  visiting: Set<string>,
  inputs: (port: number) => AnimNode | null = () => null
): AnimNode | null {
  switch (resource.type) {
    case 'AnimationNodeAnimation': {
      const clip = unquoteLiteral((asString(resource.data['animation']) ?? '').trim());
      return clip.length > 0 ? { kind: 'animation', clip } : null;
    }
    case 'AnimationNodeBlend2':
      return {
        kind: 'blend2',
        name,
        filtered: boolSlotValue(asString(resource.data['filter_enabled'])) === true,
        in0: inputs(0),
        in1: inputs(1),
      };
    case 'AnimationNodeAdd2':
      return { kind: 'add2', name, base: inputs(0), add: inputs(1) };
    case 'AnimationNodeTimeScale':
      return { kind: 'timescale', name, input: inputs(0) };
    case 'AnimationNodeBlendTree':
      return resolveBlendTree(resource, resources, visiting);
    case 'AnimationNodeStateMachine':
      return resolveStateMachine(resource, name, resources, visiting);
    default:
      return { kind: 'passthrough', type: resource.type, name, input: inputs(0) };
  }
}

/**
 * Resolve an `AnimationNodeBlendTree`: read its `nodes/<name>/node`
 * sub-resource map and `node_connections` wiring, then resolve the node feeding
 * the implicit `output` sink (port 0).
 */
function resolveBlendTree(
  blendTree: TscnInternalResource,
  resources: readonly TscnInternalResource[],
  visiting: Set<string>
): AnimNode | null {
  const nodeIds = parseBlendTreeNodes(blendTree.data);
  const connections = parseConnections(asString(blendTree.data['node_connections']) ?? '');

  const resolveLocal = (localName: string, seen: Set<string>): AnimNode | null => {
    if (seen.has(localName)) return null; // cyclic connection guard
    const subId = nodeIds.get(localName);
    if (subId === undefined) return null;
    const nextSeen = new Set(seen).add(localName);
    return resolveNodeById(subId, resources, visiting, localName, (port) => {
      const from = connections.get(`${localName}:${port}`);
      return from === undefined ? null : resolveLocal(from, nextSeen);
    });
  };

  const rootName = connections.get('output:0');
  return rootName === undefined ? null : resolveLocal(rootName, new Set());
}

/**
 * `nodes/<name>/node = SubResource("id")` → `name → id`. A quoted key reads as the tokenizer reads
 * it, escapes decoded, so a name holding `"` matches the `&"…"` token that wires it.
 */
function parseBlendTreeNodes(data: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [rawKey, rawValue] of Object.entries(data)) {
    const key = unquoteLiteral(rawKey);
    const match = /^nodes\/(.+)\/node$/.exec(key);
    if (!match || match[1] === undefined) continue;
    const id = extractSubResourceId(asString(rawValue) ?? '');
    if (id !== null) out.set(match[1], id);
  }
  return out;
}

/**
 * Parse a BlendTree's `node_connections` flat array of
 * `[&"toNode", port, &"fromNode", …]` triples into a
 * `"toNode:port" → fromNode` map.
 */
function parseConnections(raw: string): Map<string, string> {
  // Split the array rather than scanning tokens: a `&"…"|-?\d+` scan reads the port `1e1` as two
  // tokens, shifting every later triple, and skips a plain `"Blend"`, which
  // `Variant::operator StringName()` converts and Godot therefore wires.
  const body = ARRAY_LITERAL_RE.exec(raw.trim());
  if (!body) return new Map();
  const tokens = dropTrailingComma(splitTopLevel(body[1]!));
  const out = new Map<string, string>();
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const to = unquoteLiteral(tokens[i]!);
    // `connect_node`'s port is an int slot (animation_blend_tree.cpp:1766), read like every int
    // slot, including a string, which `Variant::_to_int` routes through `String::to_int()`
    // (variant.h:372). An unreadable `"0"` would drop the triple and leave the tree with no root.
    const port = ruleInt(unquoteLiteral(tokens[i + 1]!));
    const from = unquoteLiteral(tokens[i + 2]!);
    if (port === null) continue;
    out.set(`${to}:${port}`, from);
  }
  return out;
}

/**
 * Resolve an `AnimationNodeStateMachine`: read its `states/<name>/node`
 * sub-resources and pick a start state. With no runtime `travel`, the start
 * state is the target of a transition from the implicit `Start` node, falling
 * back to the first authored state.
 */
function resolveStateMachine(
  resource: TscnInternalResource,
  name: string,
  resources: readonly TscnInternalResource[],
  visiting: Set<string>
): AnimNode | null {
  const states: StateMachineNode['states'] = [];
  for (const [rawKey, rawValue] of Object.entries(resource.data)) {
    const match = /^states\/(.+)\/node$/.exec(unquoteLiteral(rawKey));
    if (!match || match[1] === undefined) continue;
    const subId = extractSubResourceId(asString(rawValue) ?? '');
    const node = subId === null ? null : resolveNodeById(subId, resources, visiting);
    states.push({ name: match[1], node });
  }

  return {
    kind: 'statemachine',
    name,
    states,
    startState: pickStartState(asString(resource.data['transitions']) ?? '', states),
  };
}

/**
 * Target of a `Start →` transition, else the first authored state.
 *
 * `transitions = [&"Start", &"Idle", SubResource("…"), …]` is split as the
 * array it is, the way `parseConnections` reads its triples.
 */
function pickStartState(
  transitions: string,
  states: StateMachineNode['states']
): string | null {
  const body = arrayLiteralBody(transitions);
  const tokens = body === null ? [] : dropTrailingComma(splitTopLevel(body));
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const from = unquoteLiteral(tokens[i]!);
    if (from === 'Start') return unquoteLiteral(tokens[i + 1]!);
  }
  return states[0]?.name ?? null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
