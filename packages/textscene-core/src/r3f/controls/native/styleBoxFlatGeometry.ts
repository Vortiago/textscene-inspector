/**
 * Pure geometry for a `StyleBoxFlat`, ported from `StyleBoxFlat::draw` and its
 * helpers in `scene/resources/style_box_flat.cpp` (Godot 4.6.3). Plain number
 * arrays in the input rect's Godot-pixel, +Y-down space (`native/rect.ts`): no
 * THREE, and the caller flips the axis.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { StyleBoxFlatData } from './styleBoxFlat';
import type { Rect2, Vec2 } from './rect';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

// `border_blend` and the AA rings use vertex colours, not a shader: a ring's inner
// vertices take `border_color_inner` and its outer ones `border_color`, and three
// interpolates across each triangle as Godot's flat triangle array does.
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

/** `Rect2::grow` (`core/math/rect2.h:230-236`): the same amount on all four sides. */
function grow(r: Rect2, by: number): Rect2 {
  return growIndividual(r, by, by, by, by);
}

/** `Rect2::position += offset`: moves a rect without resizing it. */
function translate(r: Rect2, offset: Vec2): Rect2 {
  return { x: r.x + offset.x, y: r.y + offset.y, w: r.w, h: r.h };
}

// --- `adapt_values` (style_box_flat.cpp:436-442) -----------------------------

/**
 * Scales a pair of opposing values down, never up, so they do not overflow
 * `p_width`, then clamps each to its max and to a prior call's value for that
 * index: `draw()` calls this twice per array with overlapping index pairs.
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
 * Port of `draw_rounded_rectangle` (style_box_flat.cpp:313-434). `ringRect` and
 * `outerColor` are the outer boundary, `innerRect` and `innerColor` the one
 * nearer the centre. The inner vertex is written first, the outer one only for
 * a border ring. The filled centre passes the infill rect as both.
 */
function drawRoundedRectangle(
  buffers: GeometryBuffers,
  styleRect: Rect2,
  cornerRadius: readonly number[],
  cornerDetail: number,
  skew: Vec2,
  ringRect: Rect2,
  innerRect: Rect2,
  innerColor: Rgba,
  outerColor: Rgba,
  isFilled: boolean
): void {
  const vertOffset = buffers.positions.length / 3;
  const hasRadius = cornerRadius.some((r) => r > 0);
  const adaptedCornerDetail = hasRadius ? cornerDetail : 1;
  const drawBorder = !isFilled;

  const ringCornerRadius = innerCornerRadius(styleRect, ringRect, cornerRadius);
  const ringScale = cornerScale(styleRect, ringRect, ringCornerRadius);
  const outerPoints = cornerCentres(ringRect, ringCornerRadius, ringScale);

  const innerRadius = innerCornerRadius(styleRect, innerRect, cornerRadius);
  const innerScale = cornerScale(styleRect, innerRect, innerRadius);
  const innerPoints = cornerCentres(innerRect, innerRadius, innerScale);

  const quarterArc = Math.PI / 2;

  // `style_rect_center` (`style_box_flat.cpp:352`): every vertex shears about the
  // style rect's centre, not its own ring's, so all rings of one box lean together.
  const centreX = styleRect.x + styleRect.w / 2;
  const centreY = styleRect.y + styleRect.h / 2;
  const shear = (x: number, y: number): [number, number] => [
    x + -skew.x * (y - centreY),
    y + -skew.y * (x - centreX),
  ];

  for (let cornerIdx = 0; cornerIdx < 4; cornerIdx++) {
    for (let detail = 0; detail <= adaptedCornerDetail; detail++) {
      const angle = (cornerIdx + detail / adaptedCornerDetail) * quarterArc + Math.PI;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const ix = innerRadius[cornerIdx]! * cos * innerScale[cornerIdx]!.x + innerPoints[cornerIdx]!.x;
      const iy = innerRadius[cornerIdx]! * sin * innerScale[cornerIdx]!.y + innerPoints[cornerIdx]!.y;
      const [six, siy] = shear(ix, iy);
      buffers.positions.push(six, siy, 0);
      pushColor(buffers.colors, innerColor);

      if (drawBorder) {
        const ox = ringCornerRadius[cornerIdx]! * cos * ringScale[cornerIdx]!.x + outerPoints[cornerIdx]!.x;
        const oy = ringCornerRadius[cornerIdx]! * sin * ringScale[cornerIdx]!.y + outerPoints[cornerIdx]!.y;
        const [sox, soy] = shear(ox, oy);
        buffers.positions.push(sox, soy, 0);
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
 * Builds a `StyleBoxFlat`'s draw geometry for a rect, in the rect's Godot-pixel
 * space. Empty buffers for a degenerate rect (`draw()`'s early return) or a box
 * with no border, no centre and no shadow.
 */
export function styleBoxFlatGeometry(data: StyleBoxFlatData, rect: Rect2): GeometryBuffers {
  const empty: GeometryBuffers = { positions: [], indices: [], colors: [] };

  const borderWidth = sides(data.borderWidth);
  const drawBorder = borderWidth.some((w) => w > 0);
  // `draw_shadow = (shadow_size > 0)` (`style_box_flat.cpp:458`): a `shadow_color`
  // alone draws nothing. The early return needs all three (`:459`), or a
  // shadow-only stylebox would paint nothing.
  const drawShadow = data.shadowSize > 0;
  if (!drawBorder && !data.drawCenter && !drawShadow) return empty;

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

  // draw(): `aa_on = (rounded_corners || !skew.is_zero_approx()) && anti_aliased`.
  // A sheared edge is diagonal even with sharp corners, so it needs the feather.
  const roundedCorners = cornerRadiusIn.some((r) => r > 0);
  const skewed = data.skew.x !== 0 || data.skew.y !== 0;
  const aaOn = (roundedCorners || skewed) && data.antiAliased;
  // aa_size_scaled = aa_size / oversampling, and oversampling is 1: nothing here
  // models `TextServer::get_current_drawn_item_oversampling()` (style_box_flat.cpp:499-502).
  const aaSizeScaled = data.aaSize;

  // draw(): style_box_flat.cpp:511-517: each side with a raw authored border_width
  // shrinks border_style_rect by aa_size_scaled, leaving room for the outer
  // feather ring inside style_rect.
  let borderStyleRect = styleRect;
  if (aaOn) {
    if (borderWidth[SIDE_LEFT]! > 0) borderStyleRect = growIndividual(borderStyleRect, -aaSizeScaled, 0, 0, 0);
    if (borderWidth[SIDE_TOP]! > 0) borderStyleRect = growIndividual(borderStyleRect, 0, -aaSizeScaled, 0, 0);
    if (borderWidth[SIDE_RIGHT]! > 0) borderStyleRect = growIndividual(borderStyleRect, 0, 0, -aaSizeScaled, 0);
    if (borderWidth[SIDE_BOTTOM]! > 0) borderStyleRect = growIndividual(borderStyleRect, 0, 0, 0, -aaSizeScaled);
  }

  const buffers: GeometryBuffers = { positions: [], indices: [], colors: [] };

  // Drop shadow (`style_box_flat.cpp:524-540`), first so the box paints over it.
  // Its rings adapt corners against `shadow_inner_rect`, so an offset shadow
  // keeps the box's own corner profile.
  if (drawShadow) {
    const shadowInnerRect = translate(styleRect, data.shadowOffset);
    const shadowRect = translate(grow(styleRect, data.shadowSize), data.shadowOffset);
    const shadowColorTransparent: Rgba = { ...data.shadowColor, a: 0 };

    drawRoundedRectangle(
      buffers,
      shadowInnerRect,
      adaptedCorner,
      data.cornerDetail,
      data.skew,
      shadowRect,
      shadowInnerRect,
      data.shadowColor,
      shadowColorTransparent,
      false
    );

    if (data.drawCenter) {
      drawRoundedRectangle(
        buffers,
        shadowInnerRect,
        adaptedCorner,
        data.cornerDetail,
        data.skew,
        shadowInnerRect,
        shadowInnerRect,
        data.shadowColor,
        data.shadowColor,
        true
      );
    }
  }

  // Border ring, no AA (`if (draw_border && !aa_on)`).
  if (drawBorder && !aaOn) {
    drawRoundedRectangle(
      buffers,
      borderStyleRect,
      adaptedCorner,
      data.cornerDetail,
      data.skew,
      borderStyleRect,
      infillRect,
      borderColorInner,
      data.borderColor,
      false
    );
  }

  // Centre fill, no AA yet (`if (draw_center && (!aa_on || blend_on))`).
  if (data.drawCenter && (!aaOn || blendOn)) {
    drawRoundedRectangle(
      buffers,
      borderStyleRect,
      adaptedCorner,
      data.cornerDetail,
      data.skew,
      infillRect,
      infillRect,
      data.bgColor,
      data.bgColor,
      true
    );
  }

  if (aaOn) {
    // style_box_flat.cpp:555-582: per-side AA feather widths. A bordered side
    // feathers the border's edges, and a borderless side feathers the fill's.
    const aaBorderWidth: number[] = [0, 0, 0, 0];
    const aaBorderWidthHalf: number[] = [0, 0, 0, 0];
    const aaFillWidth: number[] = [0, 0, 0, 0];
    const aaFillWidthHalf: number[] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      if (drawBorder && borderWidth[i]! > 0) {
        aaBorderWidth[i] = aaSizeScaled;
        aaBorderWidthHalf[i] = aaSizeScaled * 0.5;
      } else {
        aaFillWidth[i] = aaSizeScaled;
        aaFillWidthHalf[i] = aaSizeScaled * 0.5;
      }
    }

    // style_box_flat.cpp:584-601.
    if (data.drawCenter) {
      const infillRectAaTransparent = growIndividual(
        infillRect,
        aaFillWidthHalf[SIDE_LEFT]!,
        aaFillWidthHalf[SIDE_TOP]!,
        aaFillWidthHalf[SIDE_RIGHT]!,
        aaFillWidthHalf[SIDE_BOTTOM]!
      );
      const infillRectAaColored = growIndividual(
        infillRectAaTransparent,
        -aaFillWidth[SIDE_LEFT]!,
        -aaFillWidth[SIDE_TOP]!,
        -aaFillWidth[SIDE_RIGHT]!,
        -aaFillWidth[SIDE_BOTTOM]!
      );

      if (!blendOn) {
        drawRoundedRectangle(
          buffers,
          borderStyleRect,
          adaptedCorner,
          data.cornerDetail,
          data.skew,
          infillRectAaColored,
          infillRectAaColored,
          data.bgColor,
          data.bgColor,
          true
        );
      }
      if (!blendOn || !drawBorder) {
        const alphaBg: Rgba = { ...data.bgColor, a: 0 };
        drawRoundedRectangle(
          buffers,
          borderStyleRect,
          adaptedCorner,
          data.cornerDetail,
          data.skew,
          infillRectAaTransparent,
          infillRectAaColored,
          data.bgColor,
          alphaBg,
          false
        );
      }
    }

    // style_box_flat.cpp:604-629.
    if (drawBorder) {
      const innerRectAaColored = growIndividual(
        infillRect,
        aaBorderWidthHalf[SIDE_LEFT]!,
        aaBorderWidthHalf[SIDE_TOP]!,
        aaBorderWidthHalf[SIDE_RIGHT]!,
        aaBorderWidthHalf[SIDE_BOTTOM]!
      );
      const innerRectAaTransparent = growIndividual(
        innerRectAaColored,
        -aaBorderWidth[SIDE_LEFT]!,
        -aaBorderWidth[SIDE_TOP]!,
        -aaBorderWidth[SIDE_RIGHT]!,
        -aaBorderWidth[SIDE_BOTTOM]!
      );
      const outerRectAaTransparent = growIndividual(
        styleRect,
        aaBorderWidthHalf[SIDE_LEFT]!,
        aaBorderWidthHalf[SIDE_TOP]!,
        aaBorderWidthHalf[SIDE_RIGHT]!,
        aaBorderWidthHalf[SIDE_BOTTOM]!
      );
      const outerRectAaColored = growIndividual(
        borderStyleRect,
        aaBorderWidthHalf[SIDE_LEFT]!,
        aaBorderWidthHalf[SIDE_TOP]!,
        aaBorderWidthHalf[SIDE_RIGHT]!,
        aaBorderWidthHalf[SIDE_BOTTOM]!
      );

      // Border ring, not antialiased yet.
      drawRoundedRectangle(
        buffers,
        borderStyleRect,
        adaptedCorner,
        data.cornerDetail,
        data.skew,
        outerRectAaColored,
        blendOn ? infillRect : innerRectAaColored,
        borderColorInner,
        data.borderColor,
        false
      );
      if (!blendOn) {
        // AA on the ring's inner edge: feathers into border_color_blend
        // (bg_color when draw_center, else alpha-0 border_color).
        drawRoundedRectangle(
          buffers,
          borderStyleRect,
          adaptedCorner,
          data.cornerDetail,
          data.skew,
          innerRectAaColored,
          innerRectAaTransparent,
          borderColorBlend,
          data.borderColor,
          false
        );
      }
      // AA on the ring's outer edge: feathers to alpha-0 border_color, extending
      // aa_size/2 past style_rect.
      drawRoundedRectangle(
        buffers,
        borderStyleRect,
        adaptedCorner,
        data.cornerDetail,
        data.skew,
        outerRectAaTransparent,
        outerRectAaColored,
        data.borderColor,
        borderColorAlpha,
        false
      );
    }
  }

  return buffers;
}
