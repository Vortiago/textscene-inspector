/**
 * Reconciles where `<TextRun>` puts a line against where Godot puts one.
 *
 * `TextRun` places a line's glyphs `glyph.yoffset * scale` below its own y=0 —
 * the atlas bake's "line top", with `OPEN_SANS_ATLAS_INFO.base` below that being
 * the baseline. Godot instead anchors every line at its BASELINE (`ofs.y += asc`
 * before drawing, `scene/gui/label.cpp:616,823`; `Button::_notification`'s
 * `text_buf->draw(...)` goes through the identical TextServer paragraph
 * convention). So TextRun's y=0 sits `base` above the baseline while Godot's
 * line top sits `ascentPx` above it, and the difference is added once, before
 * any alignment offset.
 *
 * This lives in the text engine rather than in any one slice because it is a
 * property of the shared drawing convention, not of Label or Button. Two slices
 * previously carried byte-identical copies, each reasoning — correctly — that it
 * should not depend on the other's file; promoting it here is what that
 * reasoning actually called for.
 *
 * The ascent is ceiled at the TARGET size, independently of the descent, for the
 * same reason `getLinePitchPx` ceils both: Godot's TextServer reads FreeType's
 * pixel-quantised size metrics rather than scaling the font tables.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import { OPEN_SANS_METRICS } from './openSansMetrics';

/** `ceil(ascent * fontSizePx / unitsPerEm)` — the ascent alone, not the ascent+descent+spacing sum `getLinePitchPx` returns. */
export function ascentPxAt(fontSizePx: number): number {
  return Math.ceil(OPEN_SANS_METRICS.ascent * (fontSizePx / OPEN_SANS_METRICS.unitsPerEm));
}

/**
 * Pixels to add to a line's box-top Y so a `<TextRun>` lands where Godot draws.
 *
 * Measured closed against real Godot 4.6.3: a y-scan at x=20 through the
 * autowrap label's first line reports the first non-background row at y=146 on
 * both sides with this applied, where ours previously started at y=144.
 */
export function originCorrectionPx(fontSizePx: number): number {
  const baseAtTargetPx = OPEN_SANS_ATLAS_INFO.base * (fontSizePx / OPEN_SANS_ATLAS_INFO.fontSize);
  return ascentPxAt(fontSizePx) - baseAtTargetPx;
}
