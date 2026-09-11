/**
 * GraphNode's native (WebGL canvas) rect solve — `GraphNode::_resort`,
 * `GraphNode::get_minimum_size` (`scene/gui/graph_node.cpp:153-293,977-1008`),
 * `scene/gui/container.cpp` (`Container::fit_child_in_rect`) and this node's
 * own titlebar band (`../graphelement/graphTitlebar.ts`).
 *
 * Two DIFFERENT per-child index spaces, ported exactly as the source keeps
 * them separate:
 *
 *  - `get_minimum_size` (`:993`) gates the slot-stylebox floor behind
 *    `slot_table.has(i)` — an UNDECLARED slot contributes NOTHING.
 *  - `_resort` (`:183,278-279`) reads `slot_table[i]` through `HashMap`'s
 *    `operator[]`, which AUTO-VIVIFIES a class-default `Slot()`
 *    (`draw_stylebox = true`) for a missing key — so an undeclared slot's
 *    child STILL gets the `sb_slot` margin/floor added during layout, and
 *    (by the time `NOTIFICATION_DRAW` iterates `slot_table`'s own keys) an
 *    otherwise-invisible `sb_slot` box drawn at its row once a scene supplies
 *    a real `theme_override_styles/slot`.
 *
 * Both loops index by the RAW child position (`i`, 0-based among ALL
 * `get_child_count(false)` children, hidden ones included in the count) —
 * never a "visible children so far" counter — matching `graph_node.cpp`
 * literally: `if (i > 0) minsize.height += separation;` fires on the raw
 * index, so a HIDDEN leading child still costs its sibling one `separation`.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlColor } from '../control/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { DEFAULT_CONTENT_MARGIN } from '../../../../r3f/controls/godotDefaultTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { SIZE_EXPAND, SIZE_FILL, fitChildInRect, hasFlag, isSortableControl } from '../shared/fitChildInRect';
import { resolveTitleFontTheme, titleTextMinimumSize, titlebarGeometry } from '../graphelement/graphTitlebar';
import { defaultGraphNodeSlot } from './parser';
import type { GraphNodeProperties, GraphNodeSlot } from './types';

const DEFAULT_SIZE_FLAGS = SIZE_FILL;
const ZERO_MARGIN = { left: 0, top: 0, right: 0, bottom: 0 };

/** `graph_node.cpp` theme type variation for its internal title Label — `graph_node.cpp:1328`. */
export const GRAPH_NODE_TITLE_VARIATION = 'GraphNodeTitleLabel';

/** `control_font_color` — `default_theme.cpp:819`, `GraphNodeTitleLabel`'s own `font_color`. */
export const GRAPH_NODE_TITLE_DEFAULT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `Color::lightened` (`core/math/color.cpp`): moves each channel toward white by `amount`. */
function lightened(c: ControlColor, amount: number): ControlColor {
  return { r: c.r + (1 - c.r) * amount, g: c.g + (1 - c.g) * amount, b: c.b + (1 - c.b) * amount, a: c.a };
}

function flatBox(
  bgColor: ControlColor,
  margin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: number
): StyleBoxFlatData {
  return {
    bgColor,
    borderColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
    borderWidth: ZERO_MARGIN,
    cornerRadius: { topLeft: cornerRadius, topRight: cornerRadius, bottomRight: cornerRadius, bottomLeft: cornerRadius },
    expandMargin: ZERO_MARGIN,
    contentMargin: margin,
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
 * GraphNode's default-theme StyleBoxes — `default_theme.cpp:788-802`. Not in
 * `nativeTheme.ts`'s `widgets` (no entry for GraphNode there); derived here
 * from `theme.styleFill`/`theme.cornerRadius`/`theme.contentMargin` the same
 * way `nativeTheme.ts` itself builds every other widget's.
 */
function defaultStyles(theme: NativeTheme) {
  // `make_flat_stylebox(style_normal_color, 18, 12, 18, 12)` — margins its
  // OWN literals, not `default_margin` (4), so each needs its own scale.
  // `NativeTheme` carries no raw `default_theme_scale` (only pre-scaled
  // products, `godotDefaultTheme.ts`'s own doc) — recovered here from
  // `theme.contentMargin`, itself `Math.round(DEFAULT_CONTENT_MARGIN * scale)`,
  // exact at any scale that keeps that rounding lossless (every scale this
  // previewer's own UI exposes, `gui/theme/default_theme_scale`'s [0.5, 8]
  // clamp at typical increments).
  const scale = theme.contentMargin / DEFAULT_CONTENT_MARGIN;
  const panelMargin = {
    left: Math.round(18 * scale),
    top: Math.round(12 * scale),
    right: Math.round(18 * scale),
    bottom: Math.round(12 * scale),
  };
  const panel = flatBox(theme.styleFill.normal, panelMargin, theme.cornerRadius);
  // `graphn_sb_titlebar_selected = graphnode_normal->duplicate()` then
  // `set_bg_color(...)` — clones the PANEL's own margins, not the titlebar's.
  const titlebarSelected = flatBox({ r: 1.0, g: 0.625, b: 0.625, a: 0.6 }, panelMargin, theme.cornerRadius);
  const titlebar = flatBox(lightened(theme.styleFill.normal, 0.3), {
    left: theme.contentMargin,
    top: theme.contentMargin,
    right: theme.contentMargin,
    bottom: theme.contentMargin,
  }, theme.cornerRadius);
  // `make_empty_stylebox(0, 0, 0, 0)` — draws nothing, zero margin.
  const slot = flatBox({ r: 0, g: 0, b: 0, a: 0 }, ZERO_MARGIN, 0);
  return { panel, panelSelected: panel, titlebar, titlebarSelected, slot };
}

export function graphNodeStyles(n: SolveNode, theme: NativeTheme) {
  const d = defaultStyles(theme);
  return {
    panel: n.styleBoxes.panel ?? d.panel,
    panelSelected: n.styleBoxes.panel_selected ?? d.panelSelected,
    titlebar: n.styleBoxes.titlebar ?? d.titlebar,
    titlebarSelected: n.styleBoxes.titlebar_selected ?? d.titlebarSelected,
    slot: n.styleBoxes.slot ?? d.slot,
  };
}

/** `theme_override_constants/separation`, else `Math.round(2 * scale)` (`default_theme.cpp`, GraphNode's own `separation`) — scale recovered as `defaultStyles`'s own doc explains. */
function separationOf(n: SolveNode, theme: NativeTheme): number {
  const override = (n.node.properties as GraphNodeProperties).themeOverrideConstants?.separation;
  if (override !== undefined) return override;
  const scale = theme.contentMargin / DEFAULT_CONTENT_MARGIN;
  return Math.round(2 * scale);
}

function hFlagsOf(n: SolveNode): number {
  return (n.node.properties as GraphNodeProperties).sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
}
function vFlagsOf(n: SolveNode): number {
  return (n.node.properties as GraphNodeProperties).sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
}
function stretchRatioOf(n: SolveNode): number {
  return (n.node.properties as GraphNodeProperties).sizeFlagsStretchRatio ?? 1;
}

/** `_get_minimum_size`'s own gate: a slot only floors the row when it is DECLARED (`.has(i)`, `graph_node.cpp:993`) — no auto-vivify here. */
function declaredSlot(slots: Map<number, GraphNodeSlot>, rawIndex: number): GraphNodeSlot | undefined {
  return slots.get(rawIndex);
}

/** `_resort`/`NOTIFICATION_DRAW`'s own gate: `operator[]` auto-vivifies a class-default `Slot()` for an undeclared index. */
export function graphNodeEffectiveSlot(slots: Map<number, GraphNodeSlot>, rawIndex: number): GraphNodeSlot {
  return slots.get(rawIndex) ?? defaultGraphNodeSlot();
}

export function graphNodeTitleTextMin(n: SolveNode, theme: NativeTheme): Vec2 {
  const props = n.node.properties as GraphNodeProperties;
  const fontTheme = resolveTitleFontTheme(n, GRAPH_NODE_TITLE_VARIATION, theme.fontSize, GRAPH_NODE_TITLE_DEFAULT_COLOR);
  return titleTextMinimumSize(props.title ?? '', fontTheme);
}

// --- get_minimum_size ---------------------------------------------------------

export const graphNodeMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as GraphNodeProperties;
  const { panel, titlebar, slot } = graphNodeStyles(n, ctx.theme);
  const textMin = graphNodeTitleTextMin(n, ctx.theme);

  let width = textMin.x + titlebar.contentMargin.left + titlebar.contentMargin.right;
  let height = textMin.y + titlebar.contentMargin.top + titlebar.contentMargin.bottom;

  n.children.forEach((child, i) => {
    if (!isSortableControl(child)) return;
    const cms = ctx.combinedMinimumSize(child);
    let w = cms.x + panel.contentMargin.left + panel.contentMargin.right;
    let h = cms.y;
    const declared = declaredSlot(props.slots, i);
    if (declared?.drawStylebox) {
      w += slot.contentMargin.left + slot.contentMargin.right;
      h += slot.contentMargin.top + slot.contentMargin.bottom;
    }
    height += h;
    width = Math.max(width, w);
    if (i > 0) height += separationOf(n, ctx.theme);
  });

  height += panel.contentMargin.top + panel.contentMargin.bottom;
  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('GraphNode', graphNodeMinimumSize);

// --- _resort -------------------------------------------------------------------

interface StretchEntry {
  rawIndex: number;
  path: string;
  minHeight: number;
  willStretch: boolean;
  finalSize: number;
  stretchRatio: number;
  hFlags: number;
  vFlags: number;
  minSize: Vec2;
}

export const graphNodeLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const props = n.node.properties as GraphNodeProperties;
  const { panel, titlebar, slot } = graphNodeStyles(n, ctx.theme);
  const separation = separationOf(n, ctx.theme);
  const textMin = graphNodeTitleTextMin(n, ctx.theme);
  const titlebarBand = titlebarGeometry(contentRect.w, textMin.y, titlebar);
  const titlebarBandHeight = titlebarBand.rect.h;

  const entries: StretchEntry[] = [];
  let stretchMin = 0;
  let availableStretch = 0;
  let stretchRatioTotal = 0;

  children.forEach(({ node: child, minSize }, i) => {
    if (!isSortableControl(child)) return;
    const eff = graphNodeEffectiveSlot(props.slots, i);
    const extra = eff.drawStylebox ? slot.contentMargin.top + slot.contentMargin.bottom : 0;
    const minHeight = minSize.y + extra;
    stretchMin += minHeight;
    const willStretch = hasFlag(vFlagsOf(child), SIZE_EXPAND);
    const stretchRatio = stretchRatioOf(child);
    if (willStretch) {
      availableStretch += minHeight;
      stretchRatioTotal += stretchRatio;
    }
    entries.push({
      rawIndex: i,
      path: child.path,
      minHeight,
      willStretch,
      finalSize: minHeight,
      stretchRatio,
      hFlags: hFlagsOf(child),
      vFlags: vFlagsOf(child),
      minSize,
    });
  });

  const childrenCount = entries.length;
  const stretchMax = contentRect.h - (childrenCount - 1) * separation;
  const stretchDiff = Math.max(stretchMax - stretchMin, 0);
  availableStretch += stretchDiff - panel.contentMargin.bottom - panel.contentMargin.top - titlebarBandHeight;

  while (stretchRatioTotal > 0) {
    let refitSuccessful = true;
    for (const entry of entries) {
      if (!entry.willStretch) continue;
      const finalPixelSize = Math.trunc((availableStretch * entry.stretchRatio) / stretchRatioTotal);
      if (finalPixelSize < entry.minHeight) {
        entry.willStretch = false;
        stretchRatioTotal -= entry.stretchRatio;
        refitSuccessful = false;
        availableStretch -= entry.minHeight;
        entry.finalSize = entry.minHeight;
        break;
      }
      entry.finalSize = finalPixelSize;
    }
    if (refitSuccessful) break;
  }

  let ofsY = panel.contentMargin.top + titlebarBandHeight;
  const width = contentRect.w - panel.contentMargin.left - panel.contentMargin.right;
  const rects = new Map<string, Rect2>();

  entries.forEach((entry, validIdx) => {
    if (validIdx > 0) ofsY += separation;
    const fromY = ofsY;
    let toY = ofsY + entry.finalSize;
    if (entry.willStretch && validIdx === childrenCount - 1) {
      toY = contentRect.h - panel.contentMargin.bottom;
    }
    const height = toY - fromY;
    const eff = graphNodeEffectiveSlot(props.slots, entry.rawIndex);
    const margin = panel.contentMargin.left + (eff.drawStylebox ? slot.contentMargin.left : 0);
    const finalWidth = width - (eff.drawStylebox ? slot.contentMargin.left + slot.contentMargin.right : 0);
    const rawRect: Rect2 = { x: margin, y: fromY, w: finalWidth, h: height };
    rects.set(entry.path, fitChildInRect(rawRect, entry.minSize, entry.hFlags, entry.vFlags));
    ofsY = toY;
  });

  return rects;
};

controlSolverRegistry.registerContainerLayout('GraphNode', graphNodeLayout);

// --- Draw-time row geometry (NOTIFICATION_DRAW's port/slot-stylebox loop) -----

export interface GraphNodeDrawRow {
  rawIndex: number;
  slot: GraphNodeSlot;
  /** `slot_y_cache[slot_index]` — the row's vertical CENTER, Godot px. */
  slotY: number;
  /** `child_rect` for `draw_stylebox`, or `null` when no visible child sits at `rawIndex` (`graph_node.cpp:687-693`). */
  styleboxRect: Rect2 | null;
}

/**
 * `NOTIFICATION_DRAW`'s port/slot-stylebox loop (`graph_node.cpp:648-696`):
 * iterates `slot_table`'s keys (declared slots PLUS every VISIBLE child's
 * raw index, auto-vivified during `_resort` — this module's own doc), gated
 * by `slot_index < slot_y_cache.size()` (the COMPACTED visible-child count —
 * so a slot numbered past the last visible child draws nothing at all, ports
 * or stylebox alike). `slot_y_cache` itself is compacted-by-visibility, so a
 * hidden EARLIER child shifts every later slot's row up by one position —
 * ported exactly, not smoothed over.
 *
 * The stylebox rect does NOT read `slot_y_cache`: `get_child(slot_index,
 * false)` fetches the child AT THE RAW POSITION `slot_index` directly and
 * uses ITS OWN solved rect's `y`/height, only overriding `x`/width
 * (`graph_node.cpp:687-693`) — a second, independent read of the same
 * `childRects` this function is handed.
 */
export function graphNodeDrawRows(
  n: SolveNode,
  props: GraphNodeProperties,
  childRects: ReadonlyMap<string, Rect2>,
  panelContentMarginLeft: number,
  bodyContentWidth: number
): GraphNodeDrawRow[] {
  const visible = n.children.filter(isSortableControl);
  const yCenters = visible.map((child) => {
    const r = childRects.get(child.path);
    return r ? r.y + r.h / 2 : 0;
  });

  const keys = new Set<number>(props.slots.keys());
  n.children.forEach((child, i) => {
    if (isSortableControl(child)) keys.add(i);
  });

  const rows: GraphNodeDrawRow[] = [];
  for (const rawIndex of keys) {
    if (rawIndex < 0 || rawIndex >= yCenters.length) continue;
    const slot = graphNodeEffectiveSlot(props.slots, rawIndex);
    let styleboxRect: Rect2 | null = null;
    if (slot.drawStylebox) {
      const child = n.children[rawIndex];
      if (child && isSortableControl(child)) {
        const r = childRects.get(child.path);
        if (r) styleboxRect = { x: panelContentMarginLeft, y: r.y, w: bodyContentWidth, h: r.h };
      }
    }
    rows.push({ rawIndex, slot, slotY: yCenters[rawIndex]!, styleboxRect });
  }
  return rows;
}
