/**
 * `RendererCanvasCull::canvas_item_add_polyline`
 * (`servers/rendering/renderer_canvas_cull.cpp:955-1216`) — what
 * `CanvasItem::draw_polyline_colors` actually builds, as vertex-coloured
 * triangles.
 *
 * Godot emits up to THREE `PRIMITIVE_TRIANGLE_STRIP` polygons: the core strip,
 * plus a left and a right feather strip when antialiasing is on. Each vertex
 * pair straddles its point along `base_edge_offset`, the miter bisector
 * `compute_polyline_edge_offset_clamped` (`:932-953`) clamps to ±3 half-widths;
 * the two end points use the plain orthogonal of their own segment instead
 * (`:1076-1082`). The feather runs one `FEATHER_SIZE` further out, fading the
 * colour's alpha to zero, and both open ends get a cap one feather beyond the
 * line (`:1113-1163`).
 *
 * The three strips are merged into one indexed triangle array here — they are
 * coplanar, drawn in one pass, and never share a vertex — with the Y flip into
 * three-space baked in, matching `connectionStroke.ts`.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { isEqualApprox, isZeroApprox } from '../../../../godot/index.js';
import { clamp } from '../../../../godot/math';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { GeometryBuffers, StrokeRGBA } from './connectionStroke';

/** `FEATHER_SIZE` (`renderer_canvas_cull.cpp:45`). */
export const POLYLINE_FEATHER_SIZE = 1.25;

/** How far `compute_polyline_edge_offset_clamped` lets a miter run, in half-widths (`:943`). */
const MITER_LIMIT = 3;

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(v: Vec2, by: number): Vec2 {
  return { x: v.x * by, y: v.y * by };
}

/** `Vector2::normalized()` — a zero-length vector stays `(0, 0)`. */
function normalized(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y);
  return length === 0 ? { x: 0, y: 0 } : { x: v.x / length, y: v.y / length };
}

/** `Vector2::orthogonal()` — `Vector2(y, -x)`. */
function orthogonal(v: Vec2): Vec2 {
  return { x: v.y, y: -v.x };
}

function isZeroApproxVec(v: Vec2): boolean {
  return isZeroApprox(v.x) && isZeroApprox(v.y);
}

/** `compute_polyline_segment_dir` (`:912-930`). */
function segmentDir(points: readonly Vec2[], index: number, previous: Vec2): Vec2 {
  if (index === points.length - 1) return previous;
  const dir = normalized({ x: points[index + 1]!.x - points[index]!.x, y: points[index + 1]!.y - points[index]!.y });
  return isZeroApproxVec(dir) ? previous : dir;
}

/** `compute_polyline_edge_offset_clamped` (`:932-953`) — the miter bisector, clamped. */
function edgeOffsetClamped(dir: Vec2, previous: Vec2): Vec2 {
  const dirLength = Math.hypot(dir.x, dir.y);
  const previousLength = Math.hypot(previous.x, previous.y);
  let bisector = normalized({
    x: previous.x * dirLength - dir.x * previousLength,
    y: previous.y * dirLength - dir.y * previousLength,
  });
  let length = 1;

  const cross = bisector.x * previous.y - bisector.y * previous.x;
  const dot = bisector.x * previous.x + bisector.y * previous.y;
  const sinAngle = Math.sin(Math.atan2(cross, dot));
  if (!isZeroApprox(sinAngle) && !(isEqualApprox(dir.x, previous.x) && isEqualApprox(dir.y, previous.y))) {
    length = clamp(1 / sinAngle, -MITER_LIMIT, MITER_LIMIT);
  } else {
    bisector = orthogonal(dir);
  }
  if (isZeroApproxVec(bisector)) bisector = orthogonal(dir);
  return scale(bisector, length);
}

/** One `PRIMITIVE_TRIANGLE_STRIP` polygon, as Godot fills its two parallel arrays. */
interface Strip {
  points: Vec2[];
  colors: StrokeRGBA[];
}

function emptyStrip(size: number): Strip {
  return {
    points: Array.from({ length: size }, () => ({ x: 0, y: 0 })),
    colors: Array.from({ length: size }, () => ({ r: 1, g: 1, b: 1, a: 1 })),
  };
}

function transparent(color: StrokeRGBA): StrokeRGBA {
  return { r: color.r, g: color.g, b: color.b, a: 0 };
}

/**
 * `p_points`/`p_colors` in Godot px (+Y down), `p_width` the polyline's own
 * width and `p_antialiased` its AA flag — `draw_polyline_colors`' four
 * arguments. `p_colors` is expected to carry one entry per point, the only
 * shape `GraphEdit::_draw_minimap_connection_line` (`:1601-1611`) produces.
 */
export function polylineStrokeGeometry(
  points: readonly Vec2[],
  colors: readonly StrokeRGBA[],
  width: number,
  antialiased: boolean
): GeometryBuffers {
  const pointCount = points.length;
  if (pointCount < 2) return { positions: [], indices: [], colors: [] };

  const loop = isEqualApprox(points[0]!.x, points[pointCount - 1]!.x) && isEqualApprox(points[0]!.y, points[pointCount - 1]!.y);
  const stripSize = pointCount * 2;
  const capped = antialiased && !loop;
  const borderSize = width < 1 ? POLYLINE_FEATHER_SIZE * width : POLYLINE_FEATHER_SIZE;

  let firstSegmentDir: Vec2 = { x: 0, y: 0 };
  for (let i = 1; i < pointCount; i++) {
    firstSegmentDir = normalized({ x: points[i]!.x - points[i - 1]!.x, y: points[i]!.y - points[i - 1]!.y });
    if (!isZeroApproxVec(firstSegmentDir)) break;
  }
  let lastSegmentDir: Vec2 = { x: 0, y: 0 };
  for (let i = pointCount - 1; i >= 1; i--) {
    lastSegmentDir = normalized({ x: points[i]!.x - points[i - 1]!.x, y: points[i]!.y - points[i - 1]!.y });
    if (!isZeroApproxVec(lastSegmentDir)) break;
  }

  const core = emptyStrip(stripSize + (capped ? 4 : 0));
  const left = antialiased ? emptyStrip(stripSize + (loop ? 0 : 5)) : null;
  const right = antialiased ? emptyStrip(stripSize + (loop ? 0 : 5)) : null;

  let previousDir: Vec2 = { x: 0, y: 0 };
  let color: StrokeRGBA = { r: 1, g: 1, b: 1, a: 1 };
  for (let i = 0; i < pointCount; i++) {
    const isFirst = i === 0;
    const isLast = i === pointCount - 1;

    const dir = segmentDir(points, i, previousDir);
    if (isFirst && loop) previousDir = lastSegmentDir;
    else if (isLast && loop) previousDir = firstSegmentDir;

    let baseEdgeOffset: Vec2;
    if (isFirst && !loop) baseEdgeOffset = orthogonal(firstSegmentDir);
    else if (isLast && !loop) baseEdgeOffset = orthogonal(lastSegmentDir);
    else baseEdgeOffset = edgeOffsetClamped(dir, previousDir);

    const edgeOffset = scale(baseEdgeOffset, width * 0.5);
    const border = scale(baseEdgeOffset, borderSize);
    const pos = points[i]!;
    const j = i * 2 + (loop ? 0 : 2);
    // `pline` has no caps when it is not antialiased, so its own indices start at 0.
    const coreJ = capped ? j : i * 2;

    core.points[coreJ] = add(pos, edgeOffset);
    core.points[coreJ + 1] = { x: pos.x - edgeOffset.x, y: pos.y - edgeOffset.y };

    if (i < colors.length) color = colors[i]!;
    const faded = transparent(color);

    core.colors[coreJ] = color;
    core.colors[coreJ + 1] = color;

    if (left && right) {
      left.points[j] = add(pos, edgeOffset);
      left.points[j + 1] = add(add(pos, edgeOffset), border);
      right.points[j] = { x: pos.x - edgeOffset.x, y: pos.y - edgeOffset.y };
      right.points[j + 1] = { x: pos.x - edgeOffset.x - border.x, y: pos.y - edgeOffset.y - border.y };
      left.colors[j] = color;
      left.colors[j + 1] = faded;
      right.colors[j] = color;
      right.colors[j + 1] = faded;
    }

    if (capped && isFirst) {
      const beginBorder = scale(dir, -borderSize);
      core.points[0] = add(add(pos, edgeOffset), beginBorder);
      core.points[1] = add({ x: pos.x - edgeOffset.x, y: pos.y - edgeOffset.y }, beginBorder);
      core.colors[0] = faded;
      core.colors[1] = faded;
      if (left && right) {
        left.points[0] = add(add(pos, edgeOffset), beginBorder);
        left.points[1] = add(add(add(pos, edgeOffset), beginBorder), border);
        left.colors[0] = faded;
        left.colors[1] = faded;
        right.points[0] = add({ x: pos.x - edgeOffset.x, y: pos.y - edgeOffset.y }, beginBorder);
        right.points[1] = {
          x: pos.x - edgeOffset.x + beginBorder.x - border.x,
          y: pos.y - edgeOffset.y + beginBorder.y - border.y,
        };
        right.colors[0] = faded;
        right.colors[1] = faded;
      }
    }

    if (capped && isLast) {
      const endBorder = scale(previousDir, borderSize);
      const endIndex = stripSize + 2;
      core.points[endIndex] = add(add(pos, edgeOffset), endBorder);
      core.points[endIndex + 1] = add({ x: pos.x - edgeOffset.x, y: pos.y - edgeOffset.y }, endBorder);
      core.colors[endIndex] = faded;
      core.colors[endIndex + 1] = faded;
      if (left && right) {
        // The corner quad walks back to the edge vertex, so its seam runs from the corner (`:1145-1147`).
        left.points[endIndex] = add(pos, edgeOffset);
        left.points[endIndex + 1] = add(add(add(pos, edgeOffset), endBorder), border);
        left.points[endIndex + 2] = add(add(pos, edgeOffset), endBorder);
        left.colors[endIndex] = color;
        left.colors[endIndex + 1] = faded;
        left.colors[endIndex + 2] = faded;
        right.points[endIndex] = { x: pos.x - edgeOffset.x, y: pos.y - edgeOffset.y };
        right.points[endIndex + 1] = {
          x: pos.x - edgeOffset.x + endBorder.x - border.x,
          y: pos.y - edgeOffset.y + endBorder.y - border.y,
        };
        right.points[endIndex + 2] = add({ x: pos.x - edgeOffset.x, y: pos.y - edgeOffset.y }, endBorder);
        right.colors[endIndex] = color;
        right.colors[endIndex + 1] = faded;
        right.colors[endIndex + 2] = faded;
      }
    }

    previousDir = dir;
  }

  const positions: number[] = [];
  const flatColors: number[] = [];
  const indices: number[] = [];
  for (const strip of [core, left, right]) {
    if (!strip) continue;
    const base = positions.length / 3;
    for (let i = 0; i < strip.points.length; i++) {
      positions.push(strip.points[i]!.x, -strip.points[i]!.y, 0);
      const c = strip.colors[i]!;
      flatColors.push(c.r, c.g, c.b, c.a);
    }
    for (let i = 0; i + 2 < strip.points.length; i++) {
      indices.push(base + i, base + i + 1, base + i + 2);
    }
  }

  return { positions, indices, colors: flatColors };
}
