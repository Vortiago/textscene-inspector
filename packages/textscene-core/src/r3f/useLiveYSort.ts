/**
 * Keeps one flat y-sort in step with the poses a mixer writes. The hook answers the items with the
 * sort y each draws at now, and re-renders only on a frame where that changes the sorted order.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Object3D } from 'three';
import { useOnMixerPose } from './contexts/AnimatedValueContext.js';
import { useOptionalSelection } from './contexts/SelectionContext.js';
import { trackTargetFinder } from './animation/trackTargets.js';
import { liveSortY, type GroupAt } from './ySortLiveItems.js';
import { compareYSortItems } from './ySortOrder.js';
import { ySortItemId, type YSortItem } from './ySortItems.js';

type LiveYs = ReadonlyMap<string, number>;
const NO_YS: LiveYs = new Map();

/** The ids of `items` in draw order, with `ys` laid over their authored sort y. */
function drawOrder(items: readonly YSortItem[], ys: LiveYs): string {
  return withLiveYs(items, ys).sort(compareYSortItems).map(ySortItemId).join(' ');
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
  /** Written only by the pose listener: each item's sort y at the last pose it read, per `items`. */
  const lastReadRef = useRef<{ items: readonly YSortItem[]; ys: Map<string, number> }>({
    items,
    ys: new Map(),
  });

  const onPose = useCallback(() => {
    if (!selection) return;
    if (lastReadRef.current.items !== items) lastReadRef.current = { items, ys: new Map() };
    const lastRead = lastReadRef.current.ys;
    const groupAt = cachedGroupAt(selection.nodeObjectMap, groups.current);
    const read = new Map<string, number>();
    let moved = false;
    for (const item of items) {
      const y = liveSortY(item, basePath, groupAt);
      if (y === null) continue;
      const id = ySortItemId(item);
      read.set(id, y);
      moved ||= y !== (lastRead.get(id) ?? item.sortY);
    }
    // Sorted only when some y moved: the frames of a held pose cost a read of each group.
    if (!moved) return;
    lastRead.clear();
    for (const [id, y] of read) lastRead.set(id, y);
    if (drawOrder(items, read) !== drawOrder(items, ys)) setLive({ items, ys: read });
  }, [selection, items, basePath, ys]);
  useOnMixerPose(onPose);

  return useMemo(() => withLiveYs(items, ys), [items, ys]);
}

/** `groupAt` over the registry, finding each path once and again only after its group detaches. */
function cachedGroupAt(nodeObjects: ReadonlyMap<string, Object3D>, found: Map<string, Object3D>): GroupAt {
  let finder: ReturnType<typeof trackTargetFinder> | null = null;
  return (path) => {
    const cached = found.get(path);
    if (cached?.parent) return cached;
    finder ??= trackTargetFinder(nodeObjects);
    const group = finder(path);
    if (group) found.set(path, group);
    else found.delete(path);
    return group;
  };
}
