/**
 * The slot that holds the paint of a subtree with no shared live tree. It imports no module at run
 * time, so the test setup installs into it without loading a module a test file mocks.
 */

import type { TscnNode } from '../../parser/types';
import type { YSortItem } from '../ySortItems';
import type { CanvasItemPaint } from './canvasItemPaint';
import type { ChildPaintFrames, PaintFrame } from './nodePaint';

/**
 * The paint of a subtree with no shared live tree. The preview always mounts the tree, so only a
 * component test that mounts a node bare installs one (`testing/detachedPaint.ts`).
 */
export interface DetachedPaint {
  /** The paint of `node` drawing in `frame`, a detached frame, or the whole canvas for a tree frame. */
  nodePaint(frame: PaintFrame, node: TscnNode): CanvasItemPaint;
  /** The frame of each child of `node`, which draws `paint` in `frame`. */
  childFrames(frame: PaintFrame, node: TscnNode, paint: CanvasItemPaint): ChildPaintFrames;
  /** The frame of each root of a scene. */
  rootFrames(roots: readonly TscnNode[]): readonly PaintFrame[];
  /** The frame of each sorted item of a node that draws `paint`, its injected pieces in `tail`. */
  sortFrames(
    items: readonly YSortItem[],
    paint: CanvasItemPaint,
    tail: PaintFrame
  ): Map<YSortItem, PaintFrame>;
}

/** Written only by `installDetachedPaint`, from the test setup. Null in the preview. */
let installed: DetachedPaint | null = null;

/**
 * Installs the paint of a subtree with no shared live tree, for a test that mounts a node bare.
 * Null restores the preview, which installs none.
 */
export function installDetachedPaint(paint: DetachedPaint | null): void {
  installed = paint;
}

/** The installed detached paint, or null in the preview. */
export function installedDetachedPaint(): DetachedPaint | null {
  return installed;
}
