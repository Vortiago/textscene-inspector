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
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { AutowrapMode, clampAutowrapMode, shapeText, type TextLayoutResult, type TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { resolveTextTheme, type ResolvedTextTheme, type TextThemeDefaults, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import type { ControlColor } from '../control/types';
import type { LabelProperties } from './types';

/** Label reads `theme_override_font_sizes/font_size` and `theme_override_colors/font_color`. */
export const LABEL_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/**
 * Label's own theme font key — `SceneStringName(font)` = `"font"`,
 * `scene/theme/default_theme.cpp:381`:
 * `theme->set_font(SceneStringName(font), "Label", Ref<Font>());`. Fed to
 * `resolveNodeFontMetrics` by both this module (the solve pass) and
 * `Component.tsx` (the autowrap-ON re-shape, which does not reuse `meta`) so
 * the two agree on which font this Label is in.
 */
export const LABEL_THEME_FONT_KEY = 'font';

/**
 * Label's own default-theme font colour — opaque white, a DIFFERENT literal
 * from the `control_font_color` gray (`Color(0.875, 0.875, 0.875)`,
 * `godotDefaultTheme.ts`'s `DEFAULT_FONT_COLOR`) most other widget types read:
 * `default_theme.cpp` sets `theme->set_color(font_color, "Label", Color(1, 1, 1))`
 * explicitly, its own literal rather than inheriting the shared constant.
 */
export const LABEL_DEFAULT_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

/** Resolves this Label's own theme font size/colour (overrides, else the ancestor Theme chain / theme default / Label's own white — `resolveTextTheme`'s own doc). */
export function labelTextTheme(
  n: SolveNode,
  props: LabelProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: LABEL_DEFAULT_FONT_COLOR };
  return resolveTextTheme(n, props, LABEL_THEME_KEYS, defaults);
}

/**
 * The width `Label::_shape` breaks lines at (`label.cpp:581`):
 *
 *     int width = (get_size().width - style->get_minimum_size().width);
 *
 * `style` is `theme_cache.normal_style`, Label's own `StyleBoxEmpty`
 * (`default_theme.cpp:379`), so the second term is zero and no chrome is
 * subtracted. The `int` is the part that matters: a container routinely hands a
 * Control a fractional width, and a word that fits in 320.6px but not in 320
 * wraps in the engine.
 *
 * Lives here, and is called by `Component.tsx` as well as by
 * `labelMinimumSize`, because the two must agree exactly — the height the
 * solver floors this Label's box against is the height of the lines the painter
 * then draws, and a rule spelled out twice agrees only for as long as both
 * spellings happen to match.
 */
export function labelShapingWidthPx(controlWidthPx: number): number {
  return Math.trunc(controlWidthPx);
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
 *   from anchors/containers. `height`, though, is the height of the text AS
 *   WRAPPED: `_shape` (`:581,:227`) breaks lines at
 *   `int width = get_size().width - normal_style->get_minimum_size().width`
 *   and `_update_visible` (`:344-388`) sums the lines that came out, so a
 *   Label whose container narrowed it to two lines reports two lines' height.
 *   (`min_size.height = 1` and the `max_lines_visible` clamp above it need
 *   `clip` or an `overrun_behavior` other than `OVERRUN_NO_TRIMMING`; both
 *   are off by default and neither is modelled here.)
 *
 *   That width is the control's OWN resolved size, which a bottom-up
 *   minimum-size pass has not assigned yet — the identical self-reference
 *   `texturerect/nativeSolver.ts`'s FIT_WIDTH/FIT_HEIGHT carries, closed the
 *   same way: `SolveContext.tentativeRect` (`solverRegistry.ts`'s own doc)
 *   hands back the width a COMPLETED prior pass resolved, and
 *   `solveControlTree` runs that second pass because this type is registered
 *   via `controlSolverRegistry.registerSizeDependentMinimum` (`index.r3f.ts`).
 *   Reading the width from a finished pass rather than from the pass in
 *   flight is what keeps this non-circular: on the first pass there is no
 *   rect at all and the UNWRAPPED height stands in, exactly as before; on the
 *   second, `tentative.w` IS Godot's `get_size().width`. One extra pass
 *   suffices because this Label's own width floor is 1 on EVERY pass, so
 *   nothing it reports can change the width it is handed back — the width
 *   chain is identical between the two passes, and the corrected height is
 *   therefore computed against the final width, not a stale one.
 *
 *   In real Godot the same exchange is spread over frames rather than passes:
 *   `Control::_size_changed` -> `NOTIFICATION_RESIZED` (`:901-905`, which only
 *   marks the paragraphs dirty) -> the next `_ensure_shaped` -> `_shape`'s own
 *   `update_minimum_size()` (`:339-341`) -> `Control::_update_minimum_size`'s
 *   `minimum_size_changed` -> `Container::_child_minsize_changed`'s
 *   `queue_sort` (`container.cpp:33-36`).
 *
 * `_update_visible` (`:344-388`) sums `asc + dsc + line_spacing` per line then
 * subtracts ONE trailing `line_spacing` — N lines carry only (N-1) inter-line
 * gaps. Shaping at `getLinePitchPx(fontSizePx) - fontHeightPx` (Label's own
 * 3px `line_spacing` theme constant, never hardcoded — recovered the same
 * way so a future change to that default cannot silently drift this
 * subtraction out of sync with it) returns `N * linePitchPx` with no such
 * subtraction, so it is applied here: `layout.heightPx - lineSpacingPx`.
 *
 * Empty text (`:239-241`) short-circuits before any of the above: `_shape()`
 * sets `minsize = Size2(1, get_line_height())`, and `get_line_height()` with
 * no shaped lines (`:125-134`) returns `font->get_height(font_size)` — ascent
 * + descent, no `line_spacing` folded in at all.
 *
 * `uppercase` transforms `text` BEFORE any of this, matching `_shape()`
 * (`label.cpp:154`: `txt = uppercase ? TS->string_to_upper(xl_text) : xl_text`,
 * read by `get_minimum_size` via `_ensure_shaped`) — a Label's minimum size
 * reflects the UPPERCASED glyphs' own (typically wider) advances, not the
 * source casing. The transform is `shapeText`'s own option here, not applied
 * before the call: the painter's fallback shape passes the same option, and
 * this minimum is what the painter reads back as its layout, so the casing
 * rule has to live in exactly one place or the two can disagree silently.
 *
 * The shaping width goes through `labelShapingWidthPx` (its own doc), the one
 * spelling of `_shape`'s `int width` this slice has.
 *
 * Shapes via `shapeText` DIRECTLY rather than through `ctx.measureText`
 * (still the presence GATE — an absent measurer still means "text
 * contributes nothing", exactly as before) so this function can attach the
 * shaped `TextLayoutResult` as `meta` when autowrap is OFF: `shapeText`
 * forces `effectiveWidth = 0` whenever `autowrapMode === OFF` regardless of
 * `boxWidthPx`, so THIS shape (unconstrained, `lineSpacingPx` = Label's own
 * 3px) is the IDENTICAL layout `Label`'s painter (`Component.tsx`) would
 * compute for the OFF case (its own default) — reused instead of re-shaped.
 * The autowrap-ON branch never attaches meta: its shape is taken at whatever
 * width the PREVIOUS pass resolved, and this pass may still move that width
 * (its own corrected height grows an ancestor container, and a split or a
 * scrollbar appearing inside one narrows what is below it) — so the painter
 * re-shapes at the rect it is actually handed rather than reuse a layout that
 * is only usually the same one.
 */
export const labelMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LabelProperties;
  // Raw, with `uppercase` handed to `shapeText` as an option rather than
  // pre-applied here: the painter's own fallback shape passes the option too,
  // and one rule implemented in two places agrees only for as long as both
  // spellings happen to match. Emptiness is unaffected by case, so the
  // early-out below reads the same either way.
  const text = props.text ?? '';
  const { fontSizePx } = labelTextTheme(n, props, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, LABEL_THEME_FONT_KEY);
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);

  if (text.length === 0) {
    return { x: 1, y: fontHeightPx };
  }

  if (!ctx.measureText) return { x: 0, y: 0 };

  // Label is the one widget whose theme sets `line_spacing` (3), and it
  // separates lines without adding a trailing gap — which the subtraction
  // below guarantees, so nothing is added back for a single line. The
  // subtraction is mathematically independent of WHICH `fontMetrics` is
  // used (ascent/descent cancel identically either way), so this still
  // recovers exactly `getFontLinePitchPx`'s own default (3) rather than a
  // hardcoded literal.
  const lineSpacingPx = getFontLinePitchPx(fontMetrics, fontSizePx) - fontHeightPx;
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF);
  // This control's own resolved width, or `undefined` on the first pass, where
  // no rect exists yet.
  const shapedWidthPx =
    autowrapMode === AutowrapMode.OFF ? undefined : ctx.tentativeRect?.(n)?.w;
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: shapedWidthPx === undefined ? 0 : labelShapingWidthPx(shapedWidthPx),
    autowrapMode: shapedWidthPx === undefined ? AutowrapMode.OFF : autowrapMode,
    lineSpacingPx,
    uppercase: props.uppercase,
    fontMetrics,
  });
  const measuredY = Math.max(0, layout.heightPx - lineSpacingPx);
  const height = Math.max(measuredY, fontHeightPx);

  if (autowrapMode !== AutowrapMode.OFF) {
    return { size: { x: 1, y: height } };
  }
  return { size: { x: layout.widthPx, y: height }, meta: layout };
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
   * This line's "box top" Y, box-local Godot px — feed straight into a
   * `<TextRun>` for a single-line layout (`lineIndex` 0 internally), which
   * anchors the line at its own baseline from there (`buildGlyphQuadArrays`'s
   * own doc) and lands every glyph exactly where Godot draws it.
   */
  y: number;
  /** This line, ready for its OWN `<TextRun>` (justified in-place for `HORIZONTAL_ALIGNMENT_FILL`, otherwise the original line unchanged). */
  line: TextLineLayout;
}

/**
 * Redistributes `line`'s slack width evenly across its word-boundary gaps
 * (`TextServer::shaped_text_fit_to_width`'s `JUSTIFICATION_WORD_BOUND`,
 * Latin/ASCII subset — no kashida elongation, out of scope). A no-op if there
 * is no slack or no gap to grow.
 *
 * `boxWidthPx` here is the TRUNCATED control width: `_shape` justifies with the
 * same `int width` it broke the lines at (`label.cpp:297,331` —
 * `shaped_text_fit_to_width(para.lines_rid[i], width, line_jst_flags)`), not
 * with the raw `get_size()` that `_get_line_rect` reads. The two genuinely
 * differ, which is why the caller passes a different number to each.
 */
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

/**
 * `Label::_get_line_rect`'s x, non-RTL (`label.cpp:487-512`). Both non-zero
 * branches land on a WHOLE pixel in the engine, and neither does so by
 * rounding: H_CENTER writes `int(size.width - line_size.width) / 2` — a C++
 * `int` conversion followed by C++ integer division, each truncating TOWARD
 * ZERO — and H_RIGHT writes `int(size.width - margin - line_size.width)`.
 * Toward zero, not `Math.floor`: a box NARROWER than its line (only reachable
 * with `clip_text`, which drops Label's own width floor to 1) makes the
 * difference negative, and there the two disagree by a full pixel.
 *
 * `margin` is `theme_cache.normal_style`'s `SIDE_RIGHT`, and Label's own
 * default-theme style is a `StyleBoxEmpty` (`default_theme.cpp:379`) — zero,
 * so it drops out, exactly as `style->get_offset().x` does from the LEFT/FILL
 * branch returning 0 below.
 *
 * H_CENTER's two truncations are transcribed as the source writes them. They
 * are not, in fact, separable from a single truncation of the halved
 * difference — for every real d, `trunc(trunc(d) / 2) === trunc(d / 2)`, since
 * halving an integer moves it by less than 1 and can never cross a truncation
 * boundary — and Godot's own measured origins agree at odd differences as
 * well as even ones. The double step stays because it is what `_get_line_rect`
 * does; nothing downstream depends on the two being distinguishable.
 */
function horizontalOffsetPx(lineWidthPx: number, boxWidthPx: number, alignment: number | undefined): number {
  switch (alignment ?? H_LEFT) {
    case H_CENTER:
      return Math.trunc(Math.trunc(boxWidthPx - lineWidthPx) / 2);
    case H_RIGHT:
      return Math.trunc(boxWidthPx - lineWidthPx);
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

  // `layout.fontMetrics` is `shapeText`'s own echo of whichever `FontMetrics`
  // it shaped THIS layout against (`textLayout.ts`'s own doc) — reading it
  // back here, rather than taking a second `fontMetrics` parameter, is what
  // keeps this placement math from EVER disagreeing with the layout it is
  // placing.
  const fontMetrics = layout.fontMetrics;
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);
  const lineSpacingPx = getFontLinePitchPx(fontMetrics, fontSizePx) - fontHeightPx;
  // label.cpp:599 etc: `total_h - line_spacing - paragraph_spacing` (single
  // paragraph here, so paragraph_spacing is 0) — the SAME `-lineSpacingPx`
  // correction `labelMinimumSize` applies to `ctx.measureText`'s own sum.
  const contentHeightPx = layout.heightPx - lineSpacingPx;

  // `Label::get_layout_data` declares BOTH of these as `int vbegin = 0, vsep = 0`
  // (`label.cpp:591`) and assigns the floating-point expressions below straight
  // into them, so each lands on a whole pixel before it is ever added to a
  // baseline — `Math.trunc`, not `Math.floor`, because a C++ int conversion
  // rounds toward zero and a box SHORTER than its text makes both negative.
  // The engine's rasteriser floors again per glyph (`text_server_adv.cpp`'s
  // `TextServerAdvanced::_font_draw_glyph`, `cpos.y = Math::floor(cpos.y)`), so
  // an offset kept fractional here does not merely blur one line: under FILL it
  // is a per-gap separation, and its fraction accumulates into whole-row drift
  // by the last line.
  let vbeginPx = 0;
  let vsepPx = 0;
  switch (verticalAlignment ?? V_TOP) {
    case V_CENTER:
      vbeginPx = Math.trunc((boxHeightPx - contentHeightPx) / 2);
      break;
    case V_BOTTOM:
      vbeginPx = Math.trunc(boxHeightPx - contentHeightPx);
      break;
    case V_FILL:
      vsepPx = lineCount > 1 ? Math.trunc((boxHeightPx - contentHeightPx) / (lineCount - 1)) : 0;
      break;
    case V_TOP:
    default:
      break;
  }

  const effectivePitchPx = layout.linePitchPx + vsepPx;
  const isFill = (horizontalAlignment ?? H_LEFT) === H_FILL;

  return layout.lines.map((line, lineIndex) => {
    const y = vbeginPx + lineIndex * effectivePitchPx;
    if (isFill) {
      // label.h:46 default `jst_flags`: JUSTIFICATION_SKIP_LAST_LINE, EXCEPT
      // JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE overrides it when there is only
      // one line total (that line is both first and last).
      const skipJustify = lineCount > 1 && lineIndex === lineCount - 1;
      // `labelShapingWidthPx`, not the raw `boxWidthPx` the alignment branch
      // below uses — see `justifyLine`'s own doc for why Godot reads two
      // different widths here.
      return { x: 0, y, line: skipJustify ? line : justifyLine(line, labelShapingWidthPx(boxWidthPx)) };
    }
    return { x: horizontalOffsetPx(line.widthPx, boxWidthPx, horizontalAlignment), y, line };
  });
}
