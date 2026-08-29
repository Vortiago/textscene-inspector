/**
 * Render-side resolution of an AnimationTree's `tree_root` into a typed
 * `AnimNode` graph. THREE-free / React-free by design: it reads only the
 * scene's SubResource `data` strings (the same `internalResources` the
 * AnimationPlayer slice consumes via `resolveAnimations`), so the result can
 * be evaluated to a blend program by `evaluateTree` and later feed a linter.
 *
 * A `tree_root` is always a container node — an `AnimationNodeBlendTree`
 * (named sub-nodes wired by `node_connections`) or an
 * `AnimationNodeStateMachine` (named states) — whose leaves are
 * `AnimationNodeAnimation` clips. Blend/add/timescale nodes carry their
 * BlendTree-local NAME so `evaluateTree` can look up the matching
 * `parameters/<name>/…` value authored on the AnimationTree node.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { findSubResource } from '../../../resources/SubResourceResolver';
import {
  ARRAY_LITERAL_RE,
  dropTrailingComma,
  ruleInt,
  splitTopLevel,
  SUB_RESOURCE_REF_ANYWHERE_RE,
  SUB_RESOURCE_REF_BODY,
 boolSlotValue,} from '../../../godot/index.js';

/**
 * `transitions = [&"Start", &"Idle", SubResource("…"), …]` as alternating tokens.
 *
 * Built from the shared reference body rather than spelled out, so the padded
 * form the linter accepts is tokenised here too. `String.match` with a `g`
 * regex resets `lastIndex` itself, so the shared instance is safe to reuse.
 */
const TRANSITION_TOKEN_RE = new RegExp(`"[^"]*"|${SUB_RESOURCE_REF_BODY}`, 'g');

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
  /** `filter_enabled` — recorded but not modelled per-bone (clip-weight approximation). */
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
 * Any single-input AnimationNode we don't model precisely (OneShot,
 * Transition, BlendSpace, nested unknown). Evaluation passes its input
 * through unchanged so the tree degrades gracefully rather than going blank.
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
  return SUB_RESOURCE_REF_ANYWHERE_RE.exec(ref)?.[1] ?? null;
}

/**
 * The ONE door from a sub-resource id to a node, so the cycle guard covers every
 * recursion path. A BlendTree may hold another BlendTree and nothing in the
 * engine stops that chain closing on itself — `add_node` guards only the name,
 * null and `/` (animation_blend_tree.cpp:1489-1493), `connect_node` only a node
 * feeding itself (:1615-1619) — and this runs in a render-phase `useMemo` with
 * no error boundary above it, so an unguarded re-entry blanks the whole preview.
 *
 * `visiting` is the path, not the visited set: the copy is per-branch, so one
 * sub-resource wired into two ports still resolves on both.
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
      const clip = stripStringName(asString(resource.data['animation']) ?? '');
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

/** `nodes/<name>/node = SubResource("id")` → `name → id` (quoted keys allowed). */
function parseBlendTreeNodes(data: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [rawKey, rawValue] of Object.entries(data)) {
    const key = unquoteKey(rawKey);
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
  // Split the array, don't scavenge tokens out of it. A `&"…"|-?\d+` scan read
  // the port `1e1` as the two tokens `1` and `1` — shifting every triple after
  // it — and skipped a plain `"Blend"`, which `Variant::operator StringName()`
  // converts and Godot therefore wires.
  const body = ARRAY_LITERAL_RE.exec(raw.trim());
  if (!body) return new Map();
  const tokens = dropTrailingComma(splitTopLevel(body[1]!));
  const out = new Map<string, string>();
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const to = stripStringName(tokens[i]!);
    // `connect_node`'s port is an int slot (animation_blend_tree.cpp:1766), so
    // it reads the way every other int slot does — including a STRING, which
    // `Variant::_to_int` routes through `String::to_int()` (variant.h:372), the
    // same conversion that lets a plain `"Blend"` reach the StringName slots
    // beside it. Reading `"0"` as unreadable dropped the whole triple and left
    // the tree with no root.
    const port = ruleInt(stripStringName(tokens[i + 1]!));
    const from = stripStringName(tokens[i + 2]!);
    if (port === null) continue;
    out.set(`${to}:${port}`, from);
  }
  return out;
}

/**
 * Resolve an `AnimationNodeStateMachine`: read its `states/<name>/node`
 * sub-resources and pick a start state. With no runtime `travel`, the start
 * state is the target of a transition FROM the implicit `Start` node, falling
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
    const match = /^states\/(.+)\/node$/.exec(unquoteKey(rawKey));
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

/** Target of a `Start →` transition, else the first authored state. */
function pickStartState(
  transitions: string,
  states: StateMachineNode['states']
): string | null {
  const tokens = transitions.match(TRANSITION_TOKEN_RE) ?? [];
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const from = stripStringName(tokens[i]!);
    if (from === 'Start') return stripStringName(tokens[i + 1]!);
  }
  return states[0]?.name ?? null;
}

/** Strip surrounding double-quotes from a property key (spaced keys are quoted). */
function unquoteKey(key: string): string {
  return key.startsWith('"') && key.endsWith('"') ? key.slice(1, -1) : key;
}

/** Strip a Godot StringName literal `&"name"` (or plain `"name"`) to `name`. */
export function stripStringName(raw: string): string {
  const match = /^&?"([^"]*)"$/.exec(raw.trim());
  return match?.[1] ?? raw.trim();
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
