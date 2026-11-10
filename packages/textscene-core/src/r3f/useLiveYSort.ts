/**
 * Keeps one flat y-sort in step with the poses a mixer writes. The hook answers the items with the
 * sort y each draws at now, and re-renders only on a frame where that changes the sorted order.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Object3D } from 'three';
import { useOnMixerPose } from './contexts/AnimatedValueContext.js';
import { useOptionalSelection } from './contexts/SelectionContext.js';
import { trackTargetFinder } from './animation/trackTargets.js';
import { liveGroupChain, sortYOfChain, type GroupAt } from './ySortLiveItems.js';
import { compareYSortItems } from './ySortOrder.js';
import { ySortItemId, type YSortItem } from './ySortItems.js';
import type { LiveNode } from '../resources/liveNode.js';

type LiveYs = ReadonlyMap<string, number>;
const NO_YS: LiveYs = new Map();

interface Pose {
  items: readonly YSortItem[];
  chains: Map<string, Object3D[]>;
  ys: Map<string, number>;
  order: string[] | null;
}

function newPose(items: readonly YSortItem[]): Pose {
  return { items, chains: new Map(), ys: new Map(), order: null };
}

/** The ids of `items` in draw order, with `ys` laid over their authored sort y. */
function drawOrder(items: readonly YSortItem[], ys: LiveYs): string[] {
  return withLiveYs(items, ys).sort(compareYSortItems).map(ySortItemId);
}

function isSameOrder(a: readonly string[], b: readonly string[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Indexed, not `.some`: no closure per item per mixer frame.
function hasDetachedGroup(chain: readonly Object3D[]): boolean {
  for (let i = 0; i < chain.length; i++) if (!chain[i]!.parent) return true;
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
  const pose = useMemo(() => newPose(items), [items]);

  /** `posed` holds the uuids a pose moved. Null reads every item, as the first read does. */
  const onPose = useCallback(
    (posed: ReadonlySet<string> | null) => {
      if (!selection) return;
      const groupAt = cachedGroupAt(selection.nodeObjectMap, groups.current);
      const moves: Array<[string, number]> = [];
      for (const item of pose.items) {
        const id = ySortItemId(item);
        let chain: Object3D[] | null | undefined = pose.chains.get(id);
        if (!chain || hasDetachedGroup(chain)) {
          chain = liveGroupChain(item, basePath, groupAt);
          if (chain) pose.chains.set(id, chain);
        }
        // A pose that moved none of the item's groups leaves its y as it was read.
        if (!chain || (posed && !hasPosedGroup(chain, posed))) continue;
        const y = sortYOfChain(chain, (item.node as LiveNode | undefined)?.ySortRoot?.pose);
        if (y !== (pose.ys.get(id) ?? item.sortY)) moves.push([id, y]);
      }
      // Sorted only when some y moved: the frames of a held pose cost a read of each moved group.
      if (moves.length === 0) return;
      pose.order ??= drawOrder(pose.items, NO_YS);
      for (const [id, y] of moves) pose.ys.set(id, y);
      const order = drawOrder(pose.items, pose.ys);
      if (isSameOrder(order, pose.order)) return;
      pose.order = order;
      // A copy: the render keeps the ys it drew with while later poses write `pose.ys`.
      setLive({ items: pose.items, ys: new Map(pose.ys) });
    },
    [selection, basePath, pose]
  );
  useOnMixerPose(onPose);
  // New items drop the poses read for the old ones, and a paused mixer announces no pose to read
  // them again, so the items read every group once as they arrive.
  useEffect(() => onPose(null), [onPose]);

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
