/**
 * Settles each owner hand-off ({@link OwnerHandOff}). A setting whose `owner=` walk enters one
 * instance, and whose `owner_uid_path=` owner sits in another, lands in the second only where the
 * first lacks the walked owner (packed_scene.cpp:159-163). Only the first instance's graft knows, so
 * it collapses before the second lands its copy of the setting.
 */

import type { SceneScope } from '../parser/types';
import { reseatedRoots, sceneRootFallbacks, type RootFallback } from '../parser/sceneTreeBuilder';
import { cachedUniqueNamesBelowRoot } from '../utils/uniqueNames';
import type { UniqueNameTable } from './instanceNameTable';
import type { InstanceNameSetting, OwnerHandOff } from '../parser/nodeOwner';
import { scopeOf, type LiveNode } from './liveNode';
import { indicesWhere, replacedAtIndices } from './liveTreeIndex';
import type { CollapseInstance } from './seatEscaped';
import { perObject } from '../utils/perObject';

const holdsSetting = (node: LiveNode, isIt: (setting: InstanceNameSetting) => boolean): boolean =>
  node.instanceNameSettings?.some(isIt) ?? false;

/** Whether `node` holds a setting that its graft hands off where its `owner=` walk finds nothing. */
export function handsOffOwner(node: LiveNode): boolean {
  return holdsSetting(node, (setting) => setting.ownerHandOff !== undefined);
}

/** Whether a node at or below `node` holds a setting that its graft may hand off. */
const holdsHandingOff = perObject(
  (node: LiveNode): boolean => handsOffOwner(node) || node.children.some(holdsHandingOff)
);

/** Whether a node at or below `node` holds a setting that awaits a hand-off. */
const holdsAwaiting = perObject(
  (node: LiveNode): boolean =>
    holdsSetting(node, (setting) => setting.awaits !== undefined) || node.children.some(holdsAwaiting)
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
  let settled = nodes;
  for (const handOff of awaitedIn(nodes)) {
    if (outcomeOf(nodes, handOff, scope, collapse) === 'handed')
      settled = withHandOffLanded(settled, handOff);
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
  const fallbacks = sceneRootFallbacks(roots);
  const found = fallbacks.filter(({ handOff }) => outcomeOf(roots, handOff, scope, collapse) === 'kept');
  if (found.length === 0) return roots;
  const key = found.map((fallback) => fallbacks.indexOf(fallback)).join(',');
  let byFound = reseatings.get(roots);
  if (!byFound) reseatings.set(roots, (byFound = new Map()));
  if (!byFound.has(key)) byFound.set(key, reseatedWithTable(roots, found));
  return byFound.get(key)!;
}

/**
 * Written only by {@link withRootFallbacksDecided}: the roots it seated again, keyed by the roots
 * and the indices of the fallbacks whose walk found an owner. An entry clears with its roots, so a
 * rebuild over one parse keeps one tree, and the caches keyed by its nodes.
 */
// eslint-disable-next-line no-restricted-syntax -- a cache keyed by the parse's roots, never mutated after a write
const reseatings = new WeakMap<readonly LiveNode[], Map<string, readonly LiveNode[]>>();

/** `roots` seated again with the owners of `found` found, the root carrying that seating's table. */
function reseatedWithTable(roots: readonly LiveNode[], found: readonly RootFallback[]): readonly LiveNode[] {
  const reseated = reseatedRoots(roots, new Set(found.map(({ heading }) => heading)));
  const table: UniqueNameTable = { paths: () => cachedUniqueNamesBelowRoot(reseated) };
  return reseated.map((root) => ({ ...root, uniqueNames: table }));
}

/**
 * What the instance whose setting carries `handOff` does with it: `handed` where its `owner=` walk
 * finds no node, `kept` where it finds one, and `undecided` where no loaded instance carries it.
 */
function outcomeOf(
  nodes: readonly LiveNode[],
  handOff: OwnerHandOff,
  scope: SceneScope,
  collapse: CollapseInstance
): 'handed' | 'kept' | 'undecided' {
  const source = sourceOf(nodes, handOff, scope);
  if (!source) return 'undecided';
  const collapsed = collapse(source.node, source.scope);
  if ((collapsed.handedOff ?? []).includes(handOff)) return 'handed';
  return collapsed === source.node ? 'undecided' : 'kept';
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
    if (!holdsHandingOff(node)) continue;
    if (holdsSetting(node, (setting) => setting.ownerHandOff === handOff)) {
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
  const at = indicesWhere(tree, (node) => holdsSetting(node, awaitsIt))!;
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
