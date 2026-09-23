/**
 * The Control rect solver's `TextMeasurer` (`../solverRegistry.ts`), backed by
 * `shapeText`. Like `TextServer::get_string_size`, it measures the unwrapped
 * natural size a widget floors its minimum on: autowrap narrows only what is
 * drawn. Only an explicit newline in `text` makes more than one line.
 */
// A caller with a scene font (`resolveNodeFontMetrics.ts`) passes `fontMetrics`, so
// the floored size and the painted glyphs use one font. Omitted, it is `OPEN_SANS_FONT_METRICS`.
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
  // `shapeText` stacks every line at a full pitch, so the last line leaves a
  // trailing gap. `get_string_size` returns the shaped extent with internal gaps
  // only, so drop it once here rather than per caller.
  return { x: layout.widthPx, y: Math.max(0, layout.heightPx - lineSpacingPx) };
};
