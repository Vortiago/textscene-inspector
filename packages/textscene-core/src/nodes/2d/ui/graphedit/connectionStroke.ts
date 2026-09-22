/**
 * A connection line's stroked ribbon, as vertex-coloured triangle geometry —
 * `default_connections_shader`'s fragment stage (`scene/gui/graph_edit.cpp:
 * 217-238`), ported as three fixed-width RINGS rather than a per-fragment
 * shader (`styleBoxFlatGeometry.ts`'s own precedent for `border_blend`/AA):
 *
 *   dist = abs(UV.y - 0.5)                              // 0 at the centreline, 0.5 at the edge
 *   fake_aa_width = rim_width = 1.5 / line_width         // UV units; 1.5px in SCREEN space either way
 *   alpha       = smoothstep(0.5, 0.5 - fake_aa_width, dist)
 *   final_color = mix(rim_color, COLOR, smoothstep(0.5 - rim_width, 0.5 - fake_aa_width - rim_width, dist))
 *
 * so, measuring inward from each edge: the outer 1.5px fades `rim_color`'s
 * alpha to 0, the next 1.5px blends from `rim_color` to the gradient COLOR,
 * and everything inside that is solid gradient COLOR. Both bands are FIXED
 * pixel widths — the `1.5 / line_width` UV fraction always maps back to
 * 1.5px once multiplied by the ribbon's own `line_width` — so a thin ribbon
 * clamps its inner ring rather than growing the bands.
 *
 * Vertex-colour interpolation is linear, not `smoothstep`'s ease curve —
 * the same approximation `styleBoxFlatGeometry.ts`'s own AA rings make, for
 * the same reason: three's triangle rasterizer has no other option without a
 * custom fragment shader.
 *
 * The core colour is Godot's per-connection `Gradient` (`from_color` at 0,
 * `to_color` at 1, `graph_edit.cpp:1705-1707`), sampled here by CUMULATIVE
 * LENGTH fraction along the polyline — `Line2D`'s own `LINE_TEXTURE_STRETCH`
 * gradient sampling. The two rim rings stay the theme's flat
 * `connection_rim_color`, never gradient-blended.
 *
 * Positions are Godot pixels (+Y down) IN; the Y flip into three-space
 * happens here, once, matching `Line2D`'s own `buildLineGeometry`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vec2 } from '../../../../r3f/controls/native/rect';

export interface StrokeRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GeometryBuffers {
  positions: number[];
  indices: number[];
  colors: number[];
}

/** `fake_aa_width`/`rim_width`'s common numerator, `1.5` — `graph_edit.cpp:232-233`. */
const FADE_BAND_PX = 1.5;
const RIM_BAND_PX = 1.5;
/** Six cross-section vertices per sample point: outer fade × 2, rim × 2, core × 2. */
const RINGS_PER_POINT = 6;

function lerpColor(a: StrokeRGBA, b: StrokeRGBA, t: number): StrokeRGBA {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

/**
 * `points` in Godot px (+Y down), already resolved to the destination space.
 * `lineWidth` is `_get_shader_line_width()`'s result — Godot px, not zoom-scaled
 * (this module's own callers apply that upstream).
 */
export function connectionStrokeGeometry(
  points: readonly Vec2[],
  lineWidth: number,
  fromColor: StrokeRGBA,
  toColor: StrokeRGBA,
  rimColor: StrokeRGBA
): GeometryBuffers {
  const n = points.length;
  if (n < 2) return { positions: [], indices: [], colors: [] };

  const halfWidth = lineWidth / 2;
  const coreEdge = Math.max(0, halfWidth - RIM_BAND_PX - FADE_BAND_PX);
  const rimEdge = Math.max(coreEdge, halfWidth - FADE_BAND_PX);
  const outerEdge = halfWidth;
  const ringOffsets = [-outerEdge, -rimEdge, -coreEdge, coreEdge, rimEdge, outerEdge];

  const rimTransparent: StrokeRGBA = { ...rimColor, a: 0 };

  const lengths: number[] = [0];
  for (let i = 1; i < n; i++) {
    lengths.push(lengths[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  }
  const total = lengths[n - 1]! || 1;

  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(n - 1, i + 1)]!;
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty);
    if (len < 1e-9) {
      tx = 1;
      ty = 0;
    } else {
      tx /= len;
      ty /= len;
    }
    // Perpendicular to the tangent — the cross-section axis.
    const nx = -ty;
    const ny = tx;

    const core = lerpColor(fromColor, toColor, lengths[i]! / total);
    const ringColors: readonly StrokeRGBA[] = [rimTransparent, rimColor, core, core, rimColor, rimTransparent];

    for (let k = 0; k < RINGS_PER_POINT; k++) {
      const off = ringOffsets[k]!;
      const px = points[i]!.x + nx * off;
      const py = points[i]!.y + ny * off;
      positions.push(px, -py, 0);
      const c = ringColors[k]!;
      colors.push(c.r, c.g, c.b, c.a);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base0 = i * RINGS_PER_POINT;
    const base1 = (i + 1) * RINGS_PER_POINT;
    for (let k = 0; k < RINGS_PER_POINT - 1; k++) {
      const a0 = base0 + k;
      const a1 = base0 + k + 1;
      const b0 = base1 + k;
      const b1 = base1 + k + 1;
      indices.push(a0, b0, a1, a1, b0, b1);
    }
  }

  return { positions, indices, colors };
}
