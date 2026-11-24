import type { Rect2 } from '../../godot/math/rect2.js';
import type { Vector2 } from '../../godot/math/vector.js';
import { boolOr, packedOr, parseOptionalRect2 } from '../../parser/valueParsers.js';
import { NO_FLOATS, parsePackedVector2Array } from '../../resources/shapes/packedArray.js';
import type { Aabb } from '../../godot/math/aabb.js';
import type { Curve2DControlPoint } from '../../resources/curves/curve2d/types.js';
import type { SpriteFrameProps } from '../spriteFrame.js';

interface Size {
  width: number;
  height: number;
}

/** A zero size draws as 1x1 (sprite_2d.cpp:456-458, animated_sprite_2d.cpp:108-110). */
const atLeastOnePixel = (w: number, h: number) => (w === 0 && h === 0 ? { w: 1, h: 1 } : { w, h });

/** `Sprite2D::get_rect` (sprite_2d.cpp:439-461). Null is no texture, so `_edit_use_rect` is false. */
export function sprite2DEditRect(
  textureSize: Size | undefined,
  props: SpriteFrameProps & { centered: boolean; offset: Vector2 }
): Rect2 | null {
  if (!textureSize) return null;
  const base = props.region_enabled && props.region_rect ? props.region_rect : textureSize;
  // A `Size2i` both sides of the frame division.
  const w = Math.trunc(Math.trunc(base.width) / Math.max(1, props.hframes));
  const h = Math.trunc(Math.trunc(base.height) / Math.max(1, props.vframes));
  const x = props.offset.x - (props.centered ? w / 2 : 0);
  const y = props.offset.y - (props.centered ? h / 2 : 0);
  return { x, y, ...atLeastOnePixel(w, h) };
}

/** `AnimatedSprite2D::_get_rect` (animated_sprite_2d.cpp:86-113). Null is no frame texture. */
export function animatedSprite2DEditRect(
  frameSize: Size | undefined,
  centered: boolean,
  offset: Vector2
): Rect2 | null {
  if (!frameSize) return null;
  const { width, height } = frameSize;
  const x = offset.x - (centered ? width / 2 : 0);
  const y = offset.y - (centered ? height / 2 : 0);
  return { x, y, ...atLeastOnePixel(width, height) };
}

/** light_2d.cpp:370-381. Null is no texture. */
export function pointLight2DEditRect(
  textureSize: Size | undefined,
  scale: number,
  offset: Vector2
): Rect2 | null {
  if (!textureSize) return null;
  const w = textureSize.width * scale;
  const h = textureSize.height * scale;
  return { x: offset.x - w / 2, y: offset.y - h / 2, w, h };
}

/** The bounds of packed x, y pairs moved by `offset`, or null for none. */
function boundsOf(points: Float32Array | readonly number[], offset: Vector2 = { x: 0, y: 0 }): Rect2 | null {
  if (points.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i]! + offset.x;
    const y = points[i + 1]! + offset.y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** line_2d.cpp:40-55. */
export function line2DEditRect(points: Float32Array, width: number): Rect2 {
  const bounds = boundsOf(points);
  if (!bounds) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: bounds.x - width, y: bounds.y - width, w: bounds.w + width * 2, h: bounds.h + width * 2 };
}

/** polygon_2d.cpp:72-93. Null is no points. */
export function polygon2DEditRect(polygon: Float32Array, offset: Vector2): Rect2 | null {
  return boundsOf(polygon, offset);
}

/** mesh_instance_2d.cpp:107-118: the mesh box seen down its z axis. Null is no mesh. */
export function meshInstance2DEditRect(aabb: Aabb | null): Rect2 | null {
  return aabb && { x: aabb.position.x, y: aabb.position.y, w: aabb.size.x, h: aabb.size.y };
}

/** `Vector2::bezier_interpolate` (vector2.h:307). */
function bezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return p0 * u * u * u + p1 * 3 * u * u * t + p2 * 3 * u * t * t + p3 * t * t * t;
}

/** path_2d.cpp:42-62: nine samples per point, the last point's all at its own position. Null is no point. */
export function path2DEditRect(points: readonly Curve2DControlPoint[]): Rect2 | null {
  if (points.length === 0) return null;
  const samples: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const from = points[i]!;
    const to = points[i + 1];
    for (let j = 0; j <= 8; j++) {
      if (!to) {
        samples.push(from.position.x, from.position.y);
        continue;
      }
      const t = j / 8;
      const p1 = { x: from.position.x + from.out.x, y: from.position.y + from.out.y };
      const p2 = { x: to.position.x + to.in.x, y: to.position.y + to.in.y };
      samples.push(
        bezier(from.position.x, p1.x, p2.x, to.position.x, t),
        bezier(from.position.y, p1.y, p2.y, to.position.y, t)
      );
    }
  }
  return boundsOf(samples);
}

/** `CollisionPolygon2D::set_polygon`'s `aabb` (collision_polygon_2d.cpp:172-189, .h:47). */
function collisionPolygon2DEditRect(raw: Record<string, string>): Rect2 {
  const polygon = packedOr(raw.polygon, parsePackedVector2Array, NO_FLOATS, 'CollisionPolygon2D polygon');
  const bounds = boundsOf(polygon);
  if (!bounds || (bounds.x === 0 && bounds.y === 0 && bounds.w === 0 && bounds.h === 0)) {
    return { x: -10, y: -10, w: 20, h: 20 };
  }
  return {
    x: bounds.x - bounds.w * 0.3,
    y: bounds.y - bounds.h * 0.3,
    w: bounds.w * 1.6,
    h: bounds.h * 1.6,
  };
}

function rectOr(value: string | undefined, fallback: Rect2): Rect2 {
  const rect = parseOptionalRect2(value);
  return rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : fallback;
}

/** The edit rect of a class that draws nothing of its own. Null is `_edit_use_rect` false. */
export function rawPropertyEditRect(type: string, raw: Record<string, string>): Rect2 | null {
  switch (type) {
    case 'BackBufferCopy':
      return rectOr(raw.rect, { x: -100, y: -100, w: 200, h: 200 });
    case 'VisibleOnScreenNotifier2D':
      return boolOr(raw.show_rect, true) ? rectOr(raw.rect, { x: -10, y: -10, w: 20, h: 20 }) : null;
    case 'CollisionPolygon2D':
      return collisionPolygon2DEditRect(raw);
    default:
      return null;
  }
}
