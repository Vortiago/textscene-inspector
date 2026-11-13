/**
 * Keeps one flat y-sort in step with the poses a mixer writes. The hook answers the items with the
 * sort y each draws at now, and re-renders only on a frame where that changes the sorted order.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Object3D, Scene } from 'three';
import { useOnMixerPose } from './contexts/AnimatedValueContext.js';
import { useOptionalSelection } from './contexts/SelectionContext.js';
import { trackTargetFinder } from './animation/trackTargets.js';
import { liveGroupChain, liveRootPose, sortYOfChain, type GroupAt } from './ySortLiveItems.js';
import { compareSortY } from './ySortOrder.js';
import { ySortItemId, type YSortItem } from './ySortItems.js';

type LiveYs = ReadonlyMap<string, number>;
const NO_YS: LiveYs = new Map();

interface LiveRead {
  items: readonly YSortItem[];
  chains: Map<string, Object3D[]>;
  ys: Map<string, number>;
  order: string[] | null;
}

function newLiveRead(items: readonly YSortItem[]): LiveRead {
  return { items, chains: new Map(), ys: new Map(), order: null };
}

/** The ids of `items` in sort order, with `ys` laid over their authored sort y: y, then collection order. */
function drawOrder(items: readonly YSortItem[], ys: LiveYs): string[] {
  return withLiveYs(items, ys)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compareSortY(a.item.sortY, b.item.sortY) || a.index - b.index)
    .map(({ item }) => ySortItemId(item));
}

function isSameOrder(a: readonly string[], b: readonly string[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Whether `group` still hangs below the scene. A found group is the named one inside a registered
 * wrapper, so it keeps its parent after R3F removes the wrapper: only the climb to the root shows it.
 */
function isDetached(group: Object3D): boolean {
  let top = group;
  while (top.parent) top = top.parent;
  return !(top as Scene).isScene;
}

// Indexed, not `.some`: no closure per item per mixer frame.
function hasDetachedGroup(chain: readonly Object3D[]): boolean {
  for (let i = 0; i < chain.length; i++) if (isDetached(chain[i]!)) return true;
  return false;
}

function hasPosedGroup(chain: readonly Object3D[], posed: ReadonlySet<string>): boolean {
  for (let i = 0; i < chain.length; i++) if (posed.has(chain[i]!.uuid)) return true;
  return false;
}

function withLiveYs(items: readonly YSortItem[], ys: LiveYs): YSortItem[] {
  return ys.size === 0
    ? [...items]
    : items.map((item) => {
        const sortY = ys.get(ySortItemId(item));
        return sortY === undefined ? item : { ...item, sortY };
      });
}

/**
 * `items` with the sort y each draws at after the latest mixer pose. `basePath` is the live path
 * the sort root's children sit below.
 */
export function useLiveYSort(items: readonly YSortItem[], basePath: string): readonly YSortItem[] {
  const selection = useOptionalSelection();
  const [live, setLive] = useState<{ items: readonly YSortItem[]; ys: LiveYs }>({ items, ys: NO_YS });
  const ys = live.items === items ? live.ys : NO_YS;
  /** Written only by the pose listener: the group found for each path, until it detaches. */
  const groups = useRef(new Map<string, Object3D>());
  /**
   * Written only by the pose listener, until `items` change: each item's group chain, the sort y
   * read at the last pose that moved it, and the draw order last rendered.
   */
  const liveRead = useMemo(() => newLiveRead(items), [items]);

  const nodeObjects = selection?.nodeObjectMap;
  /** `posed` holds the uuids a pose moved. Null reads every item, as the first read does. */
  const onPose = useCallback(
    (posed: ReadonlySet<string> | null) => {
      if (!nodeObjects) return;
      const groupAt = cachedGroupAt(nodeObjects, groups.current);
      const moves = readMovedYs(liveRead, basePath, groupAt, posed);
      // Sorted only when some y moved: the frames of a held pose cost a read of each moved group.
      if (moves.length === 0) return;
      if (!applyMoves(liveRead, moves)) return;
      // A copy: the render keeps the ys it drew with while later poses write `liveRead.ys`.
      setLive({ items: liveRead.items, ys: new Map(liveRead.ys) });
    },
    [nodeObjects, basePath, liveRead]
  );
  useOnMixerPose(onPose);
  // New items drop the poses read for the old ones, and a paused mixer announces no pose to read
  // them again, so the items read every group once as they arrive.
  useEffect(() => onPose(null), [onPose]);

  return useMemo(() => withLiveYs(items, ys), [items, ys]);
}

/** The items whose sort y differs from the last read, with the y each draws at now. */
function readMovedYs(
  liveRead: LiveRead,
  basePath: string,
  groupAt: GroupAt,
  posed: ReadonlySet<string> | null
): Array<[string, number]> {
  const moves: Array<[string, number]> = [];
  for (const item of liveRead.items) {
    const id = ySortItemId(item);
    let chain: Object3D[] | null | undefined = liveRead.chains.get(id);
    if (!chain || hasDetachedGroup(chain)) {
      chain = liveGroupChain(item, basePath, groupAt);
      if (chain) liveRead.chains.set(id, chain);
    }
    // A pose that moved none of the item's groups leaves its y as it was read.
    if (!chain || (posed && !hasPosedGroup(chain, posed))) continue;
    const y = sortYOfChain(chain, liveRootPose(item));
    if (y !== (liveRead.ys.get(id) ?? item.sortY)) moves.push([id, y]);
  }
  return moves;
}

/** Writes `moves` into `liveRead`, and answers whether they change the draw order. */
function applyMoves(liveRead: LiveRead, moves: readonly (readonly [string, number])[]): boolean {
  liveRead.order ??= drawOrder(liveRead.items, NO_YS);
  for (const [id, y] of moves) liveRead.ys.set(id, y);
  const order = drawOrder(liveRead.items, liveRead.ys);
  if (isSameOrder(order, liveRead.order)) return false;
  liveRead.order = order;
  return true;
}

/** `groupAt` over the registry, finding each path once and again only after its group detaches. */
function cachedGroupAt(nodeObjects: ReadonlyMap<string, Object3D>, found: Map<string, Object3D>): GroupAt {
  let finder: ReturnType<typeof trackTargetFinder> | null = null;
  return (path) => {
    const cached = found.get(path);
    if (cached && !isDetached(cached)) return cached;
    finder ??= trackTargetFinder(nodeObjects);
    const group = finder(path);
    if (group) found.set(path, group);
    else found.delete(path);
    return group;
  };
}
