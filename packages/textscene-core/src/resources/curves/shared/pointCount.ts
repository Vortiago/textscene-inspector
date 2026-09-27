/**
 * `point_count` for the three curve resources: the padding cap they share, and the
 * resize the two Bézier curves share. No THREE.
 */

/**
 * A previewer must not hang a tab. Godot has no such cap (`point_count` is an
 * unbounded int), but a count in the millions allocates that many points, and
 * `Curve` seats each one in order, before the first paint.
 */
export const MAX_PADDED_POINTS = 4096;

/**
 * The point list at the declared count, as `Curve2D::set_point_count` and
 * `Curve3D::set_point_count` apply it (curve.cpp:721-737, 1448-1464): a smaller count
 * drops the tail, and a larger one appends `newPoint()` through `_add_point` with no
 * index, which pushes to the back (curve.cpp:744-747, 1471-1474). A negative count is
 * refused (curve.cpp:722, 1449) and leaves the list as it was.
 */
export function resizeBezierPoints<P>(points: P[], count: number, newPoint: () => P): P[] {
  if (count < 0 || count === points.length) return points;
  const resized = points.slice(0, count);
  const target = Math.min(count, MAX_PADDED_POINTS);
  while (resized.length < target) resized.push(newPoint());
  return resized;
}
