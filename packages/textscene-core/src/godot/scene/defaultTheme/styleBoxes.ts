/**
 * The three StyleBox builders of `fill_default_theme` (`scene/theme/default_theme.cpp:57-90`). Each takes
 * the unscaled values of its call site and applies the rounding Godot applies.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { clamp, round, type Rgba } from '../../math/math.js';
import { DEFAULT_CONTENT_MARGIN, DEFAULT_CORNER_RADIUS } from '../theme.js';
import type { Corners, DefaultEmptyStyleBox, DefaultFlatStyleBox, Sides } from './defaultTheme.js';

/** `StyleBoxFlat::set_corner_detail` clamps to 1..20 (`style_box_flat.cpp:129-130`). */
export const CORNER_DETAIL_MIN = 1;
export const CORNER_DETAIL_MAX = 20;

/** `MIN(ceil(1.5 * radius), 6)` in `make_flat_stylebox`: a corner never needs more than six steps at scale 1. */
const MAX_UNSCALED_CORNER_DETAIL = 6;

/** `StyleBoxFlat`'s own `border_color` (`style_box_flat.h:40`), which `make_flat_stylebox` leaves alone. */
const FLAT_BORDER_COLOR: Rgba = { r: 0.8, g: 0.8, b: 0.8, a: 1 };

/** A `StyleBox`'s `content_margin` before it is set: -1, unset (`style_box.h:43`). */
const UNSET_MARGIN = -1;

/** Four sides of one value. */
export function allSides(value: number): Sides {
  return { left: value, top: value, right: value, bottom: value };
}

/** Four corners of one radius. */
function allCorners(radius: number): Corners {
  return { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
}

/** Each side times `scale`, rounded as `Math::round` rounds: a half away from zero. */
function scaledSides(sides: Sides, scale: number): Sides {
  return {
    left: round(sides.left * scale),
    top: round(sides.top * scale),
    right: round(sides.right * scale),
    bottom: round(sides.bottom * scale),
  };
}

/**
 * The `corner_detail` `make_flat_stylebox` sets (`default_theme.cpp:65`): `MIN(ceil(1.5 * radius), 6) *
 * scale`. `radius` is the radius before the theme scale. `set_corner_detail` takes an `int`, so the
 * product truncates, then clamps to 1..20 (`style_box_flat.cpp:129-130`).
 */
function flatCornerDetail(radius: number, scale: number): number {
  const detail = Math.trunc(Math.min(Math.ceil(1.5 * radius), MAX_UNSCALED_CORNER_DETAIL) * scale);
  return clamp(detail, CORNER_DETAIL_MIN, CORNER_DETAIL_MAX);
}

/** The arguments of `make_flat_stylebox` after its colour, unscaled, with Godot's defaults. */
export interface FlatStyleBoxArguments {
  /** `default_margin` on each side by default. */
  readonly margin?: Sides;
  /** `default_corner_radius` by default. */
  readonly cornerRadius?: number;
  /** `true` by default. */
  readonly drawCenter?: boolean;
  /** `0` by default. */
  readonly borderWidth?: number;
}

/** `make_flat_stylebox` (`default_theme.cpp:57-71`): every length scales and rounds, the colour never does. */
export function makeFlatStyleBox(
  scale: number,
  bgColor: Rgba,
  {
    margin = allSides(DEFAULT_CONTENT_MARGIN),
    cornerRadius = DEFAULT_CORNER_RADIUS,
    drawCenter = true,
    borderWidth = 0,
  }: FlatStyleBoxArguments = {}
): DefaultFlatStyleBox {
  return {
    kind: 'flat',
    bgColor,
    contentMargin: scaledSides(margin, scale),
    cornerRadius: allCorners(round(cornerRadius * scale)),
    cornerDetail: flatCornerDetail(cornerRadius, scale),
    borderWidth: allSides(round(borderWidth * scale)),
    borderColor: FLAT_BORDER_COLOR,
    expandMargin: allSides(0),
    drawCenter,
  };
}

/** `sb_expand` (`default_theme.cpp:73-79`) and `set_expand_margin_all(Math::round(n * scale))`: unscaled sides. */
export function withExpandMargin(
  box: DefaultFlatStyleBox,
  scale: number,
  expand: Sides
): DefaultFlatStyleBox {
  return { ...box, expandMargin: scaledSides(expand, scale) };
}

/** `set_corner_radius` on the named corners, unscaled as Godot sets them: `corner_detail` stays. */
export function withCornerRadius(box: DefaultFlatStyleBox, corners: Partial<Corners>): DefaultFlatStyleBox {
  return { ...box, cornerRadius: { ...box.cornerRadius, ...corners } };
}

/** `set_corner_radius_all` and `set_corner_detail`, already scaled at the call site, clamped as `set_corner_detail` clamps. */
export function withCornerRadiusAll(
  box: DefaultFlatStyleBox,
  radius: number,
  detail: number
): DefaultFlatStyleBox {
  return {
    ...box,
    cornerRadius: allCorners(radius),
    cornerDetail: clamp(detail, CORNER_DETAIL_MIN, CORNER_DETAIL_MAX),
  };
}

/** `set_border_color` alone: the border width stays as it is. */
export function withBorderColor(box: DefaultFlatStyleBox, color: Rgba): DefaultFlatStyleBox {
  return { ...box, borderColor: color };
}

/** `set_border_width` on each side, already scaled at the call site, and `set_border_color`. */
export function withBorder(box: DefaultFlatStyleBox, width: Sides, color: Rgba): DefaultFlatStyleBox {
  return { ...box, borderWidth: width, borderColor: color };
}

/** `make_empty_stylebox` (`default_theme.cpp:86-90`): unscaled margins, each -1 (unset) by default. */
export function makeEmptyStyleBox(
  scale: number,
  margin: Sides = allSides(UNSET_MARGIN)
): DefaultEmptyStyleBox {
  return { kind: 'empty', contentMargin: scaledSides(margin, scale) };
}

/** `memnew(StyleBoxEmpty)` with `set_content_margin_*` on scaled values: margins the call site already rounded. */
export function emptyStyleBox(contentMargin: Sides = allSides(UNSET_MARGIN)): DefaultEmptyStyleBox {
  return { kind: 'empty', contentMargin };
}
