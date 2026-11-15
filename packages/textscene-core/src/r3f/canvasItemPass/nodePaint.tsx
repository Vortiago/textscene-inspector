/**
 * Where a drawn node's pixels and subtree sit in its canvas's draw sequence. A node of the shared
 * live tree reads the paint pass by live path (`canvasItemPaint.ts`). An extra of the sort, such
 * as a row of a y-sorted tile layer, reads the run the sort of the pass gave its id. A subtree with
 * no shared live tree, which only a component test mounts, reads the installed `DetachedPaint`.
 * The preview installs none, so a node the pass misses draws flat (`FLAT_PAINT`), with a warning.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import { useLiveScenePass } from '../liveScenePass';
import { useSharedLiveTree } from '../useLiveSceneTree';
import type { PaintRange } from '../canvasPaintOrder';
import { canvasPaintPass, type CanvasItemPaint } from './canvasItemPaint';
import { useSortedPaint } from '../contexts/YSortContext';
import { installedDetachedPaint, type DetachedPaint } from './detachedPaintSlot';
import { warnOnce } from '../../utils/warnOnce';

/**
 * How a subtree finds its paint. `tree`: each node reads the pass at its live path, moved by the
 * y-sort of its canvas (`YSortContext`). `extra`: a piece the sort places by id, such as a tile
 * row, which draws one value, the first of `range`. `detached`: the subtree has no shared live
 * tree, and its root owns `range`, where the roots of `canvasRoots` take theirs.
 */
export type PaintFrame =
  | { readonly kind: 'tree' }
  | { readonly kind: 'extra'; readonly range: PaintRange }
  | {
      readonly kind: 'detached';
      readonly range: PaintRange;
      readonly canvasRoots: ReadonlyMap<TscnNode, PaintRange>;
    };

/** The frame of a node that reads the pass at its live path, as the pass's tree order places it. */
export const IN_TREE_ORDER: PaintFrame = { kind: 'tree' };

const PaintFrameContext = createContext<PaintFrame>(IN_TREE_ORDER);
PaintFrameContext.displayName = 'PaintFrameContext';

/** Written where a piece draws at a run the sort gave it, such as a tile row. */
export function PaintFrameProvider({ value, children }: { value: PaintFrame; children: ReactNode }) {
  return <PaintFrameContext.Provider value={value}>{children}</PaintFrameContext.Provider>;
}

/** The frame of each child of a detached node, and of the pieces it draws after them. */
export interface ChildPaintFrames {
  readonly children: readonly PaintFrame[];
  readonly tail: PaintFrame;
}

/**
 * Where the node drawing `node` at live path `path` paints: the pass's paint after the sort of its
 * canvas, or the run an extra frame gives.
 */
export function useNodePaint(node: TscnNode, path: string | null): CanvasItemPaint {
  const frame = useContext(PaintFrameContext);
  const fromPass = useLiveScenePass(canvasPaintPass, frame.kind === 'tree' ? path : null);
  const paint = useMemo(() => {
    if (fromPass) return fromPass;
    if (frame.kind === 'extra') return extraPaint(frame.range);
    return detachedPaint().nodePaint(frame, node);
  }, [frame, fromPass, node]);
  return useSortedPaint(fromPass ? path : null, paint);
}

/**
 * The frame each child of the node drawing `node` at `path` takes, by index, and the one its
 * injected content takes, or null where they read the pass themselves. Only a detached node hands
 * down frames.
 */
export function useChildPaintFrames(
  node: TscnNode,
  path: string | null,
  paint: CanvasItemPaint
): ChildPaintFrames | null {
  const frame = useContext(PaintFrameContext);
  const isPassNode = useLiveScenePass(canvasPaintPass, frame.kind === 'tree' ? path : null) !== undefined;
  const isDetached = !isPassNode && frame.kind !== 'extra';
  return useMemo(
    () => (isDetached ? detachedPaint().childFrames(frame, node, paint) : null),
    [isDetached, frame, node, paint]
  );
}

/** The frame of each root of a dispatched scene, or null where the roots read the pass. */
export function useRootPaintFrames(roots: readonly TscnNode[]): readonly PaintFrame[] | null {
  const hasTree = useSharedLiveTree() !== null;
  return useMemo(() => (hasTree ? null : detachedPaint().rootFrames(roots)), [hasTree, roots]);
}

/** The frame of an extra of the sort, which draws at the first value of `range`. */
export function extraFrame(range: PaintRange): PaintFrame {
  return { kind: 'extra', range };
}

/**
 * An extra draws one value, so every other part is empty. A node is an extra only where the pass
 * holds no path for it, and so none for its subtree, which draws at the same value.
 */
function extraPaint(range: PaintRange): CanvasItemPaint {
  const empty = { base: range.base, size: 0 };
  return { range, own: range.base, front: empty, layer: range.base, back: empty, tail: empty, behind: [] };
}

const START_OF_CANVAS: PaintRange = { base: 0, size: 0 };

/**
 * The detached paint of the preview, which mounts the shared live tree and so reaches it only where
 * the pass misses a node. A missed node draws at its frame's first value, or at the start of the
 * canvas, and its children read the pass at their own paths: out of order, never a blank canvas.
 */
const FLAT_PAINT: DetachedPaint = {
  nodePaint(frame, node) {
    warnOnce(
      FLAT_PAINT,
      node.name,
      `expected the paint pass to hold ${node.name}, got no paint: it draws flat`
    );
    return extraPaint(frame.kind === 'tree' ? START_OF_CANVAS : frame.range);
  },
  childFrames: (_frame, node) => ({ children: node.children.map(() => IN_TREE_ORDER), tail: IN_TREE_ORDER }),
  rootFrames: (roots) => roots.map(() => IN_TREE_ORDER),
  sortFrames: (items) => new Map(items.map((item) => [item, IN_TREE_ORDER])),
};

/** The detached paint the test setup installed, or the flat paint of the preview. */
export function detachedPaint(): DetachedPaint {
  return installedDetachedPaint() ?? FLAT_PAINT;
}
