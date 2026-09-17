/**
 * Label's native (WebGL canvas) rect solver — `Label::get_minimum_size`
 * (`scene/gui/label.cpp:973-998`), backed by `_update_visible` (`:344-388`)
 * and `get_line_height` (`:111-136`); plus the theme-override key mapping
 * (`font_size`/`font_color`) and default colour Label reads. Registered via
 * `controlSolverRegistry.registerMinimumSize`. Pure per-node math, no
 * THREE/React — painting is `Component.tsx`'s job.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { AutowrapMode, clampAutowrapMode, isWhitespace, shapeText, shapedTextSizeWidthPx, type TextLayoutResult, type TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { OverrunBehavior } from '../../../../r3f/controls/native/text/textOverrun';
import { JustificationFlag, fitLineToWidth } from '../../../../r3f/controls/native/text/textJustify';
import { resolveTextTheme, type ResolvedTextTheme, type TextThemeDefaults, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import type { TscnInternalResource } from '../../../../parser/types';
import { resolveLabelSettings } from '../../../../resources/styles/labelsettings/decode';
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
 * `scene/theme/default_theme.cpp:392` — Label is the one text control whose
 * theme sets `line_spacing`, at `Math::round(3 * scale)`, i.e. 3 at UI scale
 * 1.0. Named here, in Label's own slice, because it is Label's constant:
 * every Button-family widget and LineEdit read no such key at all,
 * RichTextLabel has its own `line_separation` (0), and Label3D uses the
 * node's authored value. Both the solve pass and `Component.tsx` shape
 * against this one constant, so the two cannot disagree about the pitch of
 * the same Label.
 */
export const LABEL_LINE_SPACING_PX = 3;

/**
 * `Label.paragraph_separator`'s default (`label.cpp:158`, `paragraph_separator`
 * `c_unescape`'d). Label splits on it BEFORE line-breaking and shapes each
 * paragraph on its own, which is what keeps an empty one as a blank line — see
 * `ShapeTextOptions.paragraphSeparator`. The property itself is not parsed
 * today, so every Label shapes at the engine default.
 */
export const LABEL_PARAGRAPH_SEPARATOR = '\n';

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

/** This node's own `label_settings` resource, resolved in ITS OWN scope — undefined ref, an ExtResource (not modelled, see `comparison.md`) or an unresolved id all fall through to null, "no settings". */
export function resolveNodeLabelSettings(
  props: LabelProperties,
  internalResources: readonly TscnInternalResource[]
) {
  return props.labelSettings ? resolveLabelSettings(props.labelSettings, internalResources) : null;
}

export interface LabelEffectiveTextTheme {
  fontSizePx: number;
  color: ControlColor;
  lineSpacingPx: number;
}

/**
 * A valid `label_settings` beats the theme OUTRIGHT — not merged with it —
 * for `font_size` (label.cpp:186,759), `font_color` (`:761`) and
 * `line_spacing` (`:346`): each reads `settings.is_valid() ? settings->get_X()
 * : theme_cache.X`, so a node-local `theme_override_*` is bypassed entirely
 * once `label_settings` is set, even where the RESOURCE'S OWN field is left
 * at its class default. `get_line_spacing()` returns a `real_t` assigned into
 * a C++ `int`, truncated toward zero (`Math.trunc`, not `Math.floor` — see
 * `horizontalOffsetPx`'s own doc for why the two can disagree).
 *
 * `font` is the one exception (`:185`): it falls through to the theme when
 * the RESOURCE's own `font` is unset, and even when set is NOT ported here —
 * this previewer's font-metrics resolution has no by-reference path (only a
 * node's own theme chain), so every Label still shapes in its OWN theme font
 * regardless of `label_settings.font` (`comparison.md`).
 */
export function labelEffectiveTextTheme(
  themeResolved: ResolvedTextTheme,
  settings: ReturnType<typeof resolveNodeLabelSettings>
): LabelEffectiveTextTheme {
  if (!settings) {
    return { fontSizePx: themeResolved.fontSizePx, color: themeResolved.color, lineSpacingPx: LABEL_LINE_SPACING_PX };
  }
  return {
    fontSizePx: settings.fontSize,
    color: settings.fontColor,
    lineSpacingPx: Math.trunc(settings.lineSpacing),
  };
}

/** `default_theme.cpp:386` — Label's `font_outline_color` default, opaque black (a DIFFERENT literal from `font_shadow_color`'s transparent one below). */
const LABEL_DEFAULT_OUTLINE_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 1 };
/** `default_theme.cpp:385` — Label's `font_shadow_color` default is TRANSPARENT, so a Label draws no shadow until a scene sets this. */
const LABEL_DEFAULT_SHADOW_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 0 };
/**
 * `default_theme.cpp:388-391` — `shadow_offset_x`/`shadow_offset_y`/
 * `shadow_outline_size` are each `Math::round(1 * scale)`; this previewer's
 * Label constants are UNSCALED literals already (`LABEL_LINE_SPACING_PX`'s
 * own `round(3*scale)` source is likewise the flat `3` here), so `1` follows
 * that same established precedent rather than introducing scale-threading
 * this file alone.
 */
const LABEL_DEFAULT_SHADOW_OUTLINE_SIZE = 1;
const LABEL_DEFAULT_SHADOW_OFFSET = 1;

export interface LabelOutlineTheme {
  size: number;
  color: ControlColor;
}

/** `label.cpp:765-766` — `has_settings ? settings->get_outline_X() : theme_cache.font_outline_X`, same OUTRIGHT precedence `labelEffectiveTextTheme` documents. */
export function labelOutlineTheme(n: SolveNode, settings: ReturnType<typeof resolveNodeLabelSettings>): LabelOutlineTheme {
  if (settings) return { size: settings.outlineSize, color: settings.outlineColor };
  return {
    size: n.constants['outline_size'] ?? 0,
    color: n.colors['font_outline_color'] ?? LABEL_DEFAULT_OUTLINE_COLOR,
  };
}

export interface LabelShadowTheme {
  /** The shadow's OWN outline-expand width — `LabelSettings.shadow_size` / the theme's `shadow_outline_size` constant, NOT merely a plain offset copy. */
  size: number;
  color: ControlColor;
  offset: Vec2;
}

/** `label.cpp:762-767` — `has_settings ? settings->get_shadow_X() : theme_cache.font_shadow_X`, same OUTRIGHT precedence `labelEffectiveTextTheme` documents. */
export function labelShadowTheme(n: SolveNode, settings: ReturnType<typeof resolveNodeLabelSettings>): LabelShadowTheme {
  if (settings) return { size: settings.shadowSize, color: settings.shadowColor, offset: settings.shadowOffset };
  return {
    size: n.constants['shadow_outline_size'] ?? LABEL_DEFAULT_SHADOW_OUTLINE_SIZE,
    color: n.colors['font_shadow_color'] ?? LABEL_DEFAULT_SHADOW_COLOR,
    offset: {
      x: n.constants['shadow_offset_x'] ?? LABEL_DEFAULT_SHADOW_OFFSET,
      y: n.constants['shadow_offset_y'] ?? LABEL_DEFAULT_SHADOW_OFFSET,
    },
  };
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

// --- lines_skipped / max_lines_visible: label.cpp:344-361,520-561 ----------

export interface LabelLineRange {
  start: number;
  end: number;
}

/**
 * `Label::_update_visible`'s own visible-line window (`label.cpp:344-361`),
 * shared by `get_layout_data`'s draw-time window (`:520-561`): drop the
 * first `linesSkipped` lines, then cap what remains to at most
 * `maxLinesVisible` (unset or negative — the "no limit" sentinel — leaves it
 * uncapped). Applies REGARDLESS of autowrap — `minsize.height` always
 * reflects this window, and so does the draw pass.
 *
 * NOT ported: `get_layout_data`'s OWN further clamp of `lines_visible` to
 * however many lines fit the control's rect height (`:533-548`) — a
 * DIFFERENT, always-on limit this previewer does not model at all (a Label
 * taller than its rect already overflows visibly here); see `comparison.md`.
 */
export function labelVisibleLineRange(
  totalLines: number,
  linesSkipped: number,
  maxLinesVisible: number | undefined
): LabelLineRange {
  let linesVisible = totalLines;
  if (maxLinesVisible !== undefined && maxLinesVisible >= 0 && linesVisible > maxLinesVisible) {
    linesVisible = maxLinesVisible;
  }
  const start = Math.min(Math.max(0, linesSkipped), totalLines);
  const end = Math.max(start, Math.min(totalLines, linesVisible + linesSkipped));
  return { start, end };
}

/**
 * `layout.lines` windowed to `range`, as its own `TextLayoutResult` —
 * `heightPx`/`widthPx` recomputed over the KEPT lines only, matching how
 * `_update_visible`/`get_layout_data` sum only the visible window's own line
 * metrics, never a hidden line's (`label.cpp:359-361`, `:556-559`).
 */
export function windowLabelLines(layout: TextLayoutResult, range: LabelLineRange): TextLayoutResult {
  const lines = layout.lines.slice(range.start, range.end);
  const widthPx = lines.reduce((max, l) => Math.max(max, l.widthPx), 0);
  return { ...layout, lines, heightPx: lines.length * layout.linePitchPx, widthPx };
}

// --- visible_characters / visible_characters_behavior: label.cpp:778-883 ---

/** `TextServer::VisibleCharactersBehavior` (`servers/text/text_server.h:90-96`). Godot default 0 (`label.h:74`). */
export const VC_CHARS_BEFORE_SHAPING = 0;
export const VC_CHARS_AFTER_SHAPING = 1;
export const VC_GLYPHS_AUTO = 2;
export const VC_GLYPHS_LTR = 3;
export const VC_GLYPHS_RTL = 4;

/**
 * `Label::_shape`'s pre-shape reveal (`label.cpp:155-156`): `txt.substr(0,
 * visible_chars)`, applied BEFORE line-breaking, so it changes which glyphs
 * exist at all rather than merely which ones draw — a typewriter reveal at
 * this behaviour re-wraps as it grows. A no-op for every other behaviour
 * (those trim at DRAW time instead — `applyVisibleCharsReveal`) or an
 * unset/negative `visibleChars` ("show all").
 */
export function labelPreShapeText(text: string, visibleChars: number | undefined, behavior: number | undefined): string {
  if (visibleChars === undefined || visibleChars < 0) return text;
  if ((behavior ?? VC_CHARS_BEFORE_SHAPING) !== VC_CHARS_BEFORE_SHAPING) return text;
  return text.slice(0, visibleChars);
}

export interface VisibleCharsBudget {
  behavior: number;
  /** Final resolved `visible_chars` — CHARS_AFTER_SHAPING's own budget. */
  visibleChars: number | undefined;
  /** Final resolved `visible_ratio` — the two GLYPHS_* behaviours' own budget. */
  visibleRatio: number | undefined;
  /** `is_layout_rtl()` (`SolveNode.rtl`) — GLYPHS_AUTO's own end (`label.cpp:779-780`). Defaults `false`. */
  rtl?: boolean;
}

/**
 * `draw_text`'s per-glyph `skip` union (`label.cpp:778-780,label.h:197-240`),
 * applied to an already shaped-and-windowed set of lines (this previewer's
 * `lines_skipped`/`max_lines_visible` window, `label.cpp`'s own `start`/`end`
 * bound on the SAME `total_glyphs` count, `:548-559`). CHARS_AFTER_SHAPING
 * counts CHARACTERS from the front; GLYPHS_LTR/AUTO count GLYPHS from the
 * front and GLYPHS_RTL from the BACK (`trim_glyphs_rtl`'s own condition,
 * `label.cpp:780`). GLYPHS_LTR and GLYPHS_RTL name their end outright; only
 * GLYPHS_AUTO reads `rtl_layout` (`:779-780`), so an LTR scene can still
 * select the opposite-end reveal explicitly. One glyph is one source
 * character in this engine's atlas shaping (no ligatures), so the character
 * and glyph counts coincide — except across a TRIMMED edge space, which
 * `TextLineLayout` carries no source index for; see `comparison.md`.
 * CHARS_BEFORE_SHAPING is a no-op here — it already ran pre-shape.
 */
export function applyVisibleCharsReveal(lines: readonly TextLineLayout[], budget: VisibleCharsBudget): TextLineLayout[] {
  if (budget.behavior === VC_CHARS_BEFORE_SHAPING) return [...lines];

  let limit: number;
  let fromEnd = false;
  if (budget.behavior === VC_CHARS_AFTER_SHAPING) {
    if (budget.visibleChars === undefined || budget.visibleChars < 0) return [...lines];
    limit = budget.visibleChars;
  } else {
    if (budget.visibleRatio === undefined || budget.visibleRatio >= 1) return [...lines];
    const totalGlyphs = lines.reduce((sum, l) => sum + l.glyphs.length, 0);
    limit = Math.trunc(totalGlyphs * Math.max(0, budget.visibleRatio));
    fromEnd = budget.behavior === VC_GLYPHS_RTL || (budget.behavior === VC_GLYPHS_AUTO && budget.rtl === true);
  }

  const totalGlyphs = lines.reduce((sum, l) => sum + l.glyphs.length, 0);
  const hideBefore = fromEnd ? totalGlyphs - limit : 0;
  let seen = 0;
  return lines.map((line) => ({
    ...line,
    glyphs: line.glyphs.filter(() => {
      const keep = fromEnd ? seen >= hideBefore : seen < limit;
      seen++;
      return keep;
    }),
  }));
}

/**
 * `Label::get_minimum_size` (`:973-998`). Two branches:
 *
 * - autowrap OFF (`:992-996`): `minsize + min_style` — `min_style` is zero
 *   for Label's default `StyleBoxEmpty` (`theme_cache.normal_style`,
 *   `default_theme.cpp:379`) and not modelled here (no `theme_override_styles`
 *   chrome for Label). `minsize.width` is the WIDEST
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
 * gaps. Shaping at `LABEL_LINE_SPACING_PX` returns `N * linePitchPx` with no such
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
  const settings = resolveNodeLabelSettings(props, n.resources.internalResources);
  const themeResolved = labelTextTheme(n, props, ctx);
  const { fontSizePx, lineSpacingPx } = labelEffectiveTextTheme(themeResolved, settings);
  const fontMetrics = resolveNodeFontMetrics(n, LABEL_THEME_FONT_KEY);
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);
  // `visible_chars`/`visible_characters_behavior` are handed to `parseLabel`'s
  // OWN cross-derivation, so `props.visibleCharacters` is already the FINAL
  // resolved int (label.cpp:1285-1327's own doc). CHARS_BEFORE_SHAPING (the
  // default) truncates BEFORE shaping, so it must run before the empty-text
  // gate below — a Label revealed to 0 characters shapes as empty.
  // Raw, with `uppercase` handed to `shapeText` as an option rather than
  // pre-applied here: the painter's own fallback shape passes the option too,
  // and one rule implemented in two places agrees only for as long as both
  // spellings happen to match. Emptiness is unaffected by case, so the
  // early-out below reads the same either way.
  const text = labelPreShapeText(props.text ?? '', props.visibleCharacters, props.visibleCharactersBehavior);

  if (text.length === 0) {
    return { x: 1, y: fontHeightPx };
  }

  if (!ctx.measureText) return { x: 0, y: 0 };

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
    paragraphSeparator: props.paragraphSeparator ?? LABEL_PARAGRAPH_SEPARATOR,
    tabStopsPx: props.tabStopsPx,
    autowrapTrimFlags: props.autowrapTrimFlags,
  });
  // `_update_visible` windows to `lines_skipped`/`max_lines_visible`
  // REGARDLESS of autowrap (its own doc) — Label's own `line_spacing`
  // separates lines without adding a trailing gap, which the `-
  // lineSpacingPx` below guarantees, so nothing is added back for a single
  // line.
  const range = labelVisibleLineRange(layout.lines.length, props.linesSkipped ?? 0, props.maxLinesVisible);
  const windowed = windowLabelLines(layout, range);
  const measuredY = Math.max(0, windowed.heightPx - lineSpacingPx);
  const height = Math.max(measuredY, fontHeightPx);

  if (autowrapMode !== AutowrapMode.OFF) {
    return { size: { x: 1, y: height } };
  }
  // `minsize.width` is the widest line's `shaped_text_get_size(...).x`
  // (`label.cpp:252-257`), i.e. the CEILED extent, not the pen advance —
  // `max` over per-line ceils and the ceil of the max agree, so the widest
  // raw line converts once here rather than per line.
  //
  // label.cpp:993-995: `clip_text` or any non-NO_TRIMMING overrun behaviour
  // collapses the width floor to 1 — the box no longer needs to be wide
  // enough for the full content, since a narrower one just trims it. The
  // `max_lines_visible > 0` branch above this in the source (:985-987) is a
  // NARROWER, additional clamp this slice does not model (needs autowrap ON,
  // which this branch never reaches anyway — see `comparison.md`).
  const overrunBehavior = props.overrunBehavior ?? OverrunBehavior.NO_TRIMMING;
  const widthPx =
    props.clipText || overrunBehavior !== OverrunBehavior.NO_TRIMMING ? 1 : shapedTextSizeWidthPx(windowed.widthPx);
  return { size: { x: widthPx, y: height }, meta: windowed };
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

/** `Label.jst_flags`'s own default (`label.h:46`) — every Label justifies as if it set exactly these, absent a scene override. */
export const LABEL_DEFAULT_JUSTIFICATION_FLAGS =
  JustificationFlag.WORD_BOUND | JustificationFlag.KASHIDA | JustificationFlag.SKIP_LAST_LINE | JustificationFlag.DO_NOT_SKIP_SINGLE_LINE;

/** `TS->shaped_text_has_visible_chars` reduced to this engine's charset: any glyph whose own character is not whitespace. */
function lineHasVisibleChars(line: TextLineLayout): boolean {
  return line.glyphs.some((g) => !isWhitespace(g.char.codePointAt(0)!));
}

/**
 * How many of `lines` (from the start) get justified — `label.cpp:304-319`'s
 * `jst_to_line` computation, shared by the autowrap-OFF branch this Label
 * slice models (the autowrap-ON one at `:273-289` re-derives the identical
 * three flags for its own `lines_hidden` case, out of scope here — see
 * `LabelProperties.overrunBehavior`'s own doc).
 */
function justifyToLineIndex(lines: TextLineLayout[], flags: number): number {
  if (lines.length === 1 && flags & JustificationFlag.DO_NOT_SKIP_SINGLE_LINE) return lines.length;
  let jstToLine = lines.length;
  if (flags & JustificationFlag.SKIP_LAST_LINE) jstToLine = lines.length - 1;
  if (flags & JustificationFlag.SKIP_LAST_LINE_WITH_VISIBLE_CHARS) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lineHasVisibleChars(lines[i]!)) {
        jstToLine = i;
        break;
      }
    }
  }
  return jstToLine;
}

/**
 * `Label::_get_line_rect`'s x (`label.cpp:487-512`). Both non-zero
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
function horizontalOffsetPx(lineWidthPx: number, boxWidthPx: number, alignment: number | undefined, rtl: boolean): number {
  // `rtl_layout` swaps the two arms outright (`:481-497`): LEFT takes the
  // trailing-edge expression and RIGHT takes `style->get_offset().x`, which is
  // zero for the StyleBoxEmpty above. CENTER carries no arm.
  const trailingEdge = Math.trunc(boxWidthPx - lineWidthPx);
  switch (alignment ?? H_LEFT) {
    case H_CENTER:
      return Math.trunc(Math.trunc(boxWidthPx - lineWidthPx) / 2);
    case H_RIGHT:
      return rtl ? 0 : trailingEdge;
    case H_LEFT:
      return rtl ? trailingEdge : 0;
    case H_FILL:
    default:
      return 0;
  }
}

/**
 * `_get_line_rect`'s x reads TWO directions (`label.cpp:470-471`). Only
 * `rtl_layout` is here: the other is the shaped PARAGRAPH direction, which
 * `text_direction` decides, and its default is `TEXT_DIRECTION_AUTO`
 * (`label.h:70`), not INHERITED — so `:179` never hands `is_layout_rtl()` to
 * the TextServer at the default and the inferred direction stays LTR for any
 * Latin paragraph (`text_server_adv.cpp:7241-7247`). FILL's own arm (`:472`)
 * is therefore unreachable while `text_direction` is unmodelled;
 * `comparison.md` records it.
 */
export interface LabelLayoutDirection {
  /** `is_layout_rtl()` (`SolveNode.rtl`). Defaults `false`. */
  rtl?: boolean;
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
  justificationFlags: number = LABEL_DEFAULT_JUSTIFICATION_FLAGS,
  // Only feeds `fitLineToWidth`'s 0.1*font_size SHRINK floor; every existing
  // caller/test predates this parameter and justifies at the theme default (16).
  fontSizePx: number = 16,
  direction: LabelLayoutDirection = {}
): LabelLinePlacement[] {
  const { rtl = false } = direction;
  const lineCount = layout.lines.length;
  if (lineCount === 0) return [];

  const lineSpacingPx = LABEL_LINE_SPACING_PX;
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
  const jstToLine = isFill ? justifyToLineIndex(layout.lines, justificationFlags) : 0;
  // `labelShapingWidthPx`, not the raw `boxWidthPx` the alignment branch below
  // uses — `_shape` justifies at the same truncated `int width` it broke the
  // lines at (`label.cpp:297,331`), not the raw `get_size()` `_get_line_rect` reads.
  const fitWidthPx = labelShapingWidthPx(boxWidthPx);

  return layout.lines.map((line, lineIndex) => {
    const y = vbeginPx + lineIndex * effectivePitchPx;
    if (isFill) {
      const justified =
        lineIndex < jstToLine
          ? fitLineToWidth(line, fitWidthPx, justificationFlags, { fontSizePx }).line
          : line;
      return { x: 0, y, line: justified };
    }
    // `_get_line_rect` aligns against `line_size = TS->shaped_text_get_size(rid)`
    // (`label.cpp:478`), the ceiled extent — NOT the raw pen advance
    // `fitLineToWidth` above needs.
    return { x: horizontalOffsetPx(shapedTextSizeWidthPx(line.widthPx), boxWidthPx, horizontalAlignment, rtl), y, line };
  });
}
