/**
 * The `TextMeasurer` the Control rect solver consumes (`../solverRegistry.ts`'s
 * `TextMeasurer = (text, fontSize) => Vec2`), backed by `shapeText`.
 *
 * Mirrors Godot's `TextServer::get_string_size` at ITS default usage: a
 * widget's own natural (unwrapped) content size, used to floor a minimum
 * size — autowrap only narrows what's DRAWN once a box is known, it never
 * changes what a widget asks for. So this always shapes with
 * `AutowrapMode.OFF` and an unconstrained width; multiple lines only occur if
 * `text` itself contains an explicit newline.
 */
import type { Vec2 } from '../rect';
import type { TextMeasurer } from '../solverRegistry';
import { AutowrapMode, shapeText } from './textLayout';

export const measureText: TextMeasurer = (text: string, fontSize: number, lineSpacingPx = 0): Vec2 => {
  const layout = shapeText(text, {
    fontSizePx: fontSize,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx,
  });
  // `shapeText` stacks every line at a full pitch, so the LAST line leaves a
  // trailing gap no glyph occupies. `get_string_size` returns the shaped
  // extent — internal gaps only — so drop it once here. Doing it per caller is
  // how three widgets ended up with three different compensations and the ones
  // that forgot came out a whole `line_spacing` too tall.
  return { x: layout.widthPx, y: Math.max(0, layout.heightPx - lineSpacingPx) };
};
