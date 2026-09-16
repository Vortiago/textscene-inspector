/**
 * GraphEdit's toolbar — the `menu_panel`/`menu_hbox` row its own CONSTRUCTOR
 * builds (`scene/gui/graph_edit.cpp:3229-3324`), so every GraphEdit carries
 * one whatever the scene file says. Its geometry is described by nothing in
 * the file: a hardcoded `set_position(Vector2(10, 10))` (`:3232`), one
 * `PanelContainer` sized to its own minimum, and an `HBoxContainer` of nine
 * widgets. Only WHICH of the nine participate, and which toggles read
 * pressed, comes from the scene (`:2812-2870`).
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { boxContainerMinimumSize, resortBoxContainer, type BoxChildInput } from '../shared/boxContainerSolver';
import { SIZE_FILL, SIZE_SHRINK_CENTER } from '../shared/fitChildInRect';
import { LINE_EDIT_MINIMUM_CHARACTER_WIDTH } from '../../../../r3f/controls/godotDefaultTheme';
import { spinBoxButtonsBlockWidth, SPIN_BOX_ARROW_ICON_SIZE } from '../spinbox/nativeSolver';
import { GRAPH_EDIT_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { isMinimapEnabled } from './minimap';
import type { GraphEditProperties } from './types';

/** `menu_panel->set_position(Vector2(10, 10))` (`graph_edit.cpp:3232`) — unscaled. */
export const GRAPH_EDIT_MENU_POSITION: Vec2 = { x: 10, y: 10 };

/** `zoom_label->set_custom_minimum_size(Size2(48, 0) * base_scale)` (`graph_edit.cpp:836`). */
const ZOOM_LABEL_MIN_WIDTH = 48;

/** `GraphEdit::_update_zoom_label` (`graph_edit.cpp:2620-2624`). */
export function zoomLabelText(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** Every widget the row can hold, in `menu_hbox`'s own child order (`graph_edit.cpp:3239-3323`). */
export type ToolbarItemId =
  | 'zoom_label'
  | 'zoom_minus'
  | 'zoom_reset'
  | 'zoom_plus'
  | 'toggle_grid'
  | 'toggle_snapping'
  | 'snapping_distance'
  | 'minimap'
  | 'arrange';

/** What the painter has to draw for one item: a text run, an icon-on-a-box button, or the SpinBox composite. */
export type ToolbarItemKind = 'label' | 'button' | 'spinBox';

export interface ToolbarItem {
  id: ToolbarItemId;
  kind: ToolbarItemKind;
  /** Relative to the toolbar PANEL's own origin — the content offset is already applied. */
  rect: Rect2;
  /** `BaseButton::is_pressed()`; always false for the two non-toggles and for every non-button. */
  pressed: boolean;
}

export interface GraphEditToolbar {
  /** `menu_panel`'s rect in GraphEdit's own local space. */
  panelRect: Rect2;
  /** `menu_hbox`'s rect inside that panel — `PanelContainer::_notification(NOTIFICATION_SORT_CHILDREN)`. */
  contentRect: Rect2;
  items: ToolbarItem[];
}

/** The two text measurements the row's minimum size depends on, at the toolbar's own font. */
export interface ToolbarTextMetrics {
  /** One shaped run's size — `TextParagraph::get_size` as every caller here consumes it. */
  measure: (text: string) => Vec2;
  /** `font->get_height(font_size)` — `Label`'s and `LineEdit`'s own minimum-height floor. */
  fontHeightPx: number;
}

/**
 * `graph_toolbar_style` (`default_theme.cpp:1290-1291`):
 * `make_flat_stylebox(Color(0.24, 0.24, 0.24, 0.6), 4, 2, 4, 2)`.
 */
export function graphEditMenuPanelStyleBox(theme: NativeTheme): StyleBoxFlatData {
  const { scale } = theme;
  return {
    bgColor: { r: 0.24, g: 0.24, b: 0.24, a: 0.6 },
    borderColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: {
      topLeft: theme.cornerRadius,
      topRight: theme.cornerRadius,
      bottomRight: theme.cornerRadius,
      bottomLeft: theme.cornerRadius,
    },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin: {
      left: Math.round(4 * scale),
      top: Math.round(2 * scale),
      right: Math.round(4 * scale),
      bottom: Math.round(2 * scale),
    },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/**
 * One icon-only `FlatButton`'s minimum size —
 * `Button::get_minimum_size_for_text_and_icon` (`button.cpp:481-526`) with
 * empty text, plus `flat_button_normal`'s content margins, which
 * `default_theme.cpp:360-362` copies verbatim off `button_normal`.
 */
function toolbarButtonMinSize(theme: NativeTheme): Vec2 {
  const margin = 2 * theme.contentMargin;
  return { x: margin + GRAPH_EDIT_ICON_SIZE, y: margin + GRAPH_EDIT_ICON_SIZE };
}

/**
 * `snapping_distance_spinbox`'s minimum size — `SpinBox::get_minimum_size`
 * (`spin_box.cpp:82-86`) over `LineEdit::get_minimum_size`
 * (`line_edit.cpp:2443-2477`). The field is internal to the SpinBox, so no
 * per-node theme override can reach it and the plain theme boxes are the
 * whole input.
 */
function toolbarSpinBoxMinSize(theme: NativeTheme, metrics: ToolbarTextMetrics): Vec2 {
  const normal = contentMarginSize(theme.widgets.lineEdit.normal);
  const readOnly = contentMarginSize(theme.widgets.lineEdit.readOnly);
  const styleMin = { x: Math.max(normal.x, readOnly.x), y: Math.max(normal.y, readOnly.y) };
  const emWidth = metrics.measure('W').x;
  return {
    x: styleMin.x + LINE_EDIT_MINIMUM_CHARACTER_WIDTH * emWidth + spinBoxButtonsBlockWidth(SPIN_BOX_ARROW_ICON_SIZE.x),
    y: styleMin.y + metrics.fontHeightPx,
  };
}

/** `zoom_label`'s minimum size — `Label::get_minimum_size` (`label.cpp:973-997`) over an empty stylebox, floored by its own `custom_minimum_size`. */
function zoomLabelMinSize(theme: NativeTheme, metrics: ToolbarTextMetrics, zoom: number): Vec2 {
  const text = metrics.measure(zoomLabelText(zoom));
  return {
    x: Math.max(text.x, ZOOM_LABEL_MIN_WIDTH * theme.scale),
    y: Math.max(text.y, metrics.fontHeightPx),
  };
}

interface ToolbarEntry {
  id: ToolbarItemId;
  kind: ToolbarItemKind;
  pressed: boolean;
  box: BoxChildInput;
}

/**
 * `GraphEdit`'s whole toolbar, or `null` when `show_menu` hides the panel
 * (`graph_edit.cpp:2812-2815`).
 */
export function graphEditToolbar(
  props: GraphEditProperties,
  theme: NativeTheme,
  metrics: ToolbarTextMetrics
): GraphEditToolbar | null {
  if (props.showMenu === false) return null;

  const buttonMin = toolbarButtonMinSize(theme);
  const button = (id: ToolbarItemId, pressed: boolean): ToolbarEntry => ({
    id,
    kind: 'button',
    pressed,
    box: { minSize: buttonMin, hSizeFlags: SIZE_FILL, vSizeFlags: SIZE_FILL, stretchRatio: 1 },
  });

  const entries: ToolbarEntry[] = [];
  if (props.showZoomLabel === true) {
    entries.push({
      id: 'zoom_label',
      kind: 'label',
      pressed: false,
      box: {
        minSize: zoomLabelMinSize(theme, metrics, props.zoom ?? 1),
        hSizeFlags: SIZE_FILL,
        vSizeFlags: SIZE_SHRINK_CENTER,
        stretchRatio: 1,
      },
    });
  }
  if (props.showZoomButtons !== false) {
    entries.push(button('zoom_minus', false), button('zoom_reset', false), button('zoom_plus', false));
  }
  if (props.showGridButtons !== false) {
    entries.push(button('toggle_grid', props.showGrid !== false), button('toggle_snapping', props.snappingEnabled !== false));
    entries.push({
      id: 'snapping_distance',
      kind: 'spinBox',
      pressed: false,
      box: {
        minSize: toolbarSpinBoxMinSize(theme, metrics),
        hSizeFlags: SIZE_FILL,
        vSizeFlags: SIZE_FILL,
        stretchRatio: 1,
      },
    });
  }
  if (props.showMinimapButton !== false) entries.push(button('minimap', isMinimapEnabled(props)));
  if (props.showArrangeButton !== false) entries.push(button('arrange', false));

  const hboxMin = boxContainerMinimumSize(false, theme.separation, entries.map((e) => e.box.minSize));
  const panelStyle = graphEditMenuPanelStyleBox(theme);
  const panelMargin = contentMarginSize(panelStyle);
  const panelRect: Rect2 = {
    x: GRAPH_EDIT_MENU_POSITION.x,
    y: GRAPH_EDIT_MENU_POSITION.y,
    w: hboxMin.x + panelMargin.x,
    h: hboxMin.y + panelMargin.y,
  };
  const contentRect: Rect2 = {
    x: panelStyle.contentMargin.left,
    y: panelStyle.contentMargin.top,
    w: hboxMin.x,
    h: hboxMin.y,
  };

  // `BoxContainer::_resort`'s own ALIGNMENT_BEGIN default (`box_container.h`).
  const laid = resortBoxContainer(
    false,
    { width: contentRect.w, height: contentRect.h },
    theme.separation,
    0,
    false,
    entries.map((e) => e.box)
  );

  return {
    panelRect,
    contentRect,
    items: entries.map((e, i) => ({
      id: e.id,
      kind: e.kind,
      pressed: e.pressed,
      rect: {
        x: contentRect.x + laid[i]!.x,
        y: contentRect.y + laid[i]!.y,
        w: laid[i]!.w,
        h: laid[i]!.h,
      },
    })),
  };
}
