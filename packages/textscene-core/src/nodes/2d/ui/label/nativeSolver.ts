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
import { AutowrapMode, shapeText, type TextLayoutResult, type TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
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

const AUTOWRAP_OFF = 0;

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
 * Shapes via `shapeText` DIRECTLY rather than through `ctx.measureText`
 * (still the presence GATE — an absent measurer still means "text
 * contributes nothing", exactly as before) so this function can attach the
 * shaped `TextLayoutResult` as `meta` when autowrap is OFF: `shapeText`
 * forces `effectiveWidth = 0` whenever `autowrapMode === OFF` regardless of
 * `boxWidthPx`, so THIS shape (unconstrained, `lineSpacingPx` = Label's own
 * 3px) is the IDENTICAL layout `Label`'s painter (`Component.tsx`) would
 * compute for the OFF case (its own default) — reused instead of re-shaped.
 * The autowrap-ON branch never attaches meta: its own minimum size already
 * substitutes the UNWRAPPED height for the unavailable "current width", so
 * the shape behind it is NOT what a box-constrained painter needs — no
 * reuse is correct there, and none is attempted.
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
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx,
    uppercase: props.uppercase,
    fontMetrics,
  });
  const measuredY = Math.max(0, layout.heightPx - lineSpacingPx);
  const height = Math.max(measuredY, fontHeightPx);

  if ((props.autowrapMode ?? AUTOWRAP_OFF) !== AUTOWRAP_OFF) {
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
      return { x: 0, y, line: skipJustify ? line : justifyLine(line, boxWidthPx) };
    }
    return { x: horizontalOffsetPx(line.widthPx, boxWidthPx, horizontalAlignment), y, line };
  });
}
