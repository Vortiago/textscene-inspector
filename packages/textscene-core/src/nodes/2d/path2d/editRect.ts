import type { Rect2 } from '../../../godot/math/rect2.js';
import { bezierInterpolatef } from '../../../godot/math/math.js';
import type { Curve2DControlPoint } from '../../../resources/curves/curve2d/types.js';

/** path_2d.cpp:42-62: nine samples per point, the last point's all at its own position. Null is no point. */
export function path2DEditRect(points: readonly Curve2DControlPoint[]): Rect2 | null {
  if (points.length === 0) return null;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const include = (x: number, y: number) => {
    [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
  };
  for (let i = 0; i < points.length; i++) {
    const { position: from, out } = points[i]!;
    const to = points[i + 1];
    if (!to) {
      include(from.x, from.y);
      continue;
    }
    const [c1x, c1y] = [from.x + out.x, from.y + out.y];
    const [c2x, c2y] = [to.position.x + to.in.x, to.position.y + to.in.y];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      include(
        bezierInterpolatef(from.x, c1x, c2x, to.position.x, t),
        bezierInterpolatef(from.y, c1y, c2y, to.position.y, t)
      );
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
