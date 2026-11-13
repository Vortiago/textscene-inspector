/**
 * Where a drawn node's pixels and subtree sit in its canvas's draw sequence. A node of the shared
 * live tree reads the paint pass by live path (`canvasItemPaint.ts`). A node drawn outside that
 * tree, such as a scene tile's instance, takes its run from the node that draws it.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import { useLiveScenePass } from '../liveScenePass';
import { useSharedLiveTree } from '../useLiveSceneTree';
import {
  allocateNodePaintRange,
  allocatePaintRange,
  behindRangesOf,
  canvasRootRanges,
  hostsOwnCanvas,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../canvasPaintOrder';
import { isViewportBoundary } from '../../nodes/viewport/subviewport/viewportBoundary';
import { canvasPaintPass, type CanvasItemPaint } from './canvasItemPaint';

/**
 * How a subtree finds its paint. `tree`: each node reads the pass at its live path, moved by
 * `shift`, the distance a y-sort moved the pass's run `moved`. A canvas root below keeps its run
 * outside `moved`, so no sort moves it. `run`: the subtree is outside the shared live tree, and its
 * root owns `range`, where the roots of `canvasRoots` take theirs.
 */
export type PaintFrame =
  | { readonly kind: 'tree'; readonly shift: number; readonly moved: PaintRange }
  | {
      readonly kind: 'run';
      readonly range: PaintRange;
      readonly canvasRoots: ReadonlyMap<TscnNode, PaintRange>;
    };

/** The frame of a node that reads the pass at its live path, as the pass's tree order places it. */
export const IN_TREE_ORDER: PaintFrame = { kind: 'tree', shift: 0, moved: WHOLE_CANVAS_RANGE };
const NO_CANVAS_ROOTS: ReadonlyMap<TscnNode, PaintRange> = new Map();

const PaintFrameContext = createContext<PaintFrame>(IN_TREE_ORDER);
PaintFrameContext.displayName = 'PaintFrameContext';

/** Written where a subtree leaves the pass's tree order: a y-sort, a scene tile, a tile row. */
export function PaintFrameProvider({ value, children }: { value: PaintFrame; children: ReactNode }) {
  return <PaintFrameContext.Provider value={value}>{children}</PaintFrameContext.Provider>;
}

/**
 * Where the node drawing `node` at live path `path` paints. A `run` frame, or a path the pass does
 * not hold, allocates from the frame's run, which is the whole canvas with no stage above.
 */
export function useNodePaint(node: TscnNode, path: string | null): CanvasItemPaint {
  const frame = useContext(PaintFrameContext);
  const fromPass = useLiveScenePass(canvasPaintPass, frame.kind === 'tree' ? path : null);
  return useMemo(() => {
    if (frame.kind === 'tree' && fromPass) return shifted(fromPass, shiftOf(frame, fromPass.range));
    return localPaint(frame.kind === 'run' ? frame.range : WHOLE_CANVAS_RANGE, node).paint;
  }, [frame, fromPass, node]);
}

/**
 * The frame each child of the node drawing `node` at `path` takes, by index, and the one its
 * injected content takes, or null where they read the pass themselves. A node the pass does not
 * hold hands each child the run it allocates from its own.
 */
export function useChildPaintFrames(
  node: TscnNode,
  path: string | null,
  paint: CanvasItemPaint
): { children: readonly PaintFrame[]; tail: PaintFrame } | null {
  const frame = useContext(PaintFrameContext);
  const isPassNode = useLiveScenePass(canvasPaintPass, frame.kind === 'tree' ? path : null) !== undefined;
  return useMemo(() => {
    if (isPassNode) return null;
    const inherited = frame.kind === 'run' ? frame.canvasRoots : NO_CANVAS_ROOTS;
    const { children } = localPaint(paint.range, node);
    const canvasRoots = hostsOwnCanvas(node) ? canvasRootRanges(node.children, children) : inherited;
    return {
      children: node.children.map((child, index) => ({
        kind: 'run',
        range: canvasRoots.get(child) ?? children[index]!,
        canvasRoots,
      })),
      tail: { kind: 'run', range: paint.tail, canvasRoots },
    };
  }, [isPassNode, frame, node, paint]);
}

/**
 * The frame of each root of a dispatched scene, or null where the roots read the pass. With no
 * scene graph in context, as a component test mounts one, no pass runs, so the roots take runs.
 */
export function useRootPaintFrames(roots: readonly TscnNode[]): readonly PaintFrame[] | null {
  const hasTree = useSharedLiveTree() !== null;
  return useMemo(() => {
    if (hasTree) return null;
    const ranges = allocatePaintRange(WHOLE_CANVAS_RANGE, roots).children;
    const canvasRoots = canvasRootRanges(roots, ranges);
    return roots.map((root, index) => ({
      kind: 'run',
      range: canvasRoots.get(root) ?? ranges[index]!,
      canvasRoots,
    }));
  }, [hasTree, roots]);
}

/** The frames of `content`, drawn one after another from `run`, as scene tiles draw after the layer's children. */
export function contentFrames(run: PaintRange, content: readonly TscnNode[]): PaintFrame[] {
  return allocatePaintRange(run, content).children.map(runFrameAt);
}

/** The frame of a subtree outside the shared live tree whose root owns `range`, with no canvas roots above. */
export function runFrameAt(range: PaintRange): PaintFrame {
  return { kind: 'run', range, canvasRoots: NO_CANVAS_ROOTS };
}

/**
 * The frame of the item at `path` that a y-sort re-packed into `range`: the pass's own paint moved
 * to `range` when the sort packed its whole subtree. A y-sorted item's body, whose children sort as
 * items of their own, and a row take `range` itself, as does an item outside the shared tree.
 */
export function useRepackedFrame(path: string, range: PaintRange): PaintFrame {
  const frame = useContext(PaintFrameContext);
  const fromPass = useLiveScenePass(canvasPaintPass, frame.kind === 'tree' ? path : null);
  return useMemo(() => {
    if (frame.kind === 'tree' && fromPass?.range.size === range.size) {
      return { kind: 'tree', shift: range.base - fromPass.range.base, moved: fromPass.range };
    }
    return { kind: 'run', range, canvasRoots: frame.kind === 'run' ? frame.canvasRoots : NO_CANVAS_ROOTS };
  }, [frame, fromPass, range]);
}

/** The shift of a `tree` frame for a node owning `range`: none for a run outside the moved one. */
function shiftOf(frame: { shift: number; moved: PaintRange }, range: PaintRange): number {
  const { moved } = frame;
  const isInside = range.base >= moved.base && range.base + range.size <= moved.base + moved.size;
  return isInside ? frame.shift : 0;
}

function shifted(paint: CanvasItemPaint, shift: number): CanvasItemPaint {
  if (shift === 0) return paint;
  const move = (range: PaintRange): PaintRange => ({ base: range.base + shift, size: range.size });
  return {
    range: move(paint.range),
    own: paint.own + shift,
    front: move(paint.front),
    layer: paint.layer + shift,
    back: move(paint.back),
    tail: move(paint.tail),
    behind: paint.behind.map(move),
  };
}

/** The paint of `node` owning `range` outside the shared tree, and the run each child owns. */
function localPaint(range: PaintRange, node: TscnNode): { paint: CanvasItemPaint; children: PaintRange[] } {
  // A sub-viewport is a canvas of its own, whose runs start at the beginning.
  const allocated = allocateNodePaintRange(isViewportBoundary(node.type) ? WHOLE_CANVAS_RANGE : range, node);
  return {
    paint: {
      range,
      own: allocated.self,
      front: allocated.front,
      layer: allocated.layer,
      back: allocated.back,
      tail: allocated.tail,
      behind: behindRangesOf(node.children, allocated.children),
    },
    children: allocated.children,
  };
}
