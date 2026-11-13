/**
 * The default theme's GraphEdit, GraphEditMinimap, GraphNode and GraphFrame (`scene/theme/default_theme.cpp:787-841`,
 * `:1287-1301`, `:1339-1350`). The title Label variations live in `label.ts`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../math/math.js';
import { CONTROL_FONT_COLOR, scaledPx, STYLE_FILL } from '../theme.js';
import { focusStyleBox } from './button.js';
import type { DefaultFlatStyleBox, DefaultThemeType, DefaultThemeTypes, Sides } from './defaultTheme.js';
import { allSides, makeEmptyStyleBox, makeFlatStyleBox, withBorder } from './styleBoxes.js';
import { typeItems, WHITE } from './typeItems.js';

/** The wide margins of the GraphNode and GraphFrame panels (`default_theme.cpp:789`, `:830`). */
const GRAPH_PANEL_MARGIN: Sides = { left: 18, top: 12, right: 18, bottom: 12 };

/** `style_normal_color.lightened(0.3)`: GraphNode's `titlebar` (`default_theme.cpp:794`). */
const lightened = ({ r, g, b, a }: Rgba, amount: number): Rgba => ({
  r: r + (1 - r) * amount,
  g: g + (1 - g) * amount,
  b: b + (1 - b) * amount,
  a,
});

const grey = (value: number, a: number): Rgba => ({ r: value, g: value, b: value, a });
const whiteAt = (a: number): Rgba => ({ r: 1, g: 1, b: 1, a });

/** Only the colour changes: `set_border_color` on a box whose border width stays as it is. */
const withBorderColor = (box: DefaultFlatStyleBox, color: Rgba) => withBorder(box, box.borderWidth, color);

function graphNode(scale: number): DefaultThemeType {
  const focus = focusStyleBox(scale);
  const normal = withBorderColor(
    makeFlatStyleBox(scale, STYLE_FILL.normal, { margin: GRAPH_PANEL_MARGIN }),
    grey(0.325, 0.6)
  );
  return typeItems({
    styles: {
      panel: normal,
      panel_selected: withBorderColor(normal, grey(0.625, 0.6)),
      panel_focus: focus,
      titlebar: makeFlatStyleBox(scale, lightened(STYLE_FILL.normal, 0.3)),
      // `graphn_sb_titlebar_selected` duplicates `graphnode_normal`, not the titlebar (`:795-796`).
      titlebar_selected: { ...normal, bgColor: { r: 1, g: 0.625, b: 0.625, a: 0.6 } },
      slot: makeEmptyStyleBox(scale, allSides(0)),
      slot_selected: focus,
    },
    colors: { resizer_color: CONTROL_FONT_COLOR },
    constants: { separation: scaledPx(2, scale), port_h_offset: 0 },
  });
}

/**
 * GraphFrame (`default_theme.cpp:830-841`). `set_expand_margin` takes a float, so `38 * scale` stays
 * unrounded, and `make_flat_stylebox` scales the border width of 2.
 */
function graphFrame(scale: number): DefaultThemeType {
  const flat = makeFlatStyleBox(scale, STYLE_FILL.pressed, { margin: GRAPH_PANEL_MARGIN, borderWidth: 2 });
  const panel = withBorderColor(
    { ...flat, expandMargin: { ...flat.expandMargin, top: 38 * scale } },
    STYLE_FILL.pressed
  );
  return typeItems({
    styles: {
      panel,
      panel_selected: withBorderColor(panel, STYLE_FILL.hover),
      titlebar: makeEmptyStyleBox(scale, allSides(4)),
      titlebar_selected: makeEmptyStyleBox(scale, allSides(4)),
    },
    colors: { resizer_color: CONTROL_FONT_COLOR },
  });
}

/** GraphEdit (`default_theme.cpp:1287-1301`, `:1339-1340`). The hotzone extents truncate: `set_constant` takes an `int`. */
function graphEdit(scale: number): DefaultThemeType {
  return typeItems({
    styles: {
      panel: makeFlatStyleBox(scale, STYLE_FILL.normal, { margin: { left: 4, top: 4, right: 4, bottom: 5 } }),
      panel_focus: focusStyleBox(scale),
      menu_panel: makeFlatStyleBox(scale, grey(0.24, 0.6), {
        margin: { left: 4, top: 2, right: 4, bottom: 2 },
      }),
    },
    colors: {
      grid_minor: whiteAt(0.05),
      grid_major: whiteAt(0.2),
      selection_fill: whiteAt(0.3),
      selection_stroke: whiteAt(0.8),
      activity: WHITE,
      connection_hover_tint_color: { r: 0, g: 0, b: 0, a: 0.3 },
      connection_valid_target_tint_color: whiteAt(0.4),
      connection_rim_color: STYLE_FILL.normal,
    },
    constants: {
      connection_hover_thickness: 0,
      port_hotzone_inner_extent: Math.trunc(22 * scale),
      port_hotzone_outer_extent: Math.trunc(26 * scale),
    },
  });
}

/** GraphEditMinimap (`default_theme.cpp:1342-1350`). The camera's `set_border_width_all(1)` is unscaled. */
function graphEditMinimap(scale: number): DefaultThemeType {
  const flush = allSides(0);
  const camera = withBorder(
    makeFlatStyleBox(scale, grey(0.65, 0.2), { margin: flush, cornerRadius: 0 }),
    allSides(1),
    grey(0.65, 0.45)
  );
  return typeItems({
    styles: {
      panel: makeFlatStyleBox(scale, grey(0.24, 1), { margin: flush }),
      camera,
      node: makeFlatStyleBox(scale, WHITE, { margin: flush, cornerRadius: 2 }),
    },
    colors: { resizer_color: whiteAt(0.85) },
  });
}

export function graphTypes(scale: number): DefaultThemeTypes {
  return {
    GraphEdit: graphEdit(scale),
    GraphEditMinimap: graphEditMinimap(scale),
    GraphNode: graphNode(scale),
    GraphFrame: graphFrame(scale),
  };
}
