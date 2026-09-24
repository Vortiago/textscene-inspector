/**
 * `StyleBox` build: decoded data into the CSS a Control's `<div>` wears
 * (ADR-0003, ADR-0031: CSS is plain data). React-free at runtime. Only what Godot
 * paints reaches CSS: a fill when `draw_center` is on, non-zero sides, and a drop
 * shadow from `shadow_size` 1 up (style_box_flat.cpp:191-197).
 */

import type { CSSProperties } from 'react';
import type { Color } from '../../../utils/colorParser';
import type { StyleBoxData } from './types';
import { channelToByte } from '../../../utils/colorSpace';

/**
 * A decoded Color as CSS `rgba()`, clamped to 0..1 like `parseColorToHex`. Godot
 * allows overbright Control colours, and CSS drops an out-of-range declaration.
 */
export function controlColorToCss(c: Color): string {
  const alpha = Math.max(0, Math.min(1, c.a));
  return `rgba(${channelToByte(c.r)}, ${channelToByte(c.g)}, ${channelToByte(c.b)}, ${alpha})`;
}

/**
 * A box with no fill says `transparent`, never an absent property: Godot's box
 * replaces the themed one. `StyleBoxFlat::draw` draws nothing with no centre,
 * border or shadow (style_box_flat.cpp:455-460), and `StyleBoxEmpty::draw` is
 * empty (style_box.h:80).
 */
const NO_FILL = 'transparent';

export function buildStyleBoxCss(data: StyleBoxData): CSSProperties {
  if (data.kind === 'empty') return { backgroundColor: NO_FILL };

  const style: CSSProperties = {
    backgroundColor: data.drawCenter ? controlColorToCss(data.bgColor) : NO_FILL,
  };

  const { topLeft, topRight, bottomRight, bottomLeft } = data.cornerRadius;
  if (topLeft || topRight || bottomRight || bottomLeft) {
    style.borderRadius = `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
  }

  const border = data.borderWidth;
  if (border.left || border.top || border.right || border.bottom) {
    style.borderStyle = 'solid';
    style.borderColor = controlColorToCss(data.borderColor);
    style.borderWidth = `${border.top}px ${border.right}px ${border.bottom}px ${border.left}px`;
  }

  const padding = data.contentMargin;
  if (padding.left || padding.top || padding.right || padding.bottom) {
    style.padding = `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`;
  }

  if (data.shadowSize >= 1) {
    const { x, y } = data.shadowOffset;
    style.boxShadow = `${x}px ${y}px ${data.shadowSize}px ${controlColorToCss(data.shadowColor)}`;
  }

  return style;
}
