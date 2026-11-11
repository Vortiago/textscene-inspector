/**
 * The layout of `shape_container`, the picker's shape row: an `HBoxContainer` with
 * `ALIGNMENT_CENTER` (`scene/gui/color_picker.cpp:2077-2079`) that holds the controls of the
 * current `picker_shape` (`scene/gui/color_picker_shape.cpp`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../../godot/math/rect2';
import { ContainerAlignment } from '../../../../../godot/scene/container';
import { SizeFlags } from '../../../../../godot/scene/control';
import type { NativeTheme } from '../../../../../r3f/controls/native/nativeTheme';
import { resortBoxContainer, type BoxChildInput } from '../../shared/boxContainerSolver';

/** `sv_width` and `sv_height` (`default_theme.cpp:1077-1078`), at scale 1. */
const SV_SIZE = 256;
/** `h_width` (`default_theme.cpp:1079`), at scale 1. */
const SLIDER_WIDTH = 30;

/** The row of a picker that draws a shape: `sv_height` tall. */
export function shapeRowHeight(theme: Pick<NativeTheme, 'scale'>): number {
  return Math.round(SV_SIZE * theme.scale);
}

/** The controls a shape puts in `shape_container`, as its `_initialize_controls` adds them. */
export interface ShapeRowLayout {
  /** Every shape but the wheel adds a slider beside its area. */
  hasSlider: boolean;
  /** `SIZE_EXPAND_FILL` on the area, so it takes what the slider leaves. */
  areaExpands: boolean;
}

/** A rectangle's area is `SIZE_EXPAND_FILL` (`color_picker_shape.cpp:438`, `:475`). */
export const RECTANGLE_LAYOUT: ShapeRowLayout = { hasSlider: true, areaExpands: true };
/** A circle keeps its `sv_width` beside its slider (`color_picker_shape.cpp:875-907`). */
export const CIRCLE_LAYOUT: ShapeRowLayout = { hasSlider: true, areaExpands: false };
/** The wheel has no slider beside it (`color_picker_shape.cpp:809-830`). */
export const WHEEL_LAYOUT: ShapeRowLayout = { hasSlider: false, areaExpands: false };

/**
 * The children of `shape_container`, as each shape's `update_theme` sizes them: the area at
 * `sv_width × sv_height`, then the value slider at `h_width`.
 */
function shapeRowChildren(theme: Pick<NativeTheme, 'scale'>, layout: ShapeRowLayout): BoxChildInput[] {
  const area: BoxChildInput = {
    minSize: { x: Math.round(SV_SIZE * theme.scale), y: 0 },
    hSizeFlags: layout.areaExpands ? SizeFlags.FILL | SizeFlags.EXPAND : SizeFlags.FILL,
    vSizeFlags: SizeFlags.FILL,
    stretchRatio: 1,
  };
  if (!layout.hasSlider) return [area];
  const slider: BoxChildInput = {
    minSize: { x: Math.round(SLIDER_WIDTH * theme.scale), y: 0 },
    hSizeFlags: SizeFlags.FILL,
    vSizeFlags: SizeFlags.FILL,
    stretchRatio: 1,
  };
  return [area, slider];
}

/** The minimum width of `shape_container`: its children and the `separation` between them. */
export function shapeRowMinWidth(
  theme: Pick<NativeTheme, 'separation' | 'scale'>,
  layout: ShapeRowLayout
): number {
  const children = shapeRowChildren(theme, layout);
  const widths = children.reduce((sum, child) => sum + child.minSize.x, 0);
  return widths + Math.max(0, children.length - 1) * theme.separation;
}

export interface ShapeRowSplit {
  /** The control the shape fills: `sv_square`, `wheel`, `circle` or `rectangle_margin`. */
  area: Rect2;
  /** `hue_slider` or `value_slider`, `null` for the wheel. */
  slider: Rect2 | null;
}

/** Places a shape's controls in `row`, as `BoxContainer::_resort` does (`box_container.cpp:47-192`). */
export function shapeRowSplit(
  row: Rect2,
  theme: Pick<NativeTheme, 'separation' | 'scale'>,
  layout: ShapeRowLayout,
  rtl: boolean
): ShapeRowSplit {
  const [area, slider] = resortBoxContainer(
    false,
    { width: row.w, height: row.h },
    theme.separation,
    ContainerAlignment.ALIGNMENT_CENTER,
    rtl,
    shapeRowChildren(theme, layout)
  ).map((r) => ({ ...r, x: row.x + r.x, y: row.y + r.y }));
  return { area: area!, slider: slider ?? null };
}
