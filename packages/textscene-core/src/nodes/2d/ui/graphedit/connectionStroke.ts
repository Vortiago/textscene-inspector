/**
 * A connection's stroked ribbon as vertex-coloured triangles: the fragment stage of
 * `default_connections_shader` (`scene/gui/graph_edit.cpp:
 * 217-238`) ported as fixed-width rings, as `styleBoxFlatGeometry.ts` does for AA:
 *
 *   dist = abs(UV.y - 0.5)                              // 0 at the centreline, 0.5 at the edge
 *   fake_aa_width = rim_width = 1.5 / line_width         // UV units; 1.5px in SCREEN space either way
 *   alpha       = smoothstep(0.5, 0.5 - fake_aa_width, dist)
 *   final_color = mix(rim_color, COLOR, smoothstep(0.5 - rim_width, 0.5 - fake_aa_width - rim_width, dist))
 *
 * From each edge inward: 1.5px fades `rim_color` to alpha 0, 1.5px blends `rim_color` into
 * the core colour, and the rest is the core. A thin ribbon clamps its inner ring. The rings
 * interpolate linearly, not with `smoothstep`, which needs a custom fragment shader.
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

/** The numerator `1.5` of `fake_aa_width` and `rim_width` (`graph_edit.cpp:232-233`). */
const FADE_BAND_PX = 1.5;
const RIM_BAND_PX = 1.5;
/** Six cross-section vertices per sample point: two each for the outer fade, the rim and the core. */
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
 * `points` in Godot px (+Y down), in the destination space. The Y flip into three space
 * happens here, as in `buildLineGeometry` of `Line2D`. `lineWidth` is `_get_shader_line_width()`
 * in Godot px, not zoom-scaled. The core samples the `from_color` to `to_color` gradient
 * (`graph_edit.cpp:1705-1707`) by cumulative length, and the rim stays `connection_rim_color`.
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
    // Perpendicular to the tangent: the cross-section axis.
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
