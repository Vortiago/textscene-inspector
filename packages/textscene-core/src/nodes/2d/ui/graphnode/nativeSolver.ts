/**
 * GraphNode's native (WebGL canvas) rect solve: `GraphNode::_resort` and `get_minimum_size`
 * (`scene/gui/graph_node.cpp:153-293,977-1008`), `Container::fit_child_in_rect` and the titlebar
 * band (`../graphelement/graphTitlebar.ts`). The two loops treat an undeclared slot differently:
 * see `declaredSlot` and `graphNodeEffectiveSlot`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { graphElementStyles } from '../graphelement/graphElementStyles';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type MinimumSizeFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { fitChildInRect, hasFlag, isSortableControl } from '../shared/fitChildInRect';
import { registerInternalControls } from '../../../../r3f/controls/native/internalControls';
import {
  GRAPH_NODE_TITLE_LABEL,
  titlebarBandHeightChannel,
  titlebarInternalControls,
  titlebarInternalLayout,
  titlebarMinimumSize,
  titlebarResortHeight,
} from '../graphelement/graphTitlebar';
import { defaultGraphNodeSlot } from './parser';
import type { GraphNodeProperties, GraphNodeSlot } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { DEFAULT_SIZE_FLAGS, SizeFlags } from '../../../../godot/scene/control';

export function graphNodeStyles(n: SolveNode) {
  return { ...graphElementStyles(n), slot: requiredThemeItem(n.styleBoxes, 'slot') };
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

/** `_get_minimum_size`'s own gate: a slot only floors the row when it is declared (`.has(i)`, `graph_node.cpp:993`): no auto-vivify here. */
function declaredSlot(slots: Map<number, GraphNodeSlot>, rawIndex: number): GraphNodeSlot | undefined {
  return slots.get(rawIndex);
}

/**
 * `_resort`/`NOTIFICATION_DRAW`'s own gate (`:183,278-279`): `operator[]` inserts a class-default
 * `Slot()` (`draw_stylebox = true`) for an undeclared index, so the child gets the `sb_slot` margin
 * and the draw pass boxes that slot under a real `theme_override_styles/slot`.
 */
function graphNodeEffectiveSlot(slots: Map<number, GraphNodeSlot>, rawIndex: number): GraphNodeSlot {
  return slots.get(rawIndex) ?? defaultGraphNodeSlot();
}

// --- get_minimum_size ---------------------------------------------------------

const graphNodeMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as GraphNodeProperties;
  const { panel, slot } = graphNodeStyles(n);
  const separation = requiredThemeItem(n.constants, 'separation');

  let { x: width, y: height } = titlebarMinimumSize(n, ctx);

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
    // `i` counts every child, hidden ones included, so the sibling of a hidden leading child
    // still pays one `separation`.
    if (i > 0) height += separation;
  });

  height += panel.contentMargin.top + panel.contentMargin.bottom;
  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('GraphNode', graphNodeMinimumSize);
registerInternalControls(
  'GraphNode',
  titlebarInternalControls(GRAPH_NODE_TITLE_LABEL),
  titlebarInternalLayout
);

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
  minSize: Vector2;
}

const graphNodeLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const props = n.node.properties as GraphNodeProperties;
  const { panel, slot } = graphNodeStyles(n);
  const separation = requiredThemeItem(n.constants, 'separation');
  const bandHeight = titlebarResortHeight(n, ctx);

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
    const willStretch = hasFlag(vFlagsOf(child), SizeFlags.EXPAND);
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
  availableStretch += stretchDiff - panel.contentMargin.bottom - panel.contentMargin.top - bandHeight;

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

  let ofsY = panel.contentMargin.top + bandHeight;
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
    // `graph_node.cpp` has no RTL branch; `fit_child_in_rect` reads the flag itself.
    rects.set(entry.path, fitChildInRect(rawRect, entry.minSize, entry.hFlags, entry.vFlags, n.rtl));
    ofsY = toY;
  });

  return { rects, meta: titlebarBandHeightChannel.seal(titlebarMinimumSize(n, ctx).y) };
};

controlSolverRegistry.registerContainerLayout('GraphNode', graphNodeLayout);

// --- Draw-time row geometry (NOTIFICATION_DRAW's port/slot-stylebox loop) -----

interface GraphNodeDrawRow {
  rawIndex: number;
  slot: GraphNodeSlot;
  /** `slot_y_cache[slot_index]`: the row's vertical centre in whole Godot px, since the cache is a `Vector<int>` (`graph_node.h:88`, `.cpp:283`). */
  slotY: number;
  /** `child_rect` for `draw_stylebox`, or `null` when no visible child sits at `rawIndex` (`graph_node.cpp:687-693`). */
  styleboxRect: Rect2 | null;
}

/** `port_h_offset` as the `int` Godot stores (`graph_node.cpp:1011`). */
export function portHOffsetOf(constants: Readonly<Record<string, number>>): number {
  return Math.trunc(requiredThemeItem(constants, 'port_h_offset'));
}

/** The x of a right port: `Point2i(get_size().x - port_h_offset, slot_y)` (`graph_node.cpp:666`, `:1050`) keeps whole pixels. */
export function rightPortX(width: number, portHOffset: number): number {
  return Math.trunc(width - portHOffset);
}

/**
 * `NOTIFICATION_DRAW`'s port/slot-stylebox loop (`graph_node.cpp:648-696`) over
 * `slot_table`'s keys: declared slots plus each visible child's raw index. It
 * stops at `slot_y_cache.size()`, the visible-child count, so a hidden earlier
 * child shifts each later row up one, and a slot past the last visible child draws nothing.
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
    return r ? Math.trunc(r.y + r.h / 2) : 0;
  });

  const keys = new Set<number>(props.slots.keys());
  n.children.forEach((child, i) => {
    if (isSortableControl(child)) keys.add(i);
  });

  const rows: GraphNodeDrawRow[] = [];
  // The stylebox rect skips `slot_y_cache`: `get_child(slot_index, false)` takes the
  // child at the raw position and keeps its solved y/height (`graph_node.cpp:687-693`).
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
