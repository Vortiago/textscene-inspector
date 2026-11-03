/**
 * The walk the RemoteTransform pass and the relay cycle check share: the target a relay moves, and
 * the nodes a move of that target notifies, in Godot's order. Each reads its own tree through a
 * {@link RelayTreeView}: the pass the live tree, the linter the parsed scene. The linter bundle
 * registers validators and no node parsers, so it has no typed nodes to build a live tree from.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { parseOptionalBool } from '../../../parser/valueParsers.js';
import { RELAY_CLASSES, type RelayClass, type RemoteFlags } from './relayRules.js';

/** What the walk reads of a tree whose nodes are `N`. */
export interface RelayTreeView<N> {
  typeOf(node: N): string;
  /** The node's properties as written, which both parsers publish (`RawNode.rawProperties`). */
  rawPropertiesOf(node: N): Readonly<Record<string, string>>;
  childrenOf(node: N): readonly N[];
  parentOf(node: N): N | null;
  isSame(node: N, other: N): boolean;
  /** The node the raw `NodePath("…")` value `literal` names from `from`, or null. */
  nodeAt(from: N, literal: string | undefined): N | null;
}

/** A RemoteTransform3D or RemoteTransform2D and the target Godot caches for it on enter-tree. */
export interface Relay<N> {
  readonly node: N;
  readonly target: N;
  readonly relayClass: RelayClass;
  readonly flags: RemoteFlags;
}

/**
 * `node` as a relay, or null where it is no relay or Godot refuses its target: a target that is not
 * a Node3D (for a RemoteTransform3D) or a Node2D (for a RemoteTransform2D), as the cast fails
 * (`remote_transform_3d.cpp:54`), or one on the relay's own line of the tree
 * (`remote_transform_3d.cpp:37`).
 */
export function relayOf<N>(view: RelayTreeView<N>, node: N): Relay<N> | null {
  const relayClass = RELAY_CLASSES[view.typeOf(node)];
  if (!relayClass) return null;
  const props = view.rawPropertiesOf(node);
  const target = view.nodeAt(node, props.remote_path);
  if (!target || isOnOneLine(view, node, target)) return null;
  if (!descendsFromClass(view.typeOf(target), relayClass.space)) return null;
  return { node, target, relayClass, flags: relayFlagsOf(props) };
}

/** The flags of the relay whose raw properties are `props`, each defaulting to Godot's `true`. */
function relayFlagsOf(props: Readonly<Record<string, string>>): RemoteFlags {
  const isSet = (key: string): boolean => parseOptionalBool(props[key]) !== false;
  return {
    updatePosition: isSet('update_position'),
    updateRotation: isSet('update_rotation'),
    updateScale: isSet('update_scale'),
    useGlobal: isSet('use_global_coordinates'),
  };
}

/** Whether one node is the other or above it. */
function isOnOneLine<N>(view: RelayTreeView<N>, node: N, other: N): boolean {
  return isAtOrAbove(view, node, other) || isAtOrAbove(view, other, node);
}

function isAtOrAbove<N>(view: RelayTreeView<N>, upper: N, node: N): boolean {
  for (let at: N | null = node; at !== null; at = view.parentOf(at)) {
    if (view.isSame(at, upper)) return true;
  }
  return false;
}

/**
 * `target` and the nodes below it that a move of it notifies, in the order Godot queues them: a
 * Node3D queues its Node3D children's subtrees before itself (`node_3d.cpp:106-133`), a CanvasItem
 * itself before its CanvasItem children's (`canvas_item.cpp:1069-1101`). A `top_level` child keeps
 * its place, so the walk stops there.
 */
export function nodesAMoveReaches<N>(view: RelayTreeView<N>, target: N, reached: RelayClass['reached']): N[] {
  const nodes: N[] = [];
  const isReached = (child: N): boolean =>
    descendsFromClass(view.typeOf(child), reached) &&
    parseOptionalBool(view.rawPropertiesOf(child).top_level) !== true;
  const walk = (node: N): void => {
    if (reached === 'CanvasItem') nodes.push(node);
    for (const child of view.childrenOf(node)) if (isReached(child)) walk(child);
    if (reached === 'Node3D') nodes.push(node);
  };
  walk(target);
  return nodes;
}
