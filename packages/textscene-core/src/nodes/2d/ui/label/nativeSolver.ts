/**
 * Label's native (WebGL canvas) rect solver — `Label::get_minimum_size`
 * (`scene/gui/label.cpp:973-998`), backed by `_update_visible` (`:344-388`)
 * and `get_line_height` (`:111-136`); plus the theme-override key mapping
 * (`font_size`/`font_color`) and default colour Label reads. Registered via
 * `controlSolverRegistry.registerMinimumSize`. Pure per-node math, no
 * THREE/React — painting is `NativeComponent.tsx`'s job.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import {getLinePitchPx} from '../../../../r3f/controls/native/text/openSansMetrics';
import type { TextLayoutResult, TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { resolveTextTheme, type ResolvedTextTheme, type TextThemeDefaults, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import type { ControlColor } from '../control/types';
import type { LabelProperties } from './types';
import { originCorrectionPx } from '../../../../r3f/controls/native/text/textOrigin';

/** Label reads `theme_override_font_sizes/font_size` and `theme_override_colors/font_color`. */
export const LABEL_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/**
 * Label's own default-theme font colour — opaque white, a DIFFERENT literal
 * from the `control_font_color` gray (`Color(0.875, 0.875, 0.875)`,
 * `godotDefaultTheme.ts`'s `DEFAULT_FONT_COLOR`) most other widget types read:
 * `default_theme.cpp` sets `theme->set_color(font_color, "Label", Color(1, 1, 1))`
 * explicitly, its own literal rather than inheriting the shared constant.
 */
export const LABEL_DEFAULT_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

const AUTOWRAP_OFF = 0;

/** Resolves this Label's own theme font size/colour (overrides, else the theme default / Label's own white). */
export function labelTextTheme(
  props: LabelProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: LABEL_DEFAULT_FONT_COLOR };
  return resolveTextTheme(props, LABEL_THEME_KEYS, defaults);
}

/**
 * `Label::get_minimum_size` (`:973-998`). Two branches:
 *
 * - autowrap OFF (`:992-996`): `minsize + min_style` — `min_style` is zero
 *   for Label's default `StyleBoxEmpty` (`theme_cache.normal_style`,
 *   `default_theme.cpp:379`) and not modelled here (no `theme_override_styles`
 *   chrome for Label in this packet's scope). `minsize.width` is the WIDEST
 *   unwrapped line (`:252-257`, only computed for OFF); `minsize.height`
 *   is `_update_visible`'s per-line sum (below).
 * - autowrap ON (`:984-991`): ALWAYS `Size2(1, height)` — a wrapping Label's
 *   own width floor is 1px regardless of its text; the box comes entirely
 *   from anchors/containers. `height` still needs a "current size" (how many
 *   lines the text wraps into at ITS OWN width) that does not exist yet in a
 *   bottom-up minimum-size pass with no rect assigned — the identical
 *   self-reference `texturerect/nativeSolver.ts`'s FIT_WIDTH/FIT_HEIGHT
 *   divergence already documents and resolves the same way: substitute the
 *   one non-circular natural quantity on hand (the UNWRAPPED height) rather
 *   than iterate the solver to a fixed point.
 *
 * `_update_visible` (`:344-388`) sums `asc + dsc + line_spacing` per line then
 * subtracts ONE trailing `line_spacing` — N lines carry only (N-1) inter-line
 * gaps. `ctx.measureText` (always AUTOWRAP_OFF, unconstrained — `measurer.ts`)
 * returns `N * linePitchPx` with no such subtraction, so it is applied here:
 * `measured.y - lineSpacingPx`. `lineSpacingPx` itself is never hardcoded —
 * `getLinePitchPx(fontSizePx) - getLinePitchPx(fontSizePx, 0)` recovers
 * whatever default the text engine itself uses, so a future change to that
 * default cannot silently drift this subtraction out of sync with it.
 *
 * Empty text (`:239-241`) short-circuits before any of the above: `_shape()`
 * sets `minsize = Size2(1, get_line_height())`, and `get_line_height()` with
 * no shaped lines (`:125-134`) returns `font->get_height(font_size)` — ascent
 * + descent, no `line_spacing` folded in at all.
 */
export const labelMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LabelProperties;
  const text = props.text ?? '';
  const { fontSizePx } = labelTextTheme(props, ctx);
  const fontHeightPx = getLinePitchPx(fontSizePx, 0);

  if (text.length === 0) {
    return { x: 1, y: fontHeightPx };
  }

  if (!ctx.measureText) return { x: 0, y: 0 };

  const measured = ctx.measureText(text, fontSizePx);
  const lineSpacingPx = getLinePitchPx(fontSizePx) - fontHeightPx;
  const naturalHeight = Math.max(0, measured.y - lineSpacingPx);
  const height = Math.max(naturalHeight, fontHeightPx);

  if ((props.autowrapMode ?? AUTOWRAP_OFF) !== AUTOWRAP_OFF) {
    return { x: 1, y: height };
  }
  return { x: measured.x, y: height };
};

// --- Draw-time layout: per-line placement + the vertical-origin reconciliation ---

const H_LEFT = 0;
const H_CENTER = 1;
const H_RIGHT = 2;
const H_FILL = 3;

const V_TOP = 0;
const V_CENTER = 1;
const V_BOTTOM = 2;
const V_FILL = 3;



export interface LabelLinePlacement {
  /** This line's left edge, box-local Godot px. */
  x: number;
  /**
   * This line's "box top" Y, box-local Godot px, already reconciled via
   * `originCorrectionPx` — feed straight into a `<TextRun>` for a
   * single-line layout (`lineIndex` 0 internally): `y + glyph.yoffset*scale`
   * lands exactly where Godot draws that glyph.
   */
  y: number;
  /** This line, ready for its OWN `<TextRun>` (justified in-place for `HORIZONTAL_ALIGNMENT_FILL`, otherwise the original line unchanged). */
  line: TextLineLayout;
}

/** Redistributes `line`'s slack width evenly across its word-boundary gaps (`TextServer::shaped_text_fit_to_width`'s `JUSTIFICATION_WORD_BOUND`, Latin/ASCII subset — no kashida elongation, out of scope). A no-op if there is no slack or no gap to grow. */
function justifyLine(line: TextLineLayout, boxWidthPx: number): TextLineLayout {
  const slackPx = boxWidthPx - line.widthPx;
  const gapCount = line.glyphs.filter((g) => g.char === ' ').length;
  if (slackPx <= 0 || gapCount === 0) return line;

  const extraPerGapPx = slackPx / gapCount;
  let shiftPx = 0;
  const glyphs = line.glyphs.map((g) => {
    const placed = { ...g, x: g.x + shiftPx };
    if (g.char === ' ') shiftPx += extraPerGapPx;
    return placed;
  });
  return { ...line, glyphs, widthPx: boxWidthPx };
}

function horizontalOffsetPx(lineWidthPx: number, boxWidthPx: number, alignment: number | undefined): number {
  switch (alignment ?? H_LEFT) {
    case H_CENTER:
      return (boxWidthPx - lineWidthPx) / 2;
    case H_RIGHT:
      return boxWidthPx - lineWidthPx;
    case H_LEFT:
    case H_FILL:
    default:
      return 0;
  }
}

/**
 * Per-line placement honoring `horizontal_alignment`/`vertical_alignment`
 * (`Label::_get_line_rect`'s x, `Label::get_layout_data`'s vbegin/vsep,
 * `label.cpp:592-617`). Godot aligns EVERY LINE independently by its own
 * width — a single merged multi-line mesh sharing one x origin (the way
 * `TextRun` draws a whole `shapeText` layout) cannot express that once lines
 * differ in width, so this returns one placement per line, each meant for
 * its OWN `<TextRun>` rather than the layout's `<TextRun>` as a whole.
 */
export function layoutLabelLines(
  layout: TextLayoutResult,
  boxWidthPx: number,
  boxHeightPx: number,
  horizontalAlignment: number | undefined,
  verticalAlignment: number | undefined,
  fontSizePx: number
): LabelLinePlacement[] {
  const lineCount = layout.lines.length;
  if (lineCount === 0) return [];

  const fontHeightPx = getLinePitchPx(fontSizePx, 0);
  const lineSpacingPx = getLinePitchPx(fontSizePx) - fontHeightPx;
  // label.cpp:599 etc: `total_h - line_spacing - paragraph_spacing` (single
  // paragraph here, so paragraph_spacing is 0) — the SAME `-lineSpacingPx`
  // correction `labelMinimumSize` applies to `ctx.measureText`'s own sum.
  const contentHeightPx = layout.heightPx - lineSpacingPx;

  let vbeginPx = 0;
  let vsepPx = 0;
  switch (verticalAlignment ?? V_TOP) {
    case V_CENTER:
      vbeginPx = (boxHeightPx - contentHeightPx) / 2;
      break;
    case V_BOTTOM:
      vbeginPx = boxHeightPx - contentHeightPx;
      break;
    case V_FILL:
      vsepPx = lineCount > 1 ? (boxHeightPx - contentHeightPx) / (lineCount - 1) : 0;
      break;
    case V_TOP:
    default:
      break;
  }

  const effectivePitchPx = layout.linePitchPx + vsepPx;
  const originPx = originCorrectionPx(fontSizePx);
  const isFill = (horizontalAlignment ?? H_LEFT) === H_FILL;

  return layout.lines.map((line, lineIndex) => {
    const y = vbeginPx + originPx + lineIndex * effectivePitchPx;
    if (isFill) {
      // label.h:46 default `jst_flags`: JUSTIFICATION_SKIP_LAST_LINE, EXCEPT
      // JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE overrides it when there is only
      // one line total (that line is both first and last).
      const skipJustify = lineCount > 1 && lineIndex === lineCount - 1;
      return { x: 0, y, line: skipJustify ? line : justifyLine(line, boxWidthPx) };
    }
    return { x: horizontalOffsetPx(line.widthPx, boxWidthPx, horizontalAlignment), y, line };
  });
}
