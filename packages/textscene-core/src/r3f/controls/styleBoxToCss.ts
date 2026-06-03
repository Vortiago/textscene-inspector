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

function parseVec2(value: string | undefined): { x: number; y: number } {
  if (!value) return { x: 0, y: 0 };
  const m = value.match(/Vector2\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)/);
  if (!m) return { x: 0, y: 0 };
  return { x: parseFloat(m[1]!), y: parseFloat(m[2]!) };
}

export function styleBoxToCss(type: string, data: Record<string, string>): CSSProperties {
  if (type !== 'StyleBoxFlat') return {}; // StyleBoxEmpty / unknown → transparent
  const style: CSSProperties = {};

  // `draw_center = false` makes Godot paint only the border, leaving the
  // interior transparent — so skip the fill entirely in that case.
  if (data.bg_color && data.draw_center !== 'false') {
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
    // Godot's StyleBoxFlat.border_color default is Color(0.8,0.8,0.8,1) (light
    // gray), omitted from .tscn when unchanged — fall back to that, not black.
    style.borderColor = (data.border_color && colorToCss(data.border_color)) || 'rgba(204, 204, 204, 1)';
    style.borderWidth = `${bwT}px ${bwR}px ${bwB}px ${bwL}px`;
  }

  // StyleBox::get_margin() falls back to the side's border_width when
  // content_margin[side] is negative (the default −1) — so a border-only box
  // still pads its content by the border thickness.
  const effL = n(data.content_margin_left, -1) >= 0 ? n(data.content_margin_left) : bwL;
  const effT = n(data.content_margin_top, -1) >= 0 ? n(data.content_margin_top) : bwT;
  const effR = n(data.content_margin_right, -1) >= 0 ? n(data.content_margin_right) : bwR;
  const effB = n(data.content_margin_bottom, -1) >= 0 ? n(data.content_margin_bottom) : bwB;
  if (effL || effT || effR || effB) {
    style.padding = `${effT}px ${effR}px ${effB}px ${effL}px`;
  }

  // Drop shadow (only drawn when shadow_size >= 1). shadow_color default
  // Color(0,0,0,0.6); shadow_offset default Vector2(0,0).
  const shadowSize = n(data.shadow_size, 0);
  if (shadowSize >= 1) {
    const shadowColor = (data.shadow_color && colorToCss(data.shadow_color)) || 'rgba(0, 0, 0, 0.6)';
    const off = parseVec2(data.shadow_offset);
    style.boxShadow = `${off.x}px ${off.y}px ${shadowSize}px ${shadowColor}`;
  }

  return style;
}
