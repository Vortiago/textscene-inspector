/**
 * The paint of a subtree mounted with no shared live tree, as a component test mounts one drawn
 * node: each node allocates its children's runs from its own, in the order the paint pass would.
 * Test-only, like the rest of `testing/`. The test setup installs it before each file's tests.
 */

import type { TscnNode } from '../../parser/types';
import {
  allocatePaintRange,
  behindRangesOf,
  canvasRootRanges,
  hostsOwnCanvas,
  packPaintRanges,
  pieceSize,
  paintLayoutOf,
  WHOLE_CANVAS_RANGE,
  type AllocatedPaintRange,
  type PaintRange,
} from '../canvasPaintOrder';
import { isViewportBoundary } from '../../nodes/viewport/subviewport/viewportBoundary';
import type { CanvasItemPaint } from '../canvasItemPass/canvasItemPaint';
import type { PaintFrame } from '../canvasItemPass/nodePaint';
import type { DetachedPaint } from '../canvasItemPass/detachedPaintSlot';
import { inSortOrder } from '../ySortOrder';

/** `allocatePaintRange` for `node`'s own children, with the layout the node declares. */
export function allocateNodePaintRange(range: PaintRange, node: TscnNode): AllocatedPaintRange {
  return allocatePaintRange(range, node.children, paintLayoutOf(node, node.children));
}

const NO_CANVAS_ROOTS: ReadonlyMap<TscnNode, PaintRange> = new Map();

/** The frame of a detached subtree whose root owns `range`, where `canvasRoots` take theirs. */
export function detachedFrame(
  range: PaintRange,
  canvasRoots: ReadonlyMap<TscnNode, PaintRange> = NO_CANVAS_ROOTS
): PaintFrame {
  return { kind: 'detached', range, canvasRoots };
}

/** The run a frame gives its root: a detached frame's own, or the whole canvas. */
function rangeOf(frame: PaintFrame): PaintRange {
  return frame.kind === 'tree' ? WHOLE_CANVAS_RANGE : frame.range;
}

function canvasRootsOf(frame: PaintFrame): ReadonlyMap<TscnNode, PaintRange> {
  return frame.kind === 'detached' ? frame.canvasRoots : NO_CANVAS_ROOTS;
}

/** The paint of `node` owning `range`, and the run each child owns. */
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

export const DETACHED_PAINT: DetachedPaint = {
  nodePaint: (frame, node) => localPaint(rangeOf(frame), node).paint,

  childFrames(frame, node, paint) {
    const { children } = localPaint(paint.range, node);
    const canvasRoots = hostsOwnCanvas(node)
      ? canvasRootRanges(node.children, children)
      : canvasRootsOf(frame);
    return {
      children: node.children.map((child, index) =>
        detachedFrame(canvasRoots.get(child) ?? children[index]!, canvasRoots)
      ),
      tail: detachedFrame(paint.tail, canvasRoots),
    };
  },

  rootFrames(roots) {
    const ranges = allocatePaintRange(WHOLE_CANVAS_RANGE, roots).children;
    const canvasRoots = canvasRootRanges(roots, ranges);
    return roots.map((root, index) => detachedFrame(canvasRoots.get(root) ?? ranges[index]!, canvasRoots));
  },

  // The runs packed in sort order after the node's own sequence, as one flat sort orders them.
  sortFrames(items, paint, tail) {
    const sorted = inSortOrder(items, (item) => item.sortY);
    const ranges = packPaintRanges(paint.range, sorted.map(pieceSize), paint.own + 1);
    return new Map(sorted.map((item, i) => [item, detachedFrame(ranges[i]!, canvasRootsOf(tail))]));
  },
};
