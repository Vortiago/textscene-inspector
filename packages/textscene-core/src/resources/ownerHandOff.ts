/**
 * Settles each owner hand-off ({@link OwnerHandOff}). A setting whose `owner=` walk enters one
 * instance, and whose `owner_uid_path=` owner sits in another, lands in the second only where the
 * first lacks the walked owner (packed_scene.cpp:159-163). Only the first instance's graft knows, so
 * it collapses before the second lands its copy of the setting.
 */

import type { SceneScope } from '../parser/types';
import { reseatedRoots, sceneRootFallbacks } from '../parser/sceneTreeBuilder';
import { cachedUniqueNamesBelowRoot } from '../utils/uniqueNames';
import type { UniqueNameTable } from './instanceNameTable';
import type { InstanceNameSetting, OwnerHandOff } from '../parser/nodeOwner';
import { scopeOf, type LiveNode } from './liveNode';
import { indicesWhere, replacedAtIndices } from './instanceNameTable';
import type { CollapseInstance } from './seatEscaped';
import { perObject } from '../utils/perObject';

/** Whether `node` holds a setting that its graft hands off where its `owner=` walk finds nothing. */
export function handsOffOwner(node: LiveNode): boolean {
  return node.instanceNameSettings?.some((setting) => setting.ownerHandOff !== undefined) ?? false;
}

const awaitsAny = (node: LiveNode): boolean =>
  node.instanceNameSettings?.some((setting) => setting.awaits !== undefined) ?? false;

/** Whether a node at or below `node` holds a setting that awaits a hand-off. */
const holdsAwaiting = perObject(
  (node: LiveNode): boolean => awaitsAny(node) || node.children.some(holdsAwaiting)
);

/**
 * `nodes` with each setting that awaits a hand-off made to land, where the instance among `nodes`
 * whose setting carries that hand-off hands it off. The same array where none awaits one. `scope`
 * is the scope `nodes` resolve against.
 */
export function withHandOffsSettled(
  nodes: LiveNode[],
  scope: SceneScope,
  collapse: CollapseInstance
): LiveNode[] {
  if (!nodes.some(holdsAwaiting)) return nodes;
  const handedOff = new Map<LiveNode, readonly OwnerHandOff[]>();
  const handedOffBy = ({ node, scope: groupScope }: Source): readonly OwnerHandOff[] => {
    if (!handedOff.has(node)) handedOff.set(node, collapse(node, groupScope).handedOff ?? []);
    return handedOff.get(node)!;
  };
  let settled = nodes;
  for (const handOff of awaitedIn(nodes)) {
    const source = sourceOf(nodes, handOff, scope);
    if (source && handedOffBy(source).includes(handOff)) settled = withHandOffLanded(settled, handOff);
  }
  return settled;
}

/** Every hand-off that a setting at or below `nodes` awaits. */
function awaitedIn(nodes: readonly LiveNode[]): OwnerHandOff[] {
  return nodes.flatMap((node) => [
    ...(node.instanceNameSettings ?? []).flatMap(({ awaits }) => (awaits === undefined ? [] : [awaits])),
    ...(holdsAwaiting(node) ? awaitedIn(node.children) : []),
  ]);
}

/**
 * `roots`, seated again where an instance's `owner=` walk finds the owner of a {@link RootFallback},
 * and with the root carrying the `%Name` table that seating gives it. The same array where every such
 * walk finds none, or enters an instance whose scene is not loaded yet.
 */
export function withRootFallbacksDecided(
  roots: readonly LiveNode[],
  scope: SceneScope,
  collapse: CollapseInstance
): readonly LiveNode[] {
  const found = sceneRootFallbacks(roots)
    .filter(({ handOff }) => findsWalkedOwner(roots, handOff, scope, collapse))
    .map(({ heading }) => heading);
  if (found.length === 0) return roots;
  const reseated = reseatedRoots(roots, new Set(found));
  const table: UniqueNameTable = { paths: () => cachedUniqueNamesBelowRoot(reseated) };
  return reseated.map((root) => ({ ...root, uniqueNames: table }));
}

/** Whether the loaded instance whose setting carries `handOff` keeps it, as its `owner=` walk finds a node. */
function findsWalkedOwner(
  roots: readonly LiveNode[],
  handOff: OwnerHandOff,
  scope: SceneScope,
  collapse: CollapseInstance
): boolean {
  const source = sourceOf(roots, handOff, scope);
  if (!source) return false;
  const collapsed = collapse(source.node, source.scope);
  return collapsed !== source.node && !(collapsed.handedOff ?? []).includes(handOff);
}

/** An instance whose setting carries a hand-off, and the scope of its group. */
interface Source {
  readonly node: LiveNode;
  readonly scope: SceneScope;
}

/** The first instance at or below `nodes` whose setting carries `handOff`, or undefined where none does. */
function sourceOf(
  nodes: readonly LiveNode[],
  handOff: OwnerHandOff,
  groupScope: SceneScope
): Source | undefined {
  for (const node of nodes) {
    if (node.instanceNameSettings?.some((setting) => setting.ownerHandOff === handOff)) {
      return { node, scope: groupScope };
    }
    const below = sourceOf(node.children, handOff, scopeOf(node, groupScope));
    if (below) return below;
  }
  return undefined;
}

/** `tree` with the setting that awaits `handOff` made to land. It keeps its place among the settings, its file order. */
function withHandOffLanded(tree: LiveNode[], handOff: OwnerHandOff): LiveNode[] {
  const awaitsIt = (setting: InstanceNameSetting): boolean => setting.awaits === handOff;
  const at = indicesWhere(tree, (node) => node.instanceNameSettings?.some(awaitsIt) ?? false)!;
  return replacedAtIndices(tree, at, (instance) => ({
    ...instance,
    instanceNameSettings: instance.instanceNameSettings!.map((setting) =>
      awaitsIt(setting) ? withoutAwait(setting) : setting
    ),
  }));
}

function withoutAwait({ awaits: _landed, ...setting }: InstanceNameSetting): InstanceNameSetting {
  return setting;
}
