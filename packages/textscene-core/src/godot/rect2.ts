/**
 * `Rect2` (`core/math/rect2.h`) as position and size. A rect from an empty bounding box is
 * inverted, with an infinite position and a negative infinite size, and meets nothing.
 */

export interface Rect2 {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** `Rect2::intersects` without borders (`rect2.h:54-89`): rects that only touch miss. */
export function rect2Intersects(a: Rect2, b: Rect2): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** `Rect2::intersection` (`rect2.h:148-163`): the overlap, or the all-zero `Rect2()` for none. */
export function rect2Intersection(a: Rect2, b: Rect2): Rect2 {
  if (!rect2Intersects(a, b)) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y };
}

/** `Rect2::merge` (`rect2.h:165-180`): the smallest rect that holds both. */
export function rect2Merge(a: Rect2, b: Rect2): Rect2 {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
