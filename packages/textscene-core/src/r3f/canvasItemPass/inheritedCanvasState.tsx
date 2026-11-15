/**
 * What a drawn canvas item inherits from the item above it: modulate, `z_final`, material and
 * sampler (ADR-0074). An item of the shared live tree reads its pass parent's result, so an item
 * drawn away from its tree parent needs nothing folded in. An item drawn outside that tree, such as
 * a scene tile, reads the item that draws it through `CanvasParentContext`.
 */

import { createContext, useContext, useMemo } from 'react';
import { useLiveScenePassSelection } from '../liveScenePass';
import type { SceneScope, TscnNode } from '../../parser/types';
import { canvasItemFieldsOf, type CanvasItemNodeFields } from './canvasItemFields';
import {
  CHAIN_START,
  canvasItemPass,
  handedDownState,
  type CanvasItemPassResult,
  type InheritedCanvasItemState,
} from './canvasItemPass';
import type { CanvasAncestorMaterial } from './canvasItemPass';

/**
 * The drawn canvas item a subtree sits in: one of the shared live tree, by its live path, or one
 * drawn outside it, by the state it hands down.
 */
export type CanvasParent = { readonly path: string } | { readonly state: InheritedCanvasItemState };

/** What a subtree with no canvas item above it inherits, as below a CanvasLayer. */
export const CHAIN_START_PARENT: CanvasParent = { state: CHAIN_START };

const CanvasParentContext = createContext<CanvasParent>(CHAIN_START_PARENT);
CanvasParentContext.displayName = 'CanvasParentContext';

/** Written by each drawn canvas item for its subtree, and by a chain start with `CHAIN_START_PARENT`. */
export const CanvasParentProvider = CanvasParentContext.Provider;

/** The drawn canvas item the caller sits in. */
function useCanvasParent(): CanvasParent {
  return useContext(CanvasParentContext);
}

/**
 * What the item at live path `path` inherits. A null path, or one the pass does not hold, is an
 * item drawn outside the shared live tree, which inherits from the drawn item above it.
 *
 * @canonical The modulate, z_final, material and sampler a canvas item inherits
 */
export function useInheritedCanvasState(path: string | null): InheritedCanvasItemState {
  const above = useCanvasParent();
  const select = useMemo(
    () => (results: ReadonlyMap<string, CanvasItemPassResult>) => inheritedAt(results, path, above),
    [path, above]
  );
  return useLiveScenePassSelection(canvasItemPass, select, sameInherited) ?? handedDownBy(NO_RESULTS, above);
}

/**
 * What the item at `path` inherits in `results`, drawn inside `above`. A second item drawn for the
 * node `above` already draws, such as a tile layer's row, is a child of that node's item.
 */
function inheritedAt(
  results: ReadonlyMap<string, CanvasItemPassResult>,
  path: string | null,
  above: CanvasParent
): InheritedCanvasItemState {
  if ('path' in above && above.path === path) return results.get(path)?.inherited ?? CHAIN_START;
  const own = path === null ? undefined : results.get(path);
  if (own) return own.parent === null ? CHAIN_START : (results.get(own.parent)?.inherited ?? CHAIN_START);
  return handedDownBy(results, above);
}

/**
 * What the drawn item the caller sits in hands down: the ambient of a painter inside an item's
 * group. An item's own inheritance comes from `useInheritedCanvasState`, which follows the tree.
 */
export function useEnclosingCanvasState(): InheritedCanvasItemState {
  const above = useCanvasParent();
  const select = useMemo(
    () => (results: ReadonlyMap<string, CanvasItemPassResult>) => handedDownBy(results, above),
    [above]
  );
  return useLiveScenePassSelection(canvasItemPass, select, sameInherited) ?? handedDownBy(NO_RESULTS, above);
}

/** What `above` hands down in `results`. */
function handedDownBy(
  results: ReadonlyMap<string, CanvasItemPassResult>,
  above: CanvasParent
): InheritedCanvasItemState {
  if ('state' in above) return above.state;
  return results.get(above.path)?.inherited ?? CHAIN_START;
}

/** What a drawn canvas item inherits, and what it publishes for its subtree. */
export interface DrawnCanvasItem {
  readonly inherited: InheritedCanvasItemState;
  readonly handedDown: CanvasParent;
}

/**
 * What the item drawing `node` at live path `path` inherits and publishes. An item of the shared
 * live tree publishes its path, which keeps its identity while values change, so only pass readers
 * whose value moved re-render. Any other item hands down the state its own fields fold.
 */
export function useDrawnCanvasItem(node: TscnNode, path: string | null, scope: SceneScope): DrawnCanvasItem {
  const above = useCanvasParent();
  const select = useMemo(
    () => (results: ReadonlyMap<string, CanvasItemPassResult>) => ({
      inherited: inheritedAt(results, path, above),
      isPassItem: isPassItemAt(results, path, above),
    }),
    [path, above]
  );
  const read =
    useLiveScenePassSelection(canvasItemPass, select, sameReading) ??
    ({ inherited: handedDownBy(NO_RESULTS, above), isPassItem: false } satisfies PassReading);
  const { inherited, isPassItem } = read;
  const byPath = useMemo(() => (path === null ? null : { path }), [path]);
  const folded = useMemo(
    // A node drawn outside the shared tree has no live path, so its name stands in for its clip owner.
    () => (isPassItem ? null : { state: foldNode(node, path ?? node.name, scope, inherited) }),
    [isPassItem, path, node, scope, inherited]
  );
  // The pass holds only items with a live path.
  const handedDown = folded ?? byPath!;
  return { inherited, handedDown };
}

interface PassReading {
  readonly inherited: InheritedCanvasItemState;
  readonly isPassItem: boolean;
}

function sameReading(a: PassReading, b: PassReading): boolean {
  return a.isPassItem === b.isPassItem && sameInherited(a.inherited, b.inherited);
}

/** What the item drawing `node` at `path` hands down, folded over `inherited` by its own fields. */
export function useHandedDownParent(
  node: TscnNode,
  path: string,
  scope: SceneScope,
  inherited: InheritedCanvasItemState
): CanvasParent {
  return useMemo(() => ({ state: foldNode(node, path, scope, inherited) }), [node, path, scope, inherited]);
}

/**
 * What a chain of drawn nodes, outermost first at `paths`, hands an item below it, folded over what
 * the enclosing drawn item hands down. An item of the shared live tree reads the pass instead, so
 * this reaches only an item drawn outside it, such as a lifted node of a scene tile.
 */
export function useHandedDownAlong(
  chain: readonly TscnNode[],
  paths: readonly string[],
  scope: SceneScope
): CanvasParent {
  const enclosing = useEnclosingCanvasState();
  return useMemo(
    () => ({
      state: chain.reduce((above, node, index) => foldNode(node, paths[index]!, scope, above), enclosing),
    }),
    [chain, paths, scope, enclosing]
  );
}

/** What `node` hands down below `above`: its own fold when it is a canvas item, `above` otherwise. */
function foldNode(
  node: TscnNode,
  path: string,
  scope: SceneScope,
  above: InheritedCanvasItemState
): InheritedCanvasItemState {
  const fields = canvasItemFieldsOf(node);
  return fields ? handedDownState(fields, scope, path, above) : above;
}

/** One canvas item of a chain: its fields, the scope its material resolves in, and its path. */
export interface CanvasItemLink {
  readonly fields: CanvasItemNodeFields;
  readonly resources: SceneScope;
  readonly path: string;
}

/**
 * What a Control of a walk's own tree inherits: the items above it in that tree, outermost first,
 * and whether the outermost starts a chain. One that does not hangs below the drawn item the walk
 * sits in, as a root of the walk's tree does.
 */
export interface CanvasInheritance {
  readonly links: readonly CanvasItemLink[];
  readonly startsChain: boolean;
}

/** The inheritance of a Control that starts a chain, as a Window's content does. */
export const CHAIN_START_INHERITANCE: CanvasInheritance = { links: [], startsChain: true };

/** What `inheritance` hands its Control, below the drawn item that hands down `enclosing`. */
export function inheritedAlong(
  { links, startsChain }: CanvasInheritance,
  enclosing: InheritedCanvasItemState
): InheritedCanvasItemState {
  return links.reduce(
    (above, { fields, resources, path }) => handedDownState(fields, resources, path, above),
    startsChain ? CHAIN_START : enclosing
  );
}

/** Whether the pass holds the item at `path`, and it is not a second item drawn for that node. */
function isPassItemAt(
  results: ReadonlyMap<string, CanvasItemPassResult>,
  path: string | null,
  above: CanvasParent
): boolean {
  if (path === null || ('path' in above && above.path === path)) return false;
  return results.has(path);
}

/** No live tree to read: an item reads only what the item it sits in hands down. */
const NO_RESULTS: ReadonlyMap<string, CanvasItemPassResult> = new Map();

/** Equal values, so a pass run for an unrelated change re-renders no item. */
function sameInherited(a: InheritedCanvasItemState, b: InheritedCanvasItemState): boolean {
  if (a === b) return true;
  return (
    a.modulate.r === b.modulate.r &&
    a.modulate.g === b.modulate.g &&
    a.modulate.b === b.modulate.b &&
    a.modulate.a === b.modulate.a &&
    a.zFinal === b.zFinal &&
    a.sampler.filter === b.sampler.filter &&
    a.sampler.repeat === b.sampler.repeat &&
    a.clipOwner === b.clipOwner &&
    sameMaterial(a.material, b.material)
  );
}

function sameMaterial(a: CanvasAncestorMaterial, b: CanvasAncestorMaterial): boolean {
  if (a.kind === 'own' && b.kind === 'own') return a.ref === b.ref && a.resources === b.resources;
  return a.kind === b.kind;
}
