/**
 * Pure geometry for a `StyleBoxFlat`, ported from
 * `scene/resources/style_box_flat.cpp` (Godot 4.6.3) — `StyleBoxFlat::draw`
 * and its `draw_rounded_rectangle`/`adapt_values`/`set_inner_corner_radius`/
 * `set_corner_scale` helpers — restricted to this module's scope: fill,
 * per-corner radii, per-edge borders, `border_blend`, `draw_center`, expand
 * margins. Anti-aliasing (`anti_aliased`/`aa_size`), `skew` and the drop
 * shadow are NOT modelled (`StyleBoxFlatData` carries none of them), which is
 * equivalent to always taking `draw()`'s `aa_on = false` branch with
 * `skew = (0, 0)` and `shadow_size = 0`.
 *
 * `border_blend` is realised with vertex colours, not a shader: the border
 * ring's INNER (infill-boundary) vertices are coloured `border_color_inner`
 * (which the source sets to `bg_color` when blending, so it matches the
 * fill) and its OUTER (style-rect-boundary) vertices stay `border_color`;
 * three's own per-triangle colour interpolation blends one into the other
 * across the ring, exactly how the RenderingServer's flat-shaded triangle
 * array does in Godot itself.
 *
 * No THREE import — plain number arrays throughout, positions in the same
 * Godot-pixel, +Y-down space as the `Rect2` passed in (`native/rect.ts`); the
 * caller converts to a three.js position, this module never flips an axis.
*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { StyleBoxFlatData } from './styleBoxFlat';
import type { Rect2 } from './rect';

/** `StyleBoxFlat::corner_detail` (`style_box_flat.h:51`) — this module never varies it. */
const CORNER_DETAIL = 8;

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface GeometryBuffers {
  positions: number[];
  indices: number[];
  colors: number[];
}

// --- Side/Corner index conventions, matching Godot's `Side`/`Corner` enums --

const SIDE_LEFT = 0;
const SIDE_TOP = 1;
const SIDE_RIGHT = 2;
const SIDE_BOTTOM = 3;

const CORNER_TOP_LEFT = 0;
const CORNER_TOP_RIGHT = 1;
const CORNER_BOTTOM_RIGHT = 2;
const CORNER_BOTTOM_LEFT = 3;

function sides(v: StyleBoxFlatData['borderWidth']): [number, number, number, number] {
  return [v.left, v.top, v.right, v.bottom];
}

function corners(v: StyleBoxFlatData['cornerRadius']): [number, number, number, number] {
  return [v.topLeft, v.topRight, v.bottomRight, v.bottomLeft];
}

// --- Rect2 helpers (core/math/rect2.h) ---------------------------------------

/** `Rect2::grow_individual` (`core/math/rect2.h:238-246`). */
function growIndividual(r: Rect2, left: number, top: number, right: number, bottom: number): Rect2 {
  return { x: r.x - left, y: r.y - top, w: r.w + left + right, h: r.h + top + bottom };
}

// --- `adapt_values` (style_box_flat.cpp:436-442) -----------------------------

/**
 * Scales a pair of opposing values down (never up) so they don't overflow
 * `p_width`, then clamps each to its own max and to whatever a PRIOR call
 * already wrote for that index (the running `Math.min`, needed because
 * `draw()` calls this twice per array with overlapping index pairs for
 * corner-radius adaptation).
 */
function adaptValues(
  indexA: number,
  indexB: number,
  adapted: number[],
  values: readonly [number, number, number, number],
  width: number,
  maxA: number,
  maxB: number
): void {
  const a = values[indexA]!;
  const b = values[indexB]!;
  const factor = Math.min(1, width / (a + b));
  adapted[indexA] = Math.min(Math.min(a * factor, maxA), adapted[indexA]!);
  adapted[indexB] = Math.min(Math.min(b * factor, maxB), adapted[indexB]!);
}

/** `style_box_flat.cpp:479-491`, the non-shadow, non-AA adaptation `draw()` always runs. */
function adaptBorderAndCorner(
  borderWidth: readonly [number, number, number, number],
  cornerRadius: readonly [number, number, number, number],
  width: number,
  height: number
): { border: number[]; corner: number[] } {
  const border = [1e6, 1e6, 1e6, 1e6];
  adaptValues(SIDE_TOP, SIDE_BOTTOM, border, borderWidth, height, height, height);
  adaptValues(SIDE_LEFT, SIDE_RIGHT, border, borderWidth, width, width, width);

  const corner = [1e6, 1e6, 1e6, 1e6];
  adaptValues(CORNER_TOP_RIGHT, CORNER_BOTTOM_RIGHT, corner, cornerRadius, height, height - border[SIDE_BOTTOM]!, height - border[SIDE_TOP]!);
  adaptValues(CORNER_TOP_LEFT, CORNER_BOTTOM_LEFT, corner, cornerRadius, height, height - border[SIDE_BOTTOM]!, height - border[SIDE_TOP]!);
  adaptValues(CORNER_TOP_LEFT, CORNER_TOP_RIGHT, corner, cornerRadius, width, width - border[SIDE_RIGHT]!, width - border[SIDE_LEFT]!);
  adaptValues(CORNER_BOTTOM_LEFT, CORNER_BOTTOM_RIGHT, corner, cornerRadius, width, width - border[SIDE_RIGHT]!, width - border[SIDE_LEFT]!);

  return { border, corner };
}

// --- `set_inner_corner_radius` / `set_corner_scale` (style_box_flat.cpp:228-311) --

interface Point {
  x: number;
  y: number;
}

/** `style_box_flat.cpp:228-238`: shrink each corner radius by the border thickness on its two adjacent sides. */
function innerCornerRadius(styleRect: Rect2, targetRect: Rect2, cornerRadius: readonly number[]): number[] {
  const borderLeft = targetRect.x - styleRect.x;
  const borderTop = targetRect.y - styleRect.y;
  const borderRight = styleRect.w - targetRect.w - borderLeft;
  const borderBottom = styleRect.h - targetRect.h - borderTop;

  return [
    Math.max(cornerRadius[CORNER_TOP_LEFT]! - Math.min(borderTop, borderLeft), 0),
    Math.max(cornerRadius[CORNER_TOP_RIGHT]! - Math.min(borderTop, borderRight), 0),
    Math.max(cornerRadius[CORNER_BOTTOM_RIGHT]! - Math.min(borderBottom, borderRight), 0),
    Math.max(cornerRadius[CORNER_BOTTOM_LEFT]! - Math.min(borderBottom, borderLeft), 0),
  ];
}

/** `style_box_flat.cpp:240-311`: the per-corner scale that keeps adjacent radii from overlapping along a shared edge. */
function cornerScale(styleRect: Rect2, targetRect: Rect2, cornerRadius: readonly number[]): Point[] {
  const borderLeft = targetRect.x - styleRect.x;
  const borderTop = targetRect.y - styleRect.y;
  const borderRight = styleRect.w - targetRect.w - borderLeft;
  const borderBottom = styleRect.h - targetRect.h - borderTop;

  const tl = cornerRadius[CORNER_TOP_LEFT]!;
  const tr = cornerRadius[CORNER_TOP_RIGHT]!;
  const br = cornerRadius[CORNER_BOTTOM_RIGHT]!;
  const bl = cornerRadius[CORNER_BOTTOM_LEFT]!;

  const edgeOverflow = [
    -Math.min(0, targetRect.h - tl - bl), // SIDE_LEFT
    -Math.min(0, targetRect.w - tl - tr), // SIDE_TOP
    -Math.min(0, targetRect.h - tr - br), // SIDE_RIGHT
    -Math.min(0, targetRect.w - bl - br), // SIDE_BOTTOM
  ];

  const hbSum = borderLeft + borderRight;
  const vbSum = borderTop + borderBottom;
  const ratios = [
    hbSum > 0 ? borderLeft / hbSum : 0, // SIDE_LEFT
    vbSum > 0 ? borderTop / vbSum : 0, // SIDE_TOP
    hbSum > 0 ? borderRight / hbSum : 0, // SIDE_RIGHT
    vbSum > 0 ? borderBottom / vbSum : 0, // SIDE_BOTTOM
  ];

  const reduction: Point[] = [
    { x: edgeOverflow[SIDE_TOP]! * ratios[SIDE_LEFT]!, y: edgeOverflow[SIDE_LEFT]! * ratios[SIDE_TOP]! },
    { x: edgeOverflow[SIDE_TOP]! * ratios[SIDE_RIGHT]!, y: edgeOverflow[SIDE_RIGHT]! * ratios[SIDE_TOP]! },
    { x: edgeOverflow[SIDE_BOTTOM]! * ratios[SIDE_RIGHT]!, y: edgeOverflow[SIDE_RIGHT]! * ratios[SIDE_BOTTOM]! },
    { x: edgeOverflow[SIDE_BOTTOM]! * ratios[SIDE_LEFT]!, y: edgeOverflow[SIDE_LEFT]! * ratios[SIDE_BOTTOM]! },
  ];

  const pcr: Point[] = [
    { x: tl, y: tl },
    { x: tr, y: tr },
    { x: br, y: br },
    { x: bl, y: bl },
  ];

  const leftover: Point[] = pcr.map((p, i) => ({
    x: -Math.min(p.x - reduction[i]!.x, 0),
    y: -Math.min(p.y - reduction[i]!.y, 0),
  }));

  const distributed: Point[] = pcr.map((p, i) => {
    const prev = leftover[(i + 3) % 4]!;
    const next = leftover[(i + 1) % 4]!;
    return {
      x: Math.max(p.x - reduction[i]!.x - prev.x - next.x, 0),
      y: Math.max(p.y - reduction[i]!.y - prev.y - next.y, 0),
    };
  });

  const FLT_EPSILON = 1.1920929e-7;
  return pcr.map((p, i) => {
    const next = leftover[(i + 1) % 4]!;
    const prev = leftover[(i + 3) % 4]!;
    const unshrinkableX = Math.max(next.x + prev.x - distributed[i]!.x, 0);
    const unshrinkableY = Math.max(next.y + prev.y - distributed[i]!.y, 0);
    return {
      x: distributed[i]!.x / Math.max(p.x - unshrinkableX, FLT_EPSILON),
      y: distributed[i]!.y / Math.max(p.y - unshrinkableY, FLT_EPSILON),
    };
  });
}

// --- `draw_rounded_rectangle` (style_box_flat.cpp:313-434) -------------------

/** Corner-arc centre points (`outer_points`/`inner_points`, style_box_flat.cpp:326-345). */
function cornerCentres(rect: Rect2, radius: readonly number[], scale: readonly Point[]): Point[] {
  return [
    { x: rect.x + radius[CORNER_TOP_LEFT]! * scale[CORNER_TOP_LEFT]!.x, y: rect.y + radius[CORNER_TOP_LEFT]! * scale[CORNER_TOP_LEFT]!.y },
    {
      x: rect.x + rect.w - radius[CORNER_TOP_RIGHT]! * scale[CORNER_TOP_RIGHT]!.x,
      y: rect.y + radius[CORNER_TOP_RIGHT]! * scale[CORNER_TOP_RIGHT]!.y,
    },
    {
      x: rect.x + rect.w - radius[CORNER_BOTTOM_RIGHT]! * scale[CORNER_BOTTOM_RIGHT]!.x,
      y: rect.y + rect.h - radius[CORNER_BOTTOM_RIGHT]! * scale[CORNER_BOTTOM_RIGHT]!.y,
    },
    {
      x: rect.x + radius[CORNER_BOTTOM_LEFT]! * scale[CORNER_BOTTOM_LEFT]!.x,
      y: rect.y + rect.h - radius[CORNER_BOTTOM_LEFT]! * scale[CORNER_BOTTOM_LEFT]!.y,
    },
  ];
}

function pushColor(out: number[], c: Rgba): void {
  out.push(c.r, c.g, c.b, c.a);
}

/**
 * Port of `draw_rounded_rectangle` (style_box_flat.cpp:313-434), minus its
 * `skew` term (this module never models skew, so it is always zero and drops
 * out of the vertex formula entirely).
 *
 * `ringRect`/`innerColor`/`outerColor` describe the OUTER boundary and its
 * colour; `innerRect`/`innerColor` (again) the boundary closer to the shape's
 * own centre — matching the source's own "inner vertex written first, outer
 * vertex only when `draw_border`" order. For a border ring, `ringRect` is the
 * style rect and `innerRect` is the infill boundary; for the filled centre,
 * both are the infill rect (so only the "inner" vertex is ever written).
 */
function drawRoundedRectangle(
  buffers: GeometryBuffers,
  styleRect: Rect2,
  cornerRadius: readonly number[],
  ringRect: Rect2,
  innerRect: Rect2,
  innerColor: Rgba,
  outerColor: Rgba,
  isFilled: boolean
): void {
  const vertOffset = buffers.positions.length / 3;
  const hasRadius = cornerRadius.some((r) => r > 0);
  const adaptedCornerDetail = hasRadius ? CORNER_DETAIL : 1;
  const drawBorder = !isFilled;

  const ringCornerRadius = innerCornerRadius(styleRect, ringRect, cornerRadius);
  const ringScale = cornerScale(styleRect, ringRect, ringCornerRadius);
  const outerPoints = cornerCentres(ringRect, ringCornerRadius, ringScale);

  const innerRadius = innerCornerRadius(styleRect, innerRect, cornerRadius);
  const innerScale = cornerScale(styleRect, innerRect, innerRadius);
  const innerPoints = cornerCentres(innerRect, innerRadius, innerScale);

  const quarterArc = Math.PI / 2;

  for (let cornerIdx = 0; cornerIdx < 4; cornerIdx++) {
    for (let detail = 0; detail <= adaptedCornerDetail; detail++) {
      const angle = (cornerIdx + detail / adaptedCornerDetail) * quarterArc + Math.PI;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const ix = innerRadius[cornerIdx]! * cos * innerScale[cornerIdx]!.x + innerPoints[cornerIdx]!.x;
      const iy = innerRadius[cornerIdx]! * sin * innerScale[cornerIdx]!.y + innerPoints[cornerIdx]!.y;
      buffers.positions.push(ix, iy, 0);
      pushColor(buffers.colors, innerColor);

      if (drawBorder) {
        const ox = ringCornerRadius[cornerIdx]! * cos * ringScale[cornerIdx]!.x + outerPoints[cornerIdx]!.x;
        const oy = ringCornerRadius[cornerIdx]! * sin * ringScale[cornerIdx]!.y + outerPoints[cornerIdx]!.y;
        buffers.positions.push(ox, oy, 0);
        pushColor(buffers.colors, outerColor);
      }
    }
  }

  const ringVertCount = buffers.positions.length / 3 - vertOffset;

  if (drawBorder) {
    for (let i = 0; i < ringVertCount; i++) {
      buffers.indices.push(
        vertOffset + (i % ringVertCount),
        vertOffset + ((i + 2) % ringVertCount),
        vertOffset + ((i + 1) % ringVertCount)
      );
    }
  }

  if (isFilled) {
    const stripesCount = ringVertCount / 2 - 1;
    const lastVertId = ringVertCount - 1;
    for (let i = 0; i < stripesCount; i++) {
      buffers.indices.push(vertOffset + i, vertOffset + lastVertId - i - 1, vertOffset + i + 1);
      buffers.indices.push(vertOffset + i, vertOffset + lastVertId - i, vertOffset + lastVertId - i - 1);
    }
  }
}

/**
 * Builds a `StyleBoxFlat`'s draw geometry for a rect, in the same Godot-pixel
 * space the rect is given in. Empty buffers for a degenerate rect (zero
 * width/height, matching `draw()`'s early return) or a box that draws
 * nothing (`!draw_border && !draw_center`, shadow not modelled).
 */
export function styleBoxFlatGeometry(data: StyleBoxFlatData, rect: Rect2): GeometryBuffers {
  const empty: GeometryBuffers = { positions: [], indices: [], colors: [] };

  const borderWidth = sides(data.borderWidth);
  const drawBorder = borderWidth.some((w) => w > 0);
  if (!drawBorder && !data.drawCenter) return empty;

  // StyleBoxFlat::draw: style_rect = p_rect.grow_individual(expand_margin[*]).
  const styleRect = growIndividual(
    rect,
    data.expandMargin.left,
    data.expandMargin.top,
    data.expandMargin.right,
    data.expandMargin.bottom
  );
  if (styleRect.w <= 0 || styleRect.h <= 0) return empty;

  const cornerRadiusIn = corners(data.cornerRadius);
  const { border: adaptedBorder, corner: adaptedCorner } = adaptBorderAndCorner(
    borderWidth,
    cornerRadiusIn,
    styleRect.w,
    styleRect.h
  );

  const infillRect = growIndividual(
    styleRect,
    -adaptedBorder[SIDE_LEFT]!,
    -adaptedBorder[SIDE_TOP]!,
    -adaptedBorder[SIDE_RIGHT]!,
    -adaptedBorder[SIDE_BOTTOM]!
  );

  // style_box_flat.cpp:475-477.
  const borderColorAlpha: Rgba = { ...data.borderColor, a: 0 };
  const blendOn = data.borderBlend && drawBorder;
  const borderColorBlend: Rgba = data.drawCenter ? data.bgColor : borderColorAlpha;
  const borderColorInner: Rgba = blendOn ? borderColorBlend : data.borderColor;

  const buffers: GeometryBuffers = { positions: [], indices: [], colors: [] };

  // Border ring (aa_on forced false, so this is the ONLY border pass — no AA
  // feather rings, matching `draw()`'s `if (draw_border && !aa_on)`).
  if (drawBorder) {
    drawRoundedRectangle(buffers, styleRect, adaptedCorner, styleRect, infillRect, borderColorInner, data.borderColor, false);
  }

  // Centre fill (`if (draw_center && (!aa_on || blend_on))` — always true here).
  if (data.drawCenter) {
    drawRoundedRectangle(buffers, styleRect, adaptedCorner, infillRect, infillRect, data.bgColor, data.bgColor, true);
  }

  return buffers;
}
