/**
 * `TextureProgressBar`'s radial fill modes: `unit_val_to_uv` (`texture_progress_bar.cpp:181-224`),
 * `get_relative_center` (`:245-256`) and the `draw_polygon` build in `NOTIFICATION_DRAW`
 * (`:483-524`). Pure TS, no React or THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Vec2 } from '../../../../r3f/controls/native/rect';

export const FILL_CLOCKWISE = 4;
export const FILL_COUNTER_CLOCKWISE = 5;
export const FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE = 8;

/** `Math::fposmodp` (`core/math/math_funcs.h:296-302`): `fmod`, folded non-negative. */
function fposmodp(x: number, y: number): number {
  const value = x % y;
  return value < 0 ? value + y : value;
}

/** `set_fill_degrees` (`texture_progress_bar.cpp:610-619`): `CLAMP(p_angle, 0, 360)`, always applied. */
export function clampRadialFillDegrees(radialFillDegrees: number | undefined): number {
  const degrees = radialFillDegrees ?? 360;
  if (!Number.isFinite(degrees)) return 360;
  return Math.min(Math.max(degrees, 0), 360);
}

/**
 * `set_radial_initial_angle` (`texture_progress_bar.cpp:591-604`):
 * `ERR_FAIL_COND_MSG(!is_finite)` refuses a non-finite write, keeping the
 * class default (`0`, `texture_progress_bar.h:107`). An in-range write passes
 * through, and anything else wraps with `fposmodp`.
 */
export function normalizeRadialInitialAngle(radialInitialAngle: number | undefined): number {
  const angle = radialInitialAngle ?? 0;
  if (!Number.isFinite(angle)) return 0;
  if (angle < 0 || angle > 360) return fposmodp(angle, 360);
  return angle;
}

/** `get_relative_center` (`:245-256`). `null` mirrors `progress.is_null()` (`:246-248`, and the same guard in `unit_val_to_uv`, `:181-183`). */
export function radialRelativeCenter(textureSize: Vec2, radialCenterOffset: Vec2): Vec2 {
  if (textureSize.x <= 0 || textureSize.y <= 0) return { x: 0, y: 0 };
  const px = textureSize.x / 2 + radialCenterOffset.x;
  const py = textureSize.y / 2 + radialCenterOffset.y;
  return {
    x: Math.min(Math.max(px / textureSize.x, 0), 1),
    y: Math.min(Math.max(py / textureSize.y, 0), 1),
  };
}

/**
 * `unit_val_to_uv` (`:181-224`): a Liang-Barsky clip of the ray from `center` at `val*TAU - PI/2`
 * against the unit square, with the source's single mutable `dir`. A later edge branch's gate reads
 * what an earlier branch wrote, so independent per-axis clamps would fire different edges.
 */
export function unitValToUv(val: number, center: Vec2): Vec2 {
  let v = val;
  if (v < 0) v += 1;
  if (v > 1) v -= 1;

  const angle = v * Math.PI * 2 - Math.PI * 0.5;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  let t1 = 1.0;
  const edgeLeft = 0;
  const edgeRight = 1;
  const edgeBottom = 0;
  const edgeTop = 1;

  for (let edge = 0; edge < 4; edge++) {
    let cq: number;
    let cp: number;
    if (edge === 0) {
      if (dir.x > 0) continue;
      cq = -(edgeLeft - center.x);
      dir.x *= 2.0 * cq;
      cp = -dir.x;
    } else if (edge === 1) {
      if (dir.x < 0) continue;
      cq = edgeRight - center.x;
      dir.x *= 2.0 * cq;
      cp = dir.x;
    } else if (edge === 2) {
      if (dir.y > 0) continue;
      cq = -(edgeBottom - center.y);
      dir.y *= 2.0 * cq;
      cp = -dir.y;
    } else {
      if (dir.y < 0) continue;
      cq = edgeTop - center.y;
      dir.y *= 2.0 * cq;
      cp = dir.y;
    }
    const cr = cq / cp;
    if (cr >= 0 && cr < t1) t1 = cr;
  }

  return { x: center.x + t1 * dir.x, y: center.y + t1 * dir.y };
}

/** `float val = get_as_ratio() * rad_max_degrees / 360;` (`:483`). */
export function radialFillValue(ratio: number, radMaxDegrees: number): number {
  return (ratio * radMaxDegrees) / 360;
}

export interface RadialFillGeometry {
  /** xyz triples, Godot pixels, +Y down. The caller flips and offsets, as for `ninePatchGeometry`. */
  positions: number[];
  /** uv pairs, three's convention (v=1 at the texture's top row). */
  uvs: number[];
  indices: number[];
}

/**
 * The triangle-fan geometry for `0 < val < 1` (`:487-522`), or `null` when `draw_polygon`'s
 * `points.size() >= 2` guard (`:518`) fails. The caller handles `val === 1` (full rect) and `val === 0`
 * (nothing) (`:485-486`). Every vertex is `offset + uv * size`, one affine map, so the fan matches
 * `draw_polygon`'s triangulator pixel for pixel: the two differ only in which diagonal splits a quad.
 */
export function radialFillGeometry(
  mode: number,
  val: number,
  radInitAngleDegrees: number,
  center: Vec2,
  size: Vec2,
  offset: Vec2
): RadialFillGeometry | null {
  const direction = mode === FILL_COUNTER_CLOCKWISE ? -1 : 1;
  const start =
    mode === FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE ? radInitAngleDegrees / 360 - val / 2 : radInitAngleDegrees / 360;
  const end = start + direction * val;
  const from = Math.min(start, end);
  const to = Math.max(start, end);

  const angles: number[] = [from];
  for (let corner = Math.floor(from * 4 + 0.5) * 0.25 + 0.125; corner < to; corner += 0.25) {
    angles.push(corner);
  }
  angles.push(to);

  const uvs: Vec2[] = [];
  const points: Vec2[] = [];
  for (const f of angles) {
    const uv = unitValToUv(f, center);
    // `Vector<Point2>::has`: exact per-component equality, not approximate.
    if (uvs.some((u) => u.x === uv.x && u.y === uv.y)) continue;
    points.push({ x: offset.x + uv.x * size.x, y: offset.y + uv.y * size.y });
    uvs.push(uv);
  }

  if (points.length < 2) return null;

  points.push({ x: offset.x + size.x * center.x, y: offset.y + size.y * center.y });
  uvs.push(center);

  const centerIndex = points.length - 1;
  const positions: number[] = [];
  const uvOut: number[] = [];
  for (let i = 0; i < points.length; i++) {
    positions.push(points[i]!.x, points[i]!.y, 0);
    // three's V is bottom-up, and Godot's UV Y (`uv.y` here) is top-down.
    uvOut.push(uvs[i]!.x, 1 - uvs[i]!.y);
  }
  const indices: number[] = [];
  for (let i = 0; i < centerIndex - 1; i++) {
    indices.push(centerIndex, i, i + 1);
  }

  return { positions, uvs: uvOut, indices };
}
