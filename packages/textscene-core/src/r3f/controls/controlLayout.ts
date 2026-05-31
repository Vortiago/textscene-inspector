/**
 * Maps Godot Control layout properties to CSS (ADR-0003). Two regimes:
 *
 *  - **Container child** (parent is a VBox/HBox/Grid/… container): the parent
 *    lays the child out, so the child is a flex/grid item — `size_flags` drive
 *    flex-grow + align-self. This is the MAJORITY path in real Godot UIs
 *    (`layout_mode = 2`).
 *  - **Free / anchored** (top-level or `layout_mode` 0/1): the child is
 *    `position: absolute`, its rect derived from anchors (the full LayoutPreset
 *    0..15 table) + offsets.
 *
 * The overlay root is the size of the viewport region, so anchors resolve
 * against the panel — no global scale transform, which keeps text crisp.
 */

import type { CSSProperties } from 'react';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';

/**
 * The layout regime a container imposes on its direct Control children:
 *  - 'free'   → children are absolutely positioned from anchors/offsets
 *               (top-level overlay, plain Control, Panel, CanvasLayer).
 *  - 'row' / 'column' → flex item; size_flags drive grow + align-self.
 *  - 'grid'   → CSS grid item (GridContainer).
 *  - 'center' → centered single child (CenterContainer).
 *  - 'margin' → padded single child (MarginContainer).
 *  - 'block'  → in-flow block child at natural size (PanelContainer,
 *               ScrollContainer) — the container's own CSS does the work.
 * Every non-'free' kind yields `position: relative` children; only 'row'/
 * 'column' add flex sizing on top.
 */
export type ParentLayoutKind =
  | 'free'
  | 'row'
  | 'column'
  | 'grid'
  | 'center'
  | 'margin'
  | 'block';

/** Godot Control.LayoutPreset → [anchor_left, anchor_top, anchor_right, anchor_bottom]. */
const PRESET_ANCHORS: Record<number, [number, number, number, number]> = {
  0: [0, 0, 0, 0], // TOP_LEFT
  1: [1, 0, 1, 0], // TOP_RIGHT
  2: [0, 1, 0, 1], // BOTTOM_LEFT
  3: [1, 1, 1, 1], // BOTTOM_RIGHT
  4: [0, 0.5, 0, 0.5], // CENTER_LEFT
  5: [0.5, 0, 0.5, 0], // CENTER_TOP
  6: [1, 0.5, 1, 0.5], // CENTER_RIGHT
  7: [0.5, 1, 0.5, 1], // CENTER_BOTTOM
  8: [0.5, 0.5, 0.5, 0.5], // CENTER
  9: [0, 0, 0, 1], // LEFT_WIDE
  10: [0, 0, 1, 0], // TOP_WIDE
  11: [1, 0, 1, 1], // RIGHT_WIDE
  12: [0, 1, 1, 1], // BOTTOM_WIDE
  13: [0.5, 0, 0.5, 1], // VCENTER_WIDE
  14: [0, 0.5, 1, 0.5], // HCENTER_WIDE
  15: [0, 0, 1, 1], // FULL_RECT
};

// Godot SizeFlags bitmask.
const SIZE_FLAG_FILL = 1;
const SIZE_FLAG_EXPAND = 2;
const SIZE_FLAG_SHRINK_CENTER = 4;
const SIZE_FLAG_SHRINK_END = 8;

function resolveAnchors(p: ControlProperties): [number, number, number, number] {
  const hasExplicit =
    p.anchorLeft !== undefined ||
    p.anchorTop !== undefined ||
    p.anchorRight !== undefined ||
    p.anchorBottom !== undefined;
  if (hasExplicit) {
    return [p.anchorLeft ?? 0, p.anchorTop ?? 0, p.anchorRight ?? 0, p.anchorBottom ?? 0];
  }
  if (p.anchorsPreset !== undefined && PRESET_ANCHORS[p.anchorsPreset]) {
    return PRESET_ANCHORS[p.anchorsPreset]!;
  }
  return [0, 0, 0, 0];
}

/** Combine an anchor fraction (as %) and a px offset into the tersest CSS length. */
function edge(percent: number, offsetPx: number): string {
  if (percent === 0 && offsetPx === 0) return '0px';
  if (offsetPx === 0) return `${percent}%`;
  if (percent === 0) return `${offsetPx}px`;
  return `calc(${percent}% + ${offsetPx}px)`;
}

function anchorOffsetStyle(p: ControlProperties): CSSProperties {
  const [al, at, ar, ab] = resolveAnchors(p);
  const ol = p.offsetLeft ?? 0;
  const ot = p.offsetTop ?? 0;
  const or = p.offsetRight ?? 0;
  const ob = p.offsetBottom ?? 0;
  return {
    position: 'absolute',
    left: edge(al * 100, ol),
    top: edge(at * 100, ot),
    // Godot's right/bottom edge x = anchor*parent + offset; CSS right/bottom is
    // the distance from the parent's far edge → (1-anchor)*100% - offset.
    right: edge((1 - ar) * 100, -or),
    bottom: edge((1 - ab) * 100, -ob),
  };
}

function containerChildStyle(p: ControlProperties, parent: ParentLayoutKind): CSSProperties {
  const style: CSSProperties = { position: 'relative' };
  const rowMain = parent === 'row';
  const colMain = parent === 'column';

  if (rowMain || colMain) {
    const mainFlag = rowMain ? p.sizeFlagsHorizontal : p.sizeFlagsVertical;
    style.flexGrow = mainFlag !== undefined && (mainFlag & SIZE_FLAG_EXPAND) !== 0 ? 1 : 0;
    style.flexShrink = 0;

    const crossFlag = (rowMain ? p.sizeFlagsVertical : p.sizeFlagsHorizontal) ?? SIZE_FLAG_FILL;
    if ((crossFlag & SIZE_FLAG_SHRINK_END) !== 0) style.alignSelf = 'flex-end';
    else if ((crossFlag & SIZE_FLAG_SHRINK_CENTER) !== 0) style.alignSelf = 'center';
    else if ((crossFlag & SIZE_FLAG_FILL) !== 0) style.alignSelf = 'stretch';
  }
  return style;
}

/** Compute the outer CSS for a Control given the kind of layout its parent imposes. */
export function controlLayoutStyle(
  props: ControlProperties,
  parent: ParentLayoutKind
): CSSProperties {
  const style: CSSProperties =
    parent === 'free' ? anchorOffsetStyle(props) : containerChildStyle(props, parent);

  if (props.visible === false) style.display = 'none';
  if (props.customMinimumSize) {
    style.minWidth = `${props.customMinimumSize.x}px`;
    style.minHeight = `${props.customMinimumSize.y}px`;
  }
  return style;
}

export { PRESET_ANCHORS };
