/**
 * Label3D's own line-placement + outline-stroke math — a port of
 * `scene/3d/label_3d.cpp Label3D::_shape()` (~562-623) for the parts this
 * component parses (see `types.ts`/`parser.ts` for the parsed set;
 * `vertical_alignment`, `autowrap_mode` and `width` are unparsed and out of
 * scope — every Label3D therefore renders as Godot's own DEFAULT for each).
 *
 * This module only turns an ALREADY-SHAPED `TextLayoutResult` (from the
 * shared `shapeText`, reused verbatim — see `LabelGlyphs.tsx`) into per-line
 * pixel placements and the stroke width of Godot's own outline pass. It plays the same role `nodes/2d/ui/label/nativeSolver.ts`
 * plays for the 2D Control Label, for Label3D's own (different) rules:
 * always-centred vertical placement (`vertical_alignment` defaults to
 * `VERTICAL_ALIGNMENT_CENTER`, `label_3d.h`, and is never parsed away from
 * it), no box width, and `HORIZONTAL_ALIGNMENT_FILL` folding into CENTER
 * rather than justifying (`label_3d.cpp:592`'s switch falls `FILL` through
 * to the `CENTER` case; the width-fit block above it,
 * `TS->shaped_text_fit_to_width`, is real Label3D justification this
 * component does not implement since `width` is unparsed).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TextLayoutResult, TextLineLayout } from '../../../r3f/controls/native/text/textLayout';
import { HorizontalAlignment } from './types';

export interface Label3DLinePlacement {
  /** This line's own left-edge x offset (`label_3d.cpp:588-599`), Godot px. */
  x: number;
  /** This line's own "box top" Y, Godot px, y-down — `<TextRun>` anchors the line at its baseline from there itself (`buildGlyphQuadArrays`'s own doc). */
  y: number;
  line: TextLineLayout;
}

/**
 * `label_3d.cpp:568-580`: `vbegin` for `VERTICAL_ALIGNMENT_CENTER` — the ONE
 * case reachable here (`vertical_alignment` is unparsed, so every Label3D
 * renders at this default: the origin sits at the vertical centre of the
 * text block). Godot's own `vbegin = (total_h - line_spacing) / 2` is
 * expressed in a Y-UP-from-origin convention (positive = above origin);
 * `TextRun`'s own convention is Y-DOWN, so the sign flips here rather than
 * in the caller.
 */
function verticalOffsetPx(layout: TextLayoutResult, lineSpacingPx: number): number {
  const contentHeightPx = layout.heightPx - lineSpacingPx;
  return -contentHeightPx / 2;
}

/**
 * `label_3d.cpp:588-599`. `FILL` shares `CENTER`'s branch — Label3D has no
 * per-line justification pass for it (that lives in the `width`-driven
 * `shaped_text_fit_to_width` block `_shape()` calls above its per-line
 * loop, which this component never reaches since `width` is unparsed).
 */
function horizontalOffsetPx(lineWidthPx: number, alignment: HorizontalAlignment): number {
  switch (alignment) {
    case HorizontalAlignment.CENTER:
    case HorizontalAlignment.FILL:
      return -lineWidthPx / 2;
    case HorizontalAlignment.RIGHT:
      return -lineWidthPx;
    case HorizontalAlignment.LEFT:
    default:
      return 0;
  }
}

/** Per-line placements for an already-shaped `layout` — `LabelGlyphs.tsx`'s only consumer. */
export function layoutLabel3DLines(
  layout: TextLayoutResult,
  horizontalAlignment: HorizontalAlignment,
  lineSpacingPx: number
): Label3DLinePlacement[] {
  const vbeginPx = verticalOffsetPx(layout, lineSpacingPx);
  return layout.lines.map((line, lineIndex) => ({
    x: horizontalOffsetPx(line.widthPx, horizontalAlignment),
    y: vbeginPx + lineIndex * layout.linePitchPx,
    line,
  }));
}

/**
 * The one-sided reach of Godot's outline stroke, Godot px.
 *
 * The outline pass rasterises a SEPARATE glyph bitmap through FreeType's
 * stroker (`text_server_adv.cpp:1376-1403`), keyed by `Vector2i(font_size,
 * outline_size)` (`label_3d.cpp:344-349`). `_get_size_outline`
 * (`text_server_adv.h:406-414`) puts `outline_size` into `fd->size.y`
 * UNSCALED, and `FT_Stroker_Set(stroker, (int)(fd->size.y * 16.0), ...)`
 * (`text_server_adv.cpp:1383`) takes its radius in 26.6 fixed point — so the
 * radius is `outline_size * 16 / 64` px. Independent of `font_size`, exactly
 * as `outline_size` being its own absolute pixel quantity implies.
 */
export function outlineRadiusPx(outlineSizePx: number): number {
  return Math.trunc(outlineSizePx * 16) / 64;
}

/**
 * The full canvas stroke width for that radius — a canvas 2D stroke is
 * CENTRED on the path, so it reaches `lineWidth / 2` outside the contour,
 * matching `FT_Glyph_Stroke`'s both-borders export (`text_server_adv.cpp:
 * 1392`: an annulus with a transparent interior, not a filled dilation).
 *
 * `0` when Godot would skip the outline pass entirely (`label_3d.cpp:610`:
 * `outline_modulate.a != 0.0 && outline_size > 0`).
 */
export function outlineStrokeWidthPx(outlineSizePx: number): number {
  if (outlineSizePx <= 0) return 0;
  return 2 * outlineRadiusPx(outlineSizePx);
}
