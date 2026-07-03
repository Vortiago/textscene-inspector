/**
 * Maps a Godot StyleBox theme resource to CSS (ADR-0003). StyleBoxFlat →
 * background / border / border-radius / padding; StyleBoxEmpty (and unknown
 * box types) → transparent (`{}`).
 */

import type { CSSProperties } from 'react';
import { parseColor } from '../../utils/colorParser';
import { vec2Or } from '../../parser/valueParsers';

export function colorToCss(value: string): string | undefined {
  // parseColor() falls back to white on bad input rather than throwing, so we
  // gate on the Color(...) form here to avoid silently emitting white.
  if (!/^Color\s*\(/.test(value.trim())) return undefined;
  const c = parseColor(value);
  return controlColorToCss(c);
}

/** Format an already-parsed {r,g,b,a} (0..1) color as a CSS rgba() string. */
export function controlColorToCss(c: { r: number; g: number; b: number; a: number }): string {
  // Godot allows overbright (HDR) Control colors (channels > 1). CSS rejects
  // out-of-range rgba() values and drops the whole declaration, so clamp to the
  // displayable range — matching parseColorToHex's 0..1 clamp on the 3D path.
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const alpha = Math.max(0, Math.min(1, c.a));
  return `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${alpha})`;
}

function n(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const x = parseFloat(value);
  return Number.isNaN(x) ? fallback : x;
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
    const off = vec2Or(data.shadow_offset, { x: 0, y: 0 }, 'shadow_offset');
    style.boxShadow = `${off.x}px ${off.y}px ${shadowSize}px ${shadowColor}`;
  }

  return style;
}
