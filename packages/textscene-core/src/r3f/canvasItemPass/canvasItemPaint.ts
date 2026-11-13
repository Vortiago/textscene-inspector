/**
 * The paint pass (ADR-0060): one walk of the Live scene tree that gives each node its run of draw
 * sequence values, as `RendererCanvasCull::_cull_canvas_item` orders each item in the walk that
 * gives its state (`renderer_canvas_cull.cpp:477-490`). Tree order only: a y-sorted parent re-packs
 * its children's runs where it draws them.
 */

import type { TscnNode } from '../../parser/types';
import { isInjected, type LiveTree } from '../liveSceneTree';
import { liveScenePassResults, type LiveScenePass } from '../liveScenePass';
import { liveNodePatches } from '../liveNodePatches';
import { patchedNode } from '../nodePatch';
import {
  allocatePaintRange,
  behindRangesOf,
  canvasRootRanges,
  hostsOwnCanvas,
  lastPaintSequence,
  paintLayoutOf,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../canvasPaintOrder';
import { isViewportBoundary } from '../../nodes/viewport/subviewport/viewportBoundary';

/** Where a node and its subtree draw in its canvas's sequence. */
export interface CanvasItemPaint {
  /** The run of sequence values the node's subtree owns. */
  readonly range: PaintRange;
  /** The sequence of the node's own pixels. */
  readonly own: number;
  /** The run of its internal front children (`internalFrontRoom`). */
  readonly front: PaintRange;
  /** The sequence of its listed layer (`listedChildOrder`), or `own` with none. */
  readonly layer: number;
  /** The run of its internal back children (`internalBackRoom`). */
  readonly back: PaintRange;
  /** The room after its children, for content that arrives later (`reservesRoom`). */
  readonly tail: PaintRange;
  /** The ranges of the children that draw behind it, in child order. */
  readonly behind: readonly PaintRange[];
}

/**
 * The paint of a node that starts a canvas of its own and owns all of it: its pixels first, its
 * back pieces last, and no room for anything else.
 */
export const WHOLE_CANVAS_PAINT: CanvasItemPaint = {
  range: WHOLE_CANVAS_RANGE,
  own: WHOLE_CANVAS_RANGE.base,
  front: { base: WHOLE_CANVAS_RANGE.base, size: 0 },
  layer: WHOLE_CANVAS_RANGE.base,
  back: { base: lastPaintSequence(WHOLE_CANVAS_RANGE), size: 0 },
  tail: { base: lastPaintSequence(WHOLE_CANVAS_RANGE), size: 0 },
  behind: [],
};

/** The paint of a Window, which draws its chrome on its own canvas under its content. */
export const WINDOW_CANVAS_PAINT: CanvasItemPaint = {
  ...WHOLE_CANVAS_PAINT,
  back: { base: WHOLE_CANVAS_RANGE.base, size: 0 },
};

/** What a visited node hands the nodes below it. */
interface Above {
  /** The run each child owns, by the child as its group holds it. */
  readonly ranges: ReadonlyMap<TscnNode, PaintRange>;
  /** Where each canvas root of the enclosing canvas draws (`canvasRootRanges`). */
  readonly canvasRoots: ReadonlyMap<TscnNode, PaintRange>;
}

/**
 * Written only by {@link canvasPaintPassFrom}: one pass for each start, so a tree's results stay
 * cached for each run a caller starts from. The starts are the runs scene tiles and viewports take.
 */
const passesByStart = new Map<string, LiveScenePass<CanvasItemPaint>>();

/** The paint pass whose roots share `start`, as a tile layer's scene tiles share its tail. */
export function canvasPaintPassFrom(start: PaintRange): LiveScenePass<CanvasItemPaint> {
  const key = `${start.base}:${start.size}`;
  let pass = passesByStart.get(key);
  if (!pass) {
    pass = (tree) => paintOf(tree, start);
    passesByStart.set(key, pass);
  }
  return pass;
}

/** The paint pass of a canvas whose roots start at the beginning of the sequence. */
export const canvasPaintPass: LiveScenePass<CanvasItemPaint> = canvasPaintPassFrom(WHOLE_CANVAS_RANGE);

function paintOf(tree: LiveTree, start: PaintRange): ReadonlyMap<string, CanvasItemPaint> {
  const results = new Map<string, CanvasItemPaint>();
  const patches = liveScenePassResults(liveNodePatches, tree);
  const roots = tree.rootGroups.flatMap((group) => group.children);
  const rootRanges = allocatePaintRange(start, roots).children;
  const top: Above = {
    ranges: rangesOf(roots, rootRanges),
    canvasRoots: canvasRootRanges(roots, rootRanges),
  };
  tree.fold<Above, void>(top, ({ raw, step, path }, above, descend) => {
    const node = patchedNode(step.node, patches.get(path));
    const range = above.canvasRoots.get(raw) ?? above.ranges.get(raw) ?? WHOLE_CANVAS_RANGE;
    // A sub-viewport is a canvas of its own, whose runs start at the beginning.
    const basis = isViewportBoundary(node.type) ? WHOLE_CANVAS_RANGE : range;
    const inline = step.groups.filter((group) => !isInjected(group)).flatMap((group) => group.children);
    const allocated = allocatePaintRange(basis, inline, paintLayoutOf(node, inline));
    // Injected content draws after the authored children, in the room `reservesRoom` holds back.
    const injected = step.groups.filter(isInjected).flatMap((group) => group.children);
    const injectedRanges = allocatePaintRange(allocated.tail, injected).children;
    results.set(path, {
      range,
      own: allocated.self,
      front: allocated.front,
      layer: allocated.layer,
      back: allocated.back,
      tail: allocated.tail,
      behind: behindRangesOf(inline, allocated.children),
    });
    descend({
      ranges: new Map([...rangesOf(inline, allocated.children), ...rangesOf(injected, injectedRanges)]),
      // A CanvasLayer or a sub-viewport indexes the roots below it by its own counter (`canvas_layer.cpp:261-267`).
      canvasRoots: hostsOwnCanvas(node) ? canvasRootRanges(inline, allocated.children) : above.canvasRoots,
    });
  });
  return results;
}

function rangesOf(children: readonly TscnNode[], ranges: readonly PaintRange[]): Map<TscnNode, PaintRange> {
  return new Map(children.map((child, index) => [child, ranges[index] ?? WHOLE_CANVAS_RANGE]));
}
