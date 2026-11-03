/**
 * The relay cycle check of RemoteTransform3D and RemoteTransform2D. A push moves the target, which
 * queues every relay in global coordinates that the move reaches, and that relay pushes on the next
 * transform flush (`remote_transform_3d.cpp:118-126`, `remote_transform_2d.cpp:127-136`). A relay
 * cycle so pushes on every frame without end, and no one frame's pose is the game's pose. A local
 * relay pushes the moment its own local transform changes, so a cycle of local relays recurses.
 */

import type { RawNode, RawScene } from '../../../parser/types.js';
import type { Diagnostic, RuleArm, RuleContext } from '../../../linter/types.js';
import { armDiagnostic } from '../../../linter/ruleArms.js';
import { extractNodePath, nodesOfType } from '../../../linter/linterUtils.js';
import { parentIdentity } from '../../../linter/parentType.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { perObject } from '../../../utils/perObject.js';
import { RELAY_CLASSES, flagsAnyPart } from './relayRules.js';
import { nodesAMoveReaches, relayOf, type Relay, type RelayTreeView } from './relayTree.js';

/** The arm that warns on a relay in a cycle, grounded on the push `pushAt` names (`file.cpp:line`). */
export function relayCycleArm(ruleName: string, pushAt: string): RuleArm {
  return { severity: 'warning', ruleName, grounding: { kind: 'engine', at: pushAt } };
}

/** A warning under `arm` when the relay of `context` is in a relay cycle that Godot runs. */
export function relayCycleDiagnostics(arm: RuleArm, { node, scene }: RuleContext): Diagnostic[] {
  const kind = relayCyclesOf(scene).get(node);
  if (!kind) return [];
  return [
    armDiagnostic(
      arm,
      node,
      `${node.type} '${node.name}' is in a relay cycle: its target carries a relay that leads back to it. ` +
        CYCLE_CONSEQUENCES[kind]
    ),
  ];
}

/** How Godot runs a relay cycle: once on each transform flush, or inside one push without end. */
type CycleKind = 'perFlush' | 'recursive';

const CYCLE_CONSEQUENCES: Readonly<Record<CycleKind, string>> = {
  perFlush:
    'Godot pushes these relays again on every frame without end, so their pose depends on the frame count.',
  recursive:
    'Godot pushes these relays inside one another without end when the scene loads, and overflows its stack.',
};

/** The parsed scene as the relay walk reads it, a node's parent found by its `parent=` path. */
const rawRelayView = perObject((scene: RawScene): RelayTreeView<RawNode> => ({
  typeOf: (node) => node.type,
  rawPropertiesOf: (node) => node.rawProperties,
  childrenOf: (node) => node.children,
  parentOf: (node) => parentIdentity(scene, node),
  isSame: (node, other) => node === other,
  nodeAt: (from, literal) => {
    const path = extractNodePath(literal ?? '');
    const resolved = path ? resolveNodePath(scene, from, path) : null;
    return resolved?.status === 'found' ? resolved.node : null;
  },
}));

/**
 * The relays of `scene` on a cycle that Godot runs, and how it runs it. A cycle that holds a relay
 * in global coordinates pushes on every flush. A cycle of local relays alone pushes the moment a
 * push starts it, inside that push. A relay in global coordinates and every RemoteTransform2D push
 * on the first flush (`remoteTransforms.ts`), so a local cycle one of them leads to recurses.
 */
const relayCyclesOf = perObject((scene: RawScene): ReadonlyMap<RawNode, CycleKind> => {
  const view = rawRelayView(scene);
  const relays = Object.keys(RELAY_CLASSES)
    .flatMap((type) => nodesOfType(scene.nodes, type))
    .flatMap((node) => relayOf(view, node) ?? []);
  const relayAt = new Map(relays.map((relay) => [relay.node, relay]));
  const queuedBy = new Map(relays.map((relay) => [relay, relaysAPushOfMoves(relay, view, relayAt)]));
  const reachedFrom = perObject((relay: Relay<RawNode>) => relaysReached(relay, queuedBy));
  const pushesAtLoad = (relay: Relay<RawNode>): boolean =>
    relay.relayClass.space === 'Node2D' || relay.flags.useGlobal;
  const isStartedAtLoad = (relay: Relay<RawNode>): boolean =>
    relays.some((starter) => pushesAtLoad(starter) && (starter === relay || reachedFrom(starter).has(relay)));
  const kinds = new Map<RawNode, CycleKind>();
  for (const relay of relays) {
    const cycle = [...reachedFrom(relay)].filter((other) => reachedFrom(other).has(relay));
    if (cycle.some((other) => other.flags.useGlobal)) kinds.set(relay.node, 'perFlush');
    else if (cycle.length > 0 && isStartedAtLoad(relay)) kinds.set(relay.node, 'recursive');
  }
  return kinds;
});

/** Every relay a push of `from` leads to, relay by relay, `from` included when it leads back. */
function relaysReached<R>(from: R, queuedBy: ReadonlyMap<R, readonly R[]>): Set<R> {
  const reached = new Set<R>();
  const pending = [...(queuedBy.get(from) ?? [])];
  for (let next = pending.pop(); next; next = pending.pop()) {
    if (reached.has(next)) continue;
    reached.add(next);
    pending.push(...(queuedBy.get(next) ?? []));
  }
  return reached;
}

/**
 * The relays that a push of `relay` makes push again: each relay in global coordinates that its
 * move of the target reaches, and the target itself when it is a relay in local coordinates, as
 * its own local transform changed (`node_3d.cpp:398-400`, `canvas_item.h:173-178`). A relay with no
 * part flagged leaves the pose as it is, so it moves no cycle. A target in another file is not seen.
 */
function relaysAPushOfMoves(
  { target, relayClass, flags }: Relay<RawNode>,
  view: RelayTreeView<RawNode>,
  relayAt: ReadonlyMap<RawNode, Relay<RawNode>>
): Relay<RawNode>[] {
  if (!flagsAnyPart(flags)) return [];
  return nodesAMoveReaches(view, target, relayClass.reached).flatMap((node) => {
    const reached = relayAt.get(node);
    return reached && (reached.flags.useGlobal || node === target) ? [reached] : [];
  });
}
