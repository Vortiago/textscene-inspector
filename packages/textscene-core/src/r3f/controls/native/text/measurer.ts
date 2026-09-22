/**
 * The `TextMeasurer` the Control rect solver consumes (`../solverRegistry.ts`'s
 * `TextMeasurer = (text, fontSize, lineSpacingPx?, fontMetrics?) => Vec2`),
 * backed by `shapeText`.
 *
 * Mirrors Godot's `TextServer::get_string_size` at ITS default usage: a
 * widget's own natural (unwrapped) content size, used to floor a minimum
 * size — autowrap only narrows what's DRAWN once a box is known, it never
 * changes what a widget asks for. So this always shapes with
 * `AutowrapMode.OFF` and an unconstrained width; multiple lines only occur if
 * `text` itself contains an explicit newline.
 *
 * `fontMetrics` defaults to `shapeText`'s own default (`OPEN_SANS_FONT_METRICS`)
 * when omitted — every call site that predates this parameter keeps shaping
 * against the vendored atlas font, unchanged. A caller that resolved a scene
 * font for this same node (`resolveNodeFontMetrics.ts`) must pass it here so
 * the FLOORED size and the PAINTED glyphs agree on which font's advances they
 * measured — this repo's own `solverRegistry.ts` doc has the "two fonts for
 * one widget" failure mode this closes.
 */
import type { Vec2 } from '../rect';
import type { TextMeasurer } from '../solverRegistry';
import { AutowrapMode, shapeText } from './textLayout';

export const measureText: TextMeasurer = (
  text: string,
  fontSize: number,
  lineSpacingPx = 0,
  fontMetrics
): Vec2 => {
  const layout = shapeText(text, {
    fontSizePx: fontSize,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx,
    fontMetrics,
  });
  // `shapeText` stacks every line at a full pitch, so the LAST line leaves a
  // trailing gap no glyph occupies. `get_string_size` returns the shaped
  // extent — internal gaps only — so drop it once here. Doing it per caller is
  // how three widgets ended up with three different compensations and the ones
  // that forgot came out a whole `line_spacing` too tall.
  return { x: layout.widthPx, y: Math.max(0, layout.heightPx - lineSpacingPx) };
};
