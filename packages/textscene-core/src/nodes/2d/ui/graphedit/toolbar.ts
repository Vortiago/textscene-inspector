/**
 * GraphEdit's toolbar, the `menu_panel` and `menu_hbox` row its constructor builds
 * (`scene/gui/graph_edit.cpp:3229-3324`), so every GraphEdit carries one whatever the file says. Its
 * geometry is hardcoded: `set_position(Vector2(10, 10))` (`:3232`) and a minimum-size panel of nine
 * widgets. The scene decides only which widgets take part and which toggles read pressed (`:2812-2870`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { contentMarginSize, contentRect } from '../../../../r3f/controls/native/styleBoxFlat';
import { resolveToggleDrawState, type ToggleDrawState } from '../../../../r3f/controls/native/buttonBase';
import {
  boxContainerMinimumSize,
  resortBoxContainer,
  type BoxChildInput,
} from '../shared/boxContainerSolver';
import { lineEditStyleMinSize, lineEditTextMinimumWidth } from '../lineedit/nativeSolver';
import { spinBoxButtonsBlockWidth, SPIN_BOX_ARROW_ICON_SIZE } from '../spinbox/nativeSolver';
import { GRAPH_EDIT_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { isMinimapEnabled } from './minimap';
import type { GraphEditToolbarTheme } from './toolbarTheme';
import type { GraphEditProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { SizeFlags } from '../../../../godot/scene/control';

/** `menu_panel->set_position(Vector2(10, 10))` (`graph_edit.cpp:3232`): unscaled. */
const GRAPH_EDIT_MENU_POSITION: Vector2 = { x: 10, y: 10 };

/** `zoom_label->set_custom_minimum_size(Size2(48, 0) * base_scale)` (`graph_edit.cpp:836`). */
const ZOOM_LABEL_MIN_WIDTH = 48;

/** The rect the zoom label centres its text in: the whole width, and the height inside the box margins (`label.cpp:472-512,591-616`). */
export function zoomLabelTextRect(itemRect: Rect2, box: StyleBoxFlatData): Rect2 {
  const { y, h } = contentRect(itemRect, box);
  return { ...itemRect, y, h };
}

/** `GraphEdit::_update_zoom_label` (`graph_edit.cpp:2620-2624`). */
export function zoomLabelText(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** Every widget the row can hold, in `menu_hbox`'s own child order (`graph_edit.cpp:3239-3323`). */
type ToolbarItemId =
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
type ToolbarItemKind = 'label' | 'button' | 'spinBox';

export interface ToolbarItem {
  id: ToolbarItemId;
  kind: ToolbarItemKind;
  /** Relative to the toolbar panel's own origin: the content offset is already applied. */
  rect: Rect2;
  /** `BaseButton::is_pressed()`; always false for the two non-toggles and for every non-button. */
  pressed: boolean;
  /** `BaseButton::is_disabled()`. Only the two zoom-step buttons are ever disabled (`graph_edit.cpp:2445-2446`). */
  disabled: boolean;
}

export interface GraphEditToolbar {
  /** `menu_panel`'s rect in GraphEdit's own local space. */
  panelRect: Rect2;
  /** `menu_hbox`'s rect inside that panel: `PanelContainer::_notification(NOTIFICATION_SORT_CHILDREN)`. */
  contentRect: Rect2;
  items: ToolbarItem[];
}

/** The text measurements the row's minimum size depends on, at the toolbar's own font. */
export interface ToolbarTextMetrics {
  /** One shaped run's size: `TextParagraph::get_size` as every caller here consumes it. */
  measure: (text: string) => Vector2;
  /** `font->get_char_size('W', font_size).x` (`line_edit.cpp:2451`): one advance, not a ceiled run. */
  emSpaceWidthPx: number;
  /** `font->get_height(font_size)`: `Label`'s and `LineEdit`'s own minimum-height floor. */
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
 * One icon-only `FlatButton`'s minimum size: `Button::get_minimum_size_for_text_and_icon`
 * (`button.cpp:481-526`) with empty text, plus the margins of the box its draw state reads.
 */
function toolbarButtonMinSize(
  buttonBoxes: GraphEditToolbarTheme['buttonBoxes'],
  state: ToggleDrawState
): Vector2 {
  const margin = contentMarginSize(buttonBoxes[state]);
  return { x: margin.x + GRAPH_EDIT_ICON_SIZE, y: margin.y + GRAPH_EDIT_ICON_SIZE };
}

/**
 * `snapping_distance_spinbox`'s minimum size: `SpinBox::get_minimum_size`
 * (`spin_box.cpp:82-86`) over `LineEdit::get_minimum_size`
 * (`line_edit.cpp:2443-2477`).
 */
function toolbarSpinBoxMinSize(
  fieldBoxes: GraphEditToolbarTheme['fieldBoxes'],
  metrics: ToolbarTextMetrics
): Vector2 {
  const styleMin = lineEditStyleMinSize(fieldBoxes.normal, fieldBoxes.readOnly);
  return {
    x:
      styleMin.x +
      lineEditTextMinimumWidth(metrics.emSpaceWidthPx) +
      spinBoxButtonsBlockWidth(SPIN_BOX_ARROW_ICON_SIZE.x),
    y: styleMin.y + metrics.fontHeightPx,
  };
}

/** `zoom_label`'s minimum size: `Label::get_minimum_size` (`label.cpp:973-997`) over its `normal` box, floored by its own `custom_minimum_size`. */
function zoomLabelMinSize(
  labelBox: StyleBoxFlatData,
  theme: NativeTheme,
  metrics: ToolbarTextMetrics,
  zoom: number
): Vector2 {
  const text = metrics.measure(zoomLabelText(zoom));
  const margin = contentMarginSize(labelBox);
  return {
    x: Math.max(text.x + margin.x, ZOOM_LABEL_MIN_WIDTH * theme.scale),
    y: Math.max(text.y, metrics.fontHeightPx) + margin.y,
  };
}

interface ToolbarEntry {
  id: ToolbarItemId;
  kind: ToolbarItemKind;
  pressed: boolean;
  disabled: boolean;
  box: BoxChildInput;
}

/**
 * `GraphEdit`'s whole toolbar, or `null` when `show_menu` hides the panel
 * (`graph_edit.cpp:2812-2815`).
 */
export function graphEditToolbar(
  props: GraphEditProperties,
  theme: NativeTheme,
  items: GraphEditToolbarTheme,
  metrics: ToolbarTextMetrics
): GraphEditToolbar | null {
  if (props.showMenu === false) return null;

  const button = (id: ToolbarItemId, pressed: boolean, disabled = false): ToolbarEntry => ({
    id,
    kind: 'button',
    pressed,
    disabled,
    box: {
      minSize: toolbarButtonMinSize(items.buttonBoxes, resolveToggleDrawState(disabled, pressed)),
      hSizeFlags: SizeFlags.FILL,
      vSizeFlags: SizeFlags.FILL,
      stretchRatio: 1,
    },
  });

  const entries: ToolbarEntry[] = [];
  if (props.showZoomLabel === true) {
    entries.push({
      id: 'zoom_label',
      kind: 'label',
      pressed: false,
      disabled: false,
      box: {
        minSize: zoomLabelMinSize(items.labelBox, theme, metrics, props.zoom ?? 1),
        hSizeFlags: SizeFlags.FILL,
        vSizeFlags: SizeFlags.SHRINK_CENTER,
        stretchRatio: 1,
      },
    });
  }
  if (props.showZoomButtons !== false) {
    entries.push(
      button('zoom_minus', false, props.zoomMinusDisabled === true),
      button('zoom_reset', false),
      button('zoom_plus', false, props.zoomPlusDisabled === true)
    );
  }
  if (props.showGridButtons !== false) {
    entries.push(
      button('toggle_grid', props.showGrid !== false),
      button('toggle_snapping', props.snappingEnabled !== false)
    );
    entries.push({
      id: 'snapping_distance',
      kind: 'spinBox',
      pressed: false,
      disabled: false,
      box: {
        minSize: toolbarSpinBoxMinSize(items.fieldBoxes, metrics),
        hSizeFlags: SizeFlags.FILL,
        vSizeFlags: SizeFlags.FILL,
        stretchRatio: 1,
      },
    });
  }
  if (props.showMinimapButton !== false) entries.push(button('minimap', isMinimapEnabled(props)));
  if (props.showArrangeButton !== false) entries.push(button('arrange', false));

  const hboxMin = boxContainerMinimumSize(
    false,
    theme.separation,
    entries.map((e) => e.box.minSize)
  );
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
      disabled: e.disabled,
      rect: {
        x: contentRect.x + laid[i]!.x,
        y: contentRect.y + laid[i]!.y,
        w: laid[i]!.w,
        h: laid[i]!.h,
      },
    })),
  };
}
