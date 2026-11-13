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
import type { PickerTheme } from '../pickerChildTheme';
import { resortBoxContainer, type BoxChildInput } from '../../shared/boxContainerSolver';

/** The picker theme a shape row reads: its own sizes and the row's `separation`. */
type RowTheme = Pick<PickerTheme, 'separation' | 'sizes'>;

/** The row of a picker that draws a shape: `sv_height` tall. */
export function shapeRowHeight(theme: Pick<PickerTheme, 'sizes'>): number {
  return theme.sizes.svHeight;
}

/** The controls a shape puts in `shape_container`, as its `_initialize_controls` adds them. */
interface RowLayout {
  /** Every shape but the wheel adds a slider beside its area. */
  hasSlider: boolean;
  /** `SIZE_EXPAND_FILL` on the area, so it takes what the slider leaves. */
  areaExpands: boolean;
}

/** The layout of a shape with a slider beside its area. */
export interface SliderRowLayout extends RowLayout {
  hasSlider: true;
}

/** The layout of a shape that fills the row alone. */
export interface AreaRowLayout extends RowLayout {
  hasSlider: false;
}

export type ShapeRowLayout = SliderRowLayout | AreaRowLayout;

/** A rectangle's area is `SIZE_EXPAND_FILL` (`color_picker_shape.cpp:438`, `:475`). */
export const RECTANGLE_LAYOUT: SliderRowLayout = { hasSlider: true, areaExpands: true };
/** A circle keeps its `sv_width` beside its slider (`color_picker_shape.cpp:875-907`). */
export const CIRCLE_LAYOUT: SliderRowLayout = { hasSlider: true, areaExpands: false };
/** The wheel has no slider beside it (`color_picker_shape.cpp:809-830`). */
export const WHEEL_LAYOUT: AreaRowLayout = { hasSlider: false, areaExpands: false };

/**
 * The children of `shape_container`, as each shape's `update_theme` sizes them: the area at
 * `sv_width × sv_height`, then the value slider at `h_width`.
 */
function shapeRowChildren(theme: Pick<PickerTheme, 'sizes'>, layout: ShapeRowLayout): BoxChildInput[] {
  const area: BoxChildInput = {
    minSize: { x: theme.sizes.svWidth, y: 0 },
    hSizeFlags: layout.areaExpands ? SizeFlags.FILL | SizeFlags.EXPAND : SizeFlags.FILL,
    vSizeFlags: SizeFlags.FILL,
    stretchRatio: 1,
  };
  if (!layout.hasSlider) return [area];
  const slider: BoxChildInput = {
    minSize: { x: theme.sizes.hWidth, y: 0 },
    hSizeFlags: SizeFlags.FILL,
    vSizeFlags: SizeFlags.FILL,
    stretchRatio: 1,
  };
  return [area, slider];
}

/** The minimum width of `shape_container`: its children and the `separation` between them. */
export function shapeRowMinWidth(theme: RowTheme, layout: ShapeRowLayout): number {
  const children = shapeRowChildren(theme, layout);
  const widths = children.reduce((sum, child) => sum + child.minSize.x, 0);
  return widths + Math.max(0, children.length - 1) * theme.separation;
}

/** The rects of a shape's controls. A layout with a slider gets a slider rect, so no reader checks for one. */
export interface ShapeRowSplit<L extends ShapeRowLayout = ShapeRowLayout> {
  /** The control the shape fills: `sv_square`, `wheel`, `circle` or `rectangle_margin`. */
  area: Rect2;
  /** `hue_slider` or `value_slider`, `null` for the wheel. */
  slider: L extends SliderRowLayout ? Rect2 : null;
}

/** Places a shape's controls in `row`, as `BoxContainer::_resort` does (`box_container.cpp:47-192`). */
export function shapeRowSplit<L extends ShapeRowLayout>(
  row: Rect2,
  theme: RowTheme,
  layout: L,
  rtl: boolean
): ShapeRowSplit<L> {
  const [area, slider] = resortBoxContainer(
    false,
    { width: row.w, height: row.h },
    theme.separation,
    ContainerAlignment.ALIGNMENT_CENTER,
    rtl,
    shapeRowChildren(theme, layout)
  ).map((r) => ({ ...r, x: row.x + r.x, y: row.y + r.y }));
  // `shapeRowChildren` adds the slider child exactly when `layout.hasSlider` is true.
  return { area: area!, slider: (slider ?? null) as ShapeRowSplit<L>['slider'] };
}
