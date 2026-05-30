/**
 * Maps a Godot StyleBox theme resource to CSS (ADR-0003). StyleBoxFlat →
 * background / border / border-radius / padding; StyleBoxEmpty (and unknown
 * box types) → transparent (`{}`).
 */

import type { CSSProperties } from 'react';
import { parseColor } from '../../utils/colorParser';

export function colorToCss(value: string): string | undefined {
  // parseColor() falls back to white on bad input rather than throwing, so we
  // gate on the Color(...) form here to avoid silently emitting white.
  if (!/^Color\s*\(/.test(value.trim())) return undefined;
  const c = parseColor(value);
  return controlColorToCss(c);
}

/** Format an already-parsed {r,g,b,a} (0..1) color as a CSS rgba() string. */
export function controlColorToCss(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

function n(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const x = parseFloat(value);
  return Number.isNaN(x) ? fallback : x;
}

export function styleBoxToCss(type: string, data: Record<string, string>): CSSProperties {
  if (type !== 'StyleBoxFlat') return {}; // StyleBoxEmpty / unknown → transparent
  const style: CSSProperties = {};

  if (data.bg_color) {
    const bg = colorToCss(data.bg_color);
    if (bg) style.backgroundColor = bg;
  }

  const tl = n(data.corner_radius_top_left);
  const tr = n(data.corner_radius_top_right);
  const br = n(data.corner_radius_bottom_right);
  const bl = n(data.corner_radius_bottom_left);
  if (tl || tr || br || bl) {
    style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
  }

  const bwL = n(data.border_width_left);
  const bwT = n(data.border_width_top);
  const bwR = n(data.border_width_right);
  const bwB = n(data.border_width_bottom);
  if (bwL || bwT || bwR || bwB) {
    style.borderStyle = 'solid';
    style.borderColor = (data.border_color && colorToCss(data.border_color)) || 'rgba(0, 0, 0, 1)';
    style.borderWidth = `${bwT}px ${bwR}px ${bwB}px ${bwL}px`;
  }

  const cl = n(data.content_margin_left, -1);
  const ct = n(data.content_margin_top, -1);
  const cr = n(data.content_margin_right, -1);
  const cb = n(data.content_margin_bottom, -1);
  if (cl >= 0 || ct >= 0 || cr >= 0 || cb >= 0) {
    style.padding = `${Math.max(0, ct)}px ${Math.max(0, cr)}px ${Math.max(0, cb)}px ${Math.max(0, cl)}px`;
  }

  return style;
}
