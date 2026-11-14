/**
 * The toolbar a GraphEdit's constructor builds (`scene/gui/graph_edit.cpp:3229-3321`): `menu_panel`, a
 * PanelContainer that holds `menu_hbox` with the zoom label, the FlatButtons and the snapping SpinBox,
 * as the spec of one internal Control. `NOTIFICATION_THEME_CHANGED` (`:825-838`) gives the Buttons their
 * icons and the panel its box. The one solve lays the row out and the walker draws it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { parsedSceneLines, shownIf } from '../../../../r3f/controls/native/sceneLines';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import type { Vector2 } from '../../../../godot/math/vector';
import { SizeFlags } from '../../../../godot/scene/control';
import type { CanvasSlot } from '../../../../r3f/canvasItemState';
import { canvasSubOrders } from '../../../../r3f/canvasItemState';
import {
  builtButtonIconRequests,
  type InternalControlSpec,
  type InternalControlsFn,
  type InternalLayoutFn,
} from '../../../../r3f/controls/native/internalControls';
import { mirrorX } from '../../../../r3f/controls/native/controlRectSolver';
import { themedIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { themedSlotRequests, type TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { GRAPH_EDIT_ICON_SIZE, GRAPH_EDIT_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { isMinimapEnabled } from './minimap';
import type { GraphEditProperties } from './types';

/**
 * The pieces of `top_layer`, an `INTERNAL_MODE_BACK` child drawn after every GraphElement
 * (`graph_edit.cpp:3183`), in its child order (`:3211-3329`). The toolbar is `menu_panel`.
 */
const GRAPH_EDIT_TOP_LAYER = ['scrollBars', 'toolbar', 'minimap'] as const;

/** The slots of the bars, the toolbar and the minimap inside the GraphEdit's back slot. */
export const graphEditTopLayerSlots = (backSlot: CanvasSlot) =>
  canvasSubOrders(backSlot, GRAPH_EDIT_TOP_LAYER);

/** `menu_panel->set_position(Vector2(10, 10))` (`:3232`): unscaled. */
const MENU_POSITION: Vector2 = { x: 10, y: 10 };

/** `zoom_label->set_custom_minimum_size(Size2(48, 0) * theme_cache.base_scale)` (`:835`). */
const ZOOM_LABEL_MIN_WIDTH = 48;

/** `GRID_MIN_SNAPPING_DISTANCE` and `GRID_MAX_SNAPPING_DISTANCE` (`graph_edit.cpp:57-58`). */
const SNAPPING_RANGE = { minValue: 2, maxValue: 100, step: 1 };

/** The GraphEdit theme icon each toolbar Button shows (`:826-832`), with the vendored icon it stands in for. */
const BUTTON_ICON_URLS = {
  zoom_out: GRAPH_EDIT_ICONS.zoomOut,
  zoom_reset: GRAPH_EDIT_ICONS.zoomReset,
  zoom_in: GRAPH_EDIT_ICONS.zoomIn,
  grid_toggle: GRAPH_EDIT_ICONS.gridToggle,
  snapping_toggle: GRAPH_EDIT_ICONS.snappingToggle,
  minimap_toggle: GRAPH_EDIT_ICONS.minimapToggle,
  layout: GRAPH_EDIT_ICONS.layout,
} as const;

type ButtonIconName = keyof typeof BUTTON_ICON_URLS;

const TOOLBAR_ICON_SIZE: Vector2 = { x: GRAPH_EDIT_ICON_SIZE, y: GRAPH_EDIT_ICON_SIZE };

/** A Control the constructor builds: its type, its name, the scene lines it sets and what it holds. */
interface Widget {
  type: string;
  name: string;
  raw?: Record<string, string>;
  properties?: object;
  variation?: string;
  icon?: ButtonIconName;
  pushed?: InternalControlSpec['pushed'];
  children?: readonly Widget[];
}

/** `GraphEdit::_update_zoom_label` (`graph_edit.cpp:2620-2624`). */
function zoomLabelText(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** One toolbar Button: `set_theme_type_variation(FlatButton)` and its theme icon (`:3247-3321`). */
function flatButton(
  name: string,
  icon: ButtonIconName,
  isShown: boolean,
  state: { toggles?: boolean; isPressed?: boolean; isDisabled?: boolean } = {}
): Widget {
  return {
    type: 'Button',
    name,
    variation: 'FlatButton',
    icon,
    raw: {
      ...shownIf(isShown),
      ...(state.toggles && { toggle_mode: 'true' }),
      ...(state.isPressed && { button_pressed: 'true' }),
      ...(state.isDisabled && { disabled: 'true' }),
    },
  };
}

function zoomLabel(props: GraphEditProperties, scale: number): Widget {
  return {
    type: 'Label',
    name: 'zoom_label',
    raw: {
      ...shownIf(props.showZoomLabel === true),
      text: `"${zoomLabelText(props.zoom ?? 1)}"`,
      size_flags_vertical: String(SizeFlags.SHRINK_CENTER),
      horizontal_alignment: String(HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER),
      custom_minimum_size: `Vector2(${ZOOM_LABEL_MIN_WIDTH * scale}, 0)`,
    },
  };
}

/** `menu_hbox`'s children in their child order (`:3239-3321`), as the GraphEdit's properties set them. */
function menuRow(props: GraphEditProperties, scale: number): Widget[] {
  const showsZoom = props.showZoomButtons !== false;
  const showsGrid = props.showGridButtons !== false;
  return [
    zoomLabel(props, scale),
    flatButton('zoom_minus_button', 'zoom_out', showsZoom, { isDisabled: props.zoomMinusDisabled === true }),
    flatButton('zoom_reset_button', 'zoom_reset', showsZoom),
    flatButton('zoom_plus_button', 'zoom_in', showsZoom, { isDisabled: props.zoomPlusDisabled === true }),
    flatButton('toggle_grid_button', 'grid_toggle', showsGrid, {
      toggles: true,
      isPressed: props.showGrid !== false,
    }),
    flatButton('toggle_snapping_button', 'snapping_toggle', showsGrid, {
      toggles: true,
      isPressed: props.snappingEnabled !== false,
    }),
    {
      type: 'SpinBox',
      name: 'snapping_distance_spinbox',
      raw: shownIf(showsGrid),
      properties: { ...SNAPPING_RANGE, value: props.snappingDistance ?? 20 },
    },
    flatButton('minimap_button', 'minimap_toggle', props.showMinimapButton !== false, {
      toggles: true,
      isPressed: isMinimapEnabled(props),
    }),
    flatButton('arrange_button', 'layout', props.showArrangeButton !== false),
  ];
}

function build(graph: SolveNode, scale: number, spec: Widget): InternalControlSpec {
  const { icon } = spec;
  const themedIcon = icon && graph.icons[icon];
  return {
    type: spec.type,
    name: spec.name,
    properties: {
      ...parsedSceneLines(spec.type, spec.name, spec.raw),
      ...spec.properties,
      ...(spec.variation && { themeTypeVariation: spec.variation }),
      ...(icon && { themeIcon: { name: icon, vendoredUrl: BUTTON_ICON_URLS[icon] } }),
    },
    children: (spec.children ?? []).map((child) => build(graph, scale, child)),
    variation: spec.variation,
    icons: themedIcon ? { [icon]: themedIcon } : undefined,
    textureSize: icon && themedIconSize(graph.textureSlots, icon, TOOLBAR_ICON_SIZE, scale),
    pushed: spec.pushed,
  };
}

/** `menu_panel` (`:3229-3235`), added to `top_layer`, an `INTERNAL_MODE_BACK` child (`:3183`). */
export const graphEditInternalControls: InternalControlsFn = (graph, theme) => {
  const props = graph.node.properties as GraphEditProperties;
  const menuPanel: Widget = {
    type: 'PanelContainer',
    name: 'menu_panel',
    raw: shownIf(props.showMenu !== false),
    pushed: { styleBoxes: { panel: requiredThemeItem(graph.styleBoxes, 'menu_panel') } },
    children: [{ type: 'HBoxContainer', name: 'menu_hbox', children: menuRow(props, theme.scale) }],
  };
  return [{ mode: 'back', spec: build(graph, theme.scale, menuPanel) }];
};

/**
 * `menu_panel` sits at `(10, 10)` of `top_layer`, which spans the GraphEdit, at its combined minimum
 * size. The constructor sets the position before the panel has a layout direction, so a right-to-left
 * layout mirrors it (`Control::_size_changed`, `control.cpp:1785-1787`).
 */
export const graphEditInternalLayout: InternalLayoutFn = (graph, internals, rect, ctx) =>
  new Map(
    internals.map(({ node }) => {
      const size = ctx.combinedMinimumSize(node);
      const x = graph.rtl ? mirrorX(MENU_POSITION.x, size.x, rect.w) : MENU_POSITION.x;
      return [node.path, { x, y: MENU_POSITION.y, w: size.x, h: size.y }];
    })
  );

/** One slot for each toolbar icon a Theme gives the GraphEdit, then the slots of the Buttons it builds without one. */
export const graphEditTextureSlots: TextureSlotsFn = (_node, themedIcons = {}, builtIcons) => [
  ...themedSlotRequests(Object.keys(BUTTON_ICON_URLS), themedIcons),
  ...builtButtonIconRequests(['Button'], builtIcons),
];
