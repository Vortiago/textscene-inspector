/** The draw-order keys of a canvas group: which a window collects and which are its owner's own. */

import type { CanvasRunKeys } from '../canvasItemState';

/**
 * The draw-order keys a group collects: its run's `[from, to)` without its own slot, which starts at
 * `own`, the key its rect draws at. A group culls every child before itself
 * (`renderer_canvas_cull.cpp:471-484`).
 */
export type CanvasGroupWindow = CanvasRunKeys;

/**
 * Whether `key` is in the slot of the group's own pixels: its key, and the pieces the item draws
 * after it before the next whole key (`canvasSubOrders`).
 */
export function isOwnKey({ own }: CanvasGroupWindow, key: number): boolean {
  return key >= own && key < own + 1;
}

/** Whether `key` is one of the keys the window collects. */
export function collects(window: CanvasGroupWindow, key: number): boolean {
  return key >= window.from && key < window.to && !isOwnKey(window, key);
}

/** A run of keys `[from, to)`. */
export interface KeySpan {
  readonly from: number;
  readonly to: number;
}

/** Whether `key` lies in `span`. */
const isIn = (span: KeySpan, key: number) => key >= span.from && key < span.to;

/** One draw of the keys `[from, to)` that `admits` lets through. */
export interface DrawStep extends KeySpan {
  admits(key: number): boolean;
}

/**
 * The draws, in turn, of the keys of `[from, to)` that `accept` admits. A clipping owner that draws
 * nothing has no group, so Godot draws its `show_behind_parent` children before the others
 * (`renderer_canvas_cull.cpp:477-490`), which the keys, in child order, do not give. Each such owner
 * in `inert` draws its behind spans first, where its window starts.
 */
export function drawOrderOf(
  accept: (key: number) => boolean,
  from: number,
  to: number,
  inert: readonly { window: CanvasGroupWindow; behind: readonly KeySpan[] }[]
): DrawStep[] {
  const owners = inert
    .filter((owner) => owner.behind.length > 0 && owner.window.from >= from && owner.window.from < to)
    .sort((a, b) => a.window.from - b.window.from || b.window.to - a.window.to);
  if (owners.length === 0) return [{ from, to, admits: accept }];
  const isBehind = (key: number) => owners.some((owner) => owner.behind.some((span) => isIn(span, key)));
  const steps: DrawStep[] = [];
  const drawnBehind: KeySpan[] = [];
  let cursor = from;
  const addRest = (start: number, end: number) => {
    if (start < end) steps.push({ from: start, to: end, admits: (key) => accept(key) && !isBehind(key) });
  };
  for (const owner of owners) {
    addRest(cursor, owner.window.from);
    for (const span of owner.behind) {
      // A behind span inside an earlier one has drawn there, in key order.
      if (drawnBehind.some((done) => span.from >= done.from && span.to <= done.to)) continue;
      const drawnBefore = [...drawnBehind];
      steps.push({ ...span, admits: (key) => accept(key) && !drawnBefore.some((done) => isIn(done, key)) });
      drawnBehind.push(span);
    }
    cursor = owner.window.from;
  }
  addRest(cursor, to);
  return steps;
}

/**
 * The index of the window that holds `key`, its owner's slot included, or -1. `windows` do not
 * overlap and are sorted by `from`, so the search takes a few steps for any number of groups.
 */
export function windowIndexAt(windows: readonly { window: CanvasGroupWindow }[], key: number): number {
  let low = 0;
  let high = windows.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const { window } = windows[mid]!;
    if (key < window.from) high = mid - 1;
    else if (key >= window.to) low = mid + 1;
    else return mid;
  }
  return -1;
}

/** Orders groups by the start of their window, as `windowIndexAt` needs. */
export function sortedByWindow<T extends { window: CanvasGroupWindow }>(groups: readonly T[]): T[] {
  return [...groups].sort((a, b) => a.window.from - b.window.from);
}
