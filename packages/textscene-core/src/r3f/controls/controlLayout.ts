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
    // EXPAND children share the free space in proportion to their stretch ratio.
    style.flexGrow =
      mainFlag !== undefined && (mainFlag & SIZE_FLAG_EXPAND) !== 0
        ? (p.sizeFlagsStretchRatio ?? 1)
        : 0;
    style.flexShrink = 0;

    const crossFlag = (rowMain ? p.sizeFlagsVertical : p.sizeFlagsHorizontal) ?? SIZE_FLAG_FILL;
    // FILL SHORT-CIRCUITS. `Container::fit_child_in_rect` runs the shrink
    // branch inside `if (!flags.has_flag(SIZE_FILL))`, so a flag like 5
    // (FILL|SHRINK_CENTER) stretches — the shrink bit is never read.
    if ((crossFlag & SIZE_FLAG_FILL) !== 0) style.alignSelf = 'stretch';
    else if ((crossFlag & SIZE_FLAG_SHRINK_END) !== 0) style.alignSelf = 'flex-end';
    else if ((crossFlag & SIZE_FLAG_SHRINK_CENTER) !== 0) style.alignSelf = 'center';
    // No FILL/SHRINK bits (explicit 0): Godot shrinks the child to its content
    // at the begin edge — pin it so CSS flex doesn't stretch it by default.
    else style.alignSelf = 'flex-start';
  } else if (parent === 'margin') {
    // Godot's MarginContainer stretches its single child to fill the padded
    // box. The container renders as a flex column, so the child grows to fill
    // the height and stretches to fill the width; min:0 lets it fit (not
    // overflow). Without this the child sat at its natural content height and
    // inner EXPAND rows had no room to grow.
    style.flexGrow = 1;
    style.flexShrink = 1;
    style.minWidth = 0;
    style.minHeight = 0;
    style.alignSelf = 'stretch';
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
  applyModulate(style, props);
  applyTransform(style, props, parent);
  return style;
}

/**
 * `modulate` tints the node AND its CanvasItem children; `self_modulate` tints
 * only the node itself (class_canvasitem.html). CSS gives us the alpha exactly
 * — `opacity` already cascades to descendants the way `modulate` does — and the
 * RGB tint as a multiply filter. Both default to opaque white, so an absent
 * property adds nothing.
 */
function applyModulate(style: CSSProperties, p: ControlProperties): void {
  const alpha = (p.modulate?.a ?? 1) * (p.selfModulate?.a ?? 1);
  if (alpha < 1) style.opacity = alpha;

  const tints = [p.modulate, p.selfModulate].filter(
    (c): c is NonNullable<typeof c> => c !== undefined && (c.r !== 1 || c.g !== 1 || c.b !== 1)
  );
  if (tints.length === 0) return;
  const r = tints.reduce((acc, c) => acc * c.r, 1);
  const g = tints.reduce((acc, c) => acc * c.g, 1);
  const b = tints.reduce((acc, c) => acc * c.b, 1);
  style.filter = channelMultiplyFilter(r, g, b);
}

/**
 * CSS `filter` that multiplies the element's painted RGB by (r, g, b).
 *
 * No CSS filter function multiplies channels, so this is an inline SVG
 * `feColorMatrix` — the only way to express Godot's per-channel modulate
 * exactly. `color-interpolation-filters="sRGB"` keeps the multiply in the same
 * space Godot's literals are written in.
 */
function channelMultiplyFilter(r: number, g: number, b: number): string {
  const m = [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0].join(' ');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg">` +
    `<filter id="m" color-interpolation-filters="sRGB">` +
    `<feColorMatrix type="matrix" values="${m}"/></filter></svg>`;
  return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}#m')`;
}

/**
 * Godot's Control transform: rotate and scale about `pivot_offset`, whose
 * effective value is `pivot_offset + pivot_offset_ratio * size`.
 *
 * A Container REWRITES its children's transform —
 * `Container::fit_child_in_rect` ends with `set_rotation(0)` and
 * `set_scale(Vector2(1, 1))`, and the class reference says so outright — so a
 * Control inside one never carries either, whatever the scene file says.
 */
function applyTransform(
  style: CSSProperties,
  p: ControlProperties,
  parent: ParentLayoutKind
): void {
  if (parent !== 'free') return;
  const rotation = p.rotation ?? 0;
  const sx = p.scale?.x ?? 1;
  const sy = p.scale?.y ?? 1;
  if (rotation === 0 && sx === 1 && sy === 1) return;

  const parts: string[] = [];
  if (rotation !== 0) parts.push(`rotate(${rotation}rad)`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  style.transform = parts.join(' ');

  // `pivot_offset_ratio` is a fraction of the control's own size, which CSS can
  // express directly as a percentage of the transform box.
  const px = p.pivotOffset?.x ?? 0;
  const py = p.pivotOffset?.y ?? 0;
  const rx = p.pivotOffsetRatio?.x ?? 0;
  const ry = p.pivotOffsetRatio?.y ?? 0;
  const origin = (offset: number, ratio: number) =>
    ratio === 0 ? `${offset}px` : offset === 0 ? `${ratio * 100}%` : `calc(${ratio * 100}% + ${offset}px)`;
  style.transformOrigin = `${origin(px, rx)} ${origin(py, ry)}`;
}

export { PRESET_ANCHORS };

/**
 * Compose a Control's own CSS on top of its layout CSS, keeping the layout's
 * `display: none` authoritative.
 *
 * A component that spreads its own `display` default after the layout's
 * silently un-hides a `visible = false` node — later key wins. That bug shipped
 * three times over (Button, GridContainer, OptionButton), so the guard lives
 * here rather than being re-derived per slice; `visibleConformance.test.tsx`
 * holds every registered type to it.
 */
export function controlStyle(
  props: ControlProperties,
  parent: ParentLayoutKind,
  ...own: (CSSProperties | undefined)[]
): CSSProperties {
  const layout = controlLayoutStyle(props, parent);
  const style: CSSProperties = Object.assign({}, layout, ...own);
  if (layout.display === 'none') style.display = 'none';
  return style;
}
