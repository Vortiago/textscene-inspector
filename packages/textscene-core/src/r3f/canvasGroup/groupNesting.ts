/**
 * How the mounted groups of one scene nest: which clipping owners draw nothing, which group
 * encloses which, and the order the groups fit in.
 */

import type * as THREE from 'three';
import type { CanvasClip } from '../lighting2d/lightPassHost';
import { collects } from './groupWindow';
import type { CanvasGroupEntry, ClippingEntry } from './groupEntries';
import type { KeyedScene } from './keyedScene';

/** The mounted groups of one scene, and how they nest. */
export interface SceneGroups {
  /** Written only by `registerCanvasGroup`. */
  readonly entries: Set<CanvasGroupEntry>;
  /**
   * Written by `nestingOf` on the first frame after a change, or after the set of clipping groups
   * whose owner draws nothing changes. `registerCanvasGroup` clears it.
   */
  nesting: GroupNesting | null;
}

/** How the mounted groups of one scene nest. Stable while no group mounts or unmounts. */
export interface GroupNesting {
  /** The groups left out of the nesting: clipping groups whose owner draws nothing. */
  inert: readonly ClippingEntry[];
  /** Every group, the innermost first, so an enclosing group merges the rect of each group inside it. */
  innermostFirst: CanvasGroupEntry[];
  /** The groups whose window collects each group's own key. */
  enclosing: ReadonlyMap<CanvasGroupEntry, readonly CanvasGroupEntry[]>;
  /** The groups inside no other group's window, whose items the frame leaves out. */
  outermost: CanvasGroupEntry[];
}

/**
 * The clipping groups whose owner draws no pixel. Godot attaches no group to an item with no
 * commands (`renderer_canvas_cull.cpp:476`), so its children draw as they would without it.
 */
export function clipGroupsDrawingNothing(
  entries: ReadonlySet<CanvasGroupEntry>,
  { keys, boxes }: KeyedScene
): ClippingEntry[] {
  const clipping = [...entries].filter((group): group is ClippingEntry => group.kind === 'clip');
  if (clipping.length === 0) return clipping;
  // The own slots `[own, own + 1)` do not overlap, so a search finds the owner of a key.
  const byOwn = [...clipping].sort((a, b) => a.window.own - b.window.own);
  const draws = new Set<ClippingEntry>();
  for (let i = 0; i < boxes.length && draws.size < byOwn.length; i++) {
    if (!boxes[i]) continue;
    const owner = ownerOfKey(byOwn, keys[i]!);
    if (owner) draws.add(owner);
  }
  return clipping.filter((group) => !draws.has(group));
}

/** The group whose own slot holds `key`, among `byOwn`, which are sorted by `window.own`. */
function ownerOfKey(byOwn: readonly ClippingEntry[], key: number): ClippingEntry | undefined {
  let low = 0;
  let high = byOwn.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const { window } = byOwn[mid]!;
    if (key < window.own) high = mid - 1;
    else if (key >= window.own + 1) low = mid + 1;
    else return byOwn[mid];
  }
  return undefined;
}

/** `nestingOf` over the groups that are not in `inert`, which only a clipping owner with no pixel is. */
export function nestingOf(groups: SceneGroups, inert: readonly ClippingEntry[]): GroupNesting {
  const cached = groups.nesting;
  if (cached && cached.inert.length === inert.length && cached.inert.every((group) => inert.includes(group)))
    return cached;
  const entries = [...groups.entries].filter((group) => group.kind === 'composite' || !inert.includes(group));
  const enclosing = new Map(
    entries.map((inner) => [
      inner,
      entries.filter((group) => group !== inner && collects(group.window, inner.window.own)),
    ])
  );
  const around = (group: CanvasGroupEntry) => enclosing.get(group)!;
  const nesting = {
    inert,
    innermostFirst: entries.sort((a, b) => around(b).length - around(a).length),
    enclosing,
    outermost: entries.filter((group) => around(group).length === 0),
  };
  groups.nesting = nesting;
  return nesting;
}

/** Fits every group, the innermost first, and answers the groups whose `fit` answered a rect. */
export function fitGroups(
  { innermostFirst, enclosing }: GroupNesting,
  drawn: ReadonlyMap<CanvasGroupEntry, THREE.Box3[]>,
  frameClip: CanvasClip | null
): ReadonlySet<CanvasGroupEntry> {
  const drawing = new Set<CanvasGroupEntry>();
  for (const group of innermostFirst) {
    const around = enclosing.get(group)!;
    const rect = group.fit(drawn.get(group)!, around.length > 0, frameClip);
    if (!rect) continue;
    drawing.add(group);
    for (const outer of around) drawn.get(outer)!.push(rect);
  }
  return drawing;
}
