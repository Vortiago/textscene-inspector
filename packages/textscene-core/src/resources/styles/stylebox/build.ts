/**
 * `StyleBox` build — decoded data into the CSS a Control's `<div>` wears
 * (ADR-0003, ADR-0031: a slice's build half may produce plain data, and CSS is
 * plain data). React-free at runtime; `CSSProperties` is a type-only import.
 *
 * Only properties Godot actually paints reach CSS: an interior fill just when
 * `draw_center` is on, borders and padding only where a side is non-zero, and a
 * drop shadow only from `shadow_size` 1 up (style_box_flat.cpp:191-197).
 *
 * A box that paints NO fill still says so — `backgroundColor: 'transparent'`,
 * never an absent property. Godot's box replaces the Control's themed box
 * outright (`StyleBoxFlat::draw` returns early with nothing drawn when there is
 * no centre, border or shadow, style_box_flat.cpp:455-460; `StyleBoxEmpty::draw`
 * is empty, style_box.h:80), so an omitted fill would instead let a consumer's
 * own default show through — the opposite of what the engine draws.
 */

import type { CSSProperties } from 'react';
import type { Color } from '../../../utils/colorParser';
import type { StyleBoxData } from './types';
import { channelToByte } from '../../../utils/colorSpace';

/**
 * Format a decoded Color as a CSS `rgba()` string. Godot allows overbright (HDR)
 * Control colours (channels > 1); CSS rejects out-of-range `rgba()` values and
 * drops the whole declaration, so clamp to the displayable range — matching
 * `parseColorToHex`'s 0..1 clamp on the 3D path.
 */
export function controlColorToCss(c: Color): string {
  const alpha = Math.max(0, Math.min(1, c.a));
  return `rgba(${channelToByte(c.r)}, ${channelToByte(c.g)}, ${channelToByte(c.b)}, ${alpha})`;
}

/** What a box paints instead of a fill, and what an absent fill must never be. */
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
