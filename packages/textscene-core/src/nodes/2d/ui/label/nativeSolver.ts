/**
 * Label's native rect solver: `Label::get_minimum_size` (`scene/gui/label.cpp:973-998`),
 * backed by `_update_visible` (`:344-388`) and `get_line_height` (`:111-136`), plus the
 * theme keys and defaults Label reads. Pure per-node math: `Component.tsx` paints.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { defineShare } from '../../../../r3f/controls/native/solveHandoff';
import {
  LABEL_SETTINGS_FONT_LOADING,
  type ShareNode,
  type SolveNode,
} from '../../../../r3f/controls/native/solveTree';
import { getFontLinePitchPx, type FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { peekSettledSceneFontMetrics } from '../../../../r3f/controls/native/text/sceneFontLoader';
import {
  clampAutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  startsParagraph,
  widestLineWidthPx,
  type TextLayoutResult,
  type TextLineLayout,
} from '../../../../r3f/controls/native/text/textLayout';
import { justifyParagraphs } from '../../../../r3f/controls/native/text/textJustify';
import {
  resolveTextOutline,
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
  type TextThemeProps,
} from '../../../../r3f/controls/native/textTheme';
import type { LabelProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import {
  AutowrapMode,
  OverrunBehavior,
  VisibleCharactersBehavior,
  DEFAULT_JUSTIFICATION_FLAGS,
} from '../../../../godot/text/textServerEnums';
import { controlBidiOptions } from '../../../../r3f/controls/native/text/textBidiOptions';

/** Label reads `theme_override_font_sizes/font_size` and `theme_override_colors/font_color`. */
const LABEL_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/**
 * Label's own theme font key, `SceneStringName(font)` (`scene/theme/default_theme.cpp:381`),
 * which {@link labelFontState} falls back to.
 */
const LABEL_THEME_FONT_KEY = 'font';

/**
 * `scene/theme/default_theme.cpp:392` sets Label's `line_spacing` to `Math::round(3 * scale)`,
 * 3 at UI scale 1.0. The Button family and LineEdit read no such key, RichTextLabel has its own
 * `line_separation` (0), and Label3D uses the authored value. The solve pass and `Component.tsx` shape
 * against this one constant, so they agree on the line pitch.
 */
export const LABEL_LINE_SPACING_PX = 3;

/** Label's `paragraph_spacing` theme constant: the default theme sets none, so it is 0. */
const LABEL_PARAGRAPH_SPACING_PX = 0;

/**
 * `Label.paragraph_separator`'s default (`label.cpp:158`, `c_unescape`'d). Label splits on it
 * before line-breaking and shapes each paragraph alone, so an empty paragraph stays a blank
 * line (`ShapeTextOptions.paragraphSeparator`).
 */
export const LABEL_PARAGRAPH_SEPARATOR = '\n';

/**
 * Label's default font colour is opaque white: `default_theme.cpp` sets `font_color` for
 * "Label" to `Color(1, 1, 1)`, not the `control_font_color` gray most other
 * widget types read.
 */
const LABEL_DEFAULT_FONT_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** This Label's theme font size and colour: its overrides, else the ancestor Theme chain, else the theme default, else Label's white (`resolveTextTheme`). */
export function labelTextTheme(
  n: ShareNode,
  props: TextThemeProps,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: LABEL_DEFAULT_FONT_COLOR };
  return resolveTextTheme(n, props, LABEL_THEME_KEYS, defaults);
}

interface LabelSpacing {
  lineSpacingPx: number;
  paragraphSpacingPx: number;
}

interface LabelEffectiveTextTheme extends LabelSpacing {
  fontSizePx: number;
  color: Rgba;
}

interface LabelFontState {
  metrics: FontMetrics;
  /** True while the settings font is unresolved: its file loads, or its metrics parse (ADR-0059). */
  isLoading: boolean;
}

/**
 * The font the Label shapes and draws in: `settings->get_font()` when it is valid, else the theme
 * font (`label.cpp:112,349,473,523,758,913,978,1024`). The solver and the painter both read this, so
 * the solved rect fits the drawn glyphs. A font still loading answers with the theme font, and the
 * painter draws nothing meanwhile. One peek serves both answers.
 */
export function labelFontState(n: ShareNode): LabelFontState {
  const font = n.labelSettingsFont;
  const settled =
    font === null || font === LABEL_SETTINGS_FONT_LOADING ? null : peekSettledSceneFontMetrics(font, n.path);
  if (settled) return { metrics: settled, isLoading: false };
  return { metrics: resolveNodeFontMetrics(n, LABEL_THEME_FONT_KEY), isLoading: font !== null };
}

/**
 * A valid `label_settings` replaces the theme, never merges with it, for `font_size` (label.cpp:186,759),
 * `font_color` (`:761`), `line_spacing` (`:346`) and `paragraph_spacing` (`:347`), even at a class default.
 * The two spacings are `real_t` stored in an `int`, so they truncate toward zero. Without settings they
 * are `constants`, resolved through the node's overrides and the Theme chain. `font` is {@link labelFontState}.
 */
export function labelEffectiveTextTheme(
  themeResolved: ResolvedTextTheme,
  settings: SolveNode['labelSettings'],
  constants: SolveNode['constants']
): LabelEffectiveTextTheme {
  if (!settings) {
    return {
      fontSizePx: themeResolved.fontSizePx,
      color: themeResolved.color,
      lineSpacingPx: constants['line_spacing'] ?? LABEL_LINE_SPACING_PX,
      paragraphSpacingPx: constants['paragraph_spacing'] ?? LABEL_PARAGRAPH_SPACING_PX,
    };
  }
  return {
    fontSizePx: settings.fontSize,
    color: settings.fontColor,
    lineSpacingPx: Math.trunc(settings.lineSpacing),
    paragraphSpacingPx: Math.trunc(settings.paragraphSpacing),
  };
}

/** `default_theme.cpp:385`: Label's `font_shadow_color` defaults to transparent, so a Label draws no shadow until a scene sets it. */
const LABEL_DEFAULT_SHADOW_COLOR: Rgba = { r: 0, g: 0, b: 0, a: 0 };
/**
 * `default_theme.cpp:388-391` sets `shadow_offset_x`, `shadow_offset_y` and `shadow_outline_size`
 * to `Math::round(1 * scale)`. Label's constants here are unscaled, as `LABEL_LINE_SPACING_PX` is.
 */
const LABEL_DEFAULT_SHADOW_OUTLINE_SIZE = 1;
const LABEL_DEFAULT_SHADOW_OFFSET = 1;

interface LabelOutlineTheme {
  size: number;
  color: Rgba;
}

/** `label.cpp:765-766`: `has_settings ? settings->get_outline_X() : theme_cache.font_outline_X`, the precedence `labelEffectiveTextTheme` states. */
export function labelOutlineTheme(n: SolveNode): LabelOutlineTheme {
  const settings = n.labelSettings;
  if (settings) return { size: settings.outlineSize, color: settings.outlineColor };
  const { color, sizePx } = resolveTextOutline(n);
  return { size: sizePx, color };
}

interface LabelShadowTheme {
  /** The shadow's own outline width (`LabelSettings.shadow_size` or the theme's `shadow_outline_size`), not a copy of the offset. */
  size: number;
  color: Rgba;
  offset: Vector2;
}

/** `label.cpp:762-767`: `has_settings ? settings->get_shadow_X() : theme_cache.font_shadow_X`, the precedence `labelEffectiveTextTheme` states. */
export function labelShadowTheme(n: SolveNode): LabelShadowTheme {
  const settings = n.labelSettings;
  if (settings)
    return { size: settings.shadowSize, color: settings.shadowColor, offset: settings.shadowOffset };
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
 * The width `Label::_shape` breaks lines at: `int width = (get_size().width - style->get_minimum_size().width)`
 * (`label.cpp:581`), where the style is Label's zero-size `StyleBoxEmpty` (`default_theme.cpp:379`).
 * The `int` wraps a word that fits in 320.6px but not in 320. The solver and `Component.tsx` share
 * this, so the solved height is the height of the drawn lines.
 */
export function labelShapingWidthPx(controlWidthPx: number): number {
  return Math.trunc(controlWidthPx);
}

// lines_skipped and max_lines_visible: label.cpp:344-361,520-561

interface LabelLineRange {
  start: number;
  end: number;
}

/**
 * The visible-line window of `Label::_update_visible` (`label.cpp:344-361`) and of
 * `get_layout_data` (`:520-561`): skip `linesSkipped` lines, then cap the rest at `maxLinesVisible`
 * (unset or negative means no limit), in every autowrap mode. Not ported: the clamp to the lines
 * that fit the rect height (`:533-548`, `comparison.md`).
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

function countParagraphs(lines: readonly TextLineLayout[]): number {
  let count = 0;
  for (let i = 0; i < lines.length; i++) if (startsParagraph(lines, i)) count++;
  return count;
}

/**
 * `layout.lines` cut to `range`, with height and width summed over the kept lines only, as
 * `_update_visible` and `get_layout_data` do (`label.cpp:359-361`, `:556-559`). The height holds
 * one `paragraphSpacingPx` per paragraph that keeps a line (`:381,:587`).
 */
export function windowLabelLines(
  layout: TextLayoutResult,
  range: LabelLineRange,
  paragraphSpacingPx: number
): TextLayoutResult {
  const lines = layout.lines.slice(range.start, range.end);
  const widthPx = widestLineWidthPx(lines);
  const heightPx = lines.length * layout.linePitchPx + countParagraphs(lines) * paragraphSpacingPx;
  return { ...layout, lines, heightPx, widthPx };
}

// visible_characters and visible_characters_behavior: label.cpp:778-883

/**
 * `Label::_shape`'s pre-shape reveal (`label.cpp:155-156`): `txt.substr(0, visible_chars)` before
 * line-breaking, so a typewriter reveal re-wraps as it grows. Other behaviours trim at draw time
 * (`applyVisibleCharsReveal`). An unset or negative `visibleChars` shows all.
 */
export function labelPreShapeText(
  text: string,
  visibleChars: number | undefined,
  behavior: number | undefined
): string {
  if (visibleChars === undefined || visibleChars < 0) return text;
  if (
    (behavior ?? VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING) !==
    VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING
  )
    return text;
  return text.slice(0, visibleChars);
}

interface VisibleCharsBudget {
  behavior: number;
  /** Final resolved `visible_chars`, the budget of CHARS_AFTER_SHAPING. */
  visibleChars: number | undefined;
  /** Final resolved `visible_ratio`, the budget of the GLYPHS_* behaviours. */
  visibleRatio: number | undefined;
  /** `is_layout_rtl()` (`SolveNode.rtl`), which picks the end GLYPHS_AUTO trims from (`label.cpp:779-780`). Defaults `false`. */
  rtl?: boolean;
}

/**
 * `draw_text`'s per-glyph `skip` (`label.cpp:778-780,label.h:197-240`) over lines already shaped
 * and windowed to `label.cpp`'s `start`/`end` (`:548-559`). CHARS_AFTER_SHAPING hides each glyph whose
 * source character is at or past the budget (`p_glyphs[j].end + p_para_start > p_visible_chars`). The
 * GLYPHS behaviours count glyphs in visual order: GLYPHS_LTR from the front, GLYPHS_RTL from the back
 * (`label.cpp:780`), and GLYPHS_AUTO picks by `rtl_layout` (`:779-780`).
 */
export function applyVisibleCharsReveal(
  lines: readonly TextLineLayout[],
  budget: VisibleCharsBudget
): TextLineLayout[] {
  if (budget.behavior === VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING) return [...lines];
  if (budget.behavior === VisibleCharactersBehavior.VC_CHARS_AFTER_SHAPING) {
    return revealCharacters(lines, budget.visibleChars);
  }
  return revealGlyphs(lines, budget);
}

/**
 * CHARS_AFTER_SHAPING. An ellipsis glyph has no source character: its `end` is -1 (`text_server.h:628`),
 * so it hides where `paragraphStart - 1 > visibleChars`.
 */
function revealCharacters(
  lines: readonly TextLineLayout[],
  visibleChars: number | undefined
): TextLineLayout[] {
  if (visibleChars === undefined || visibleChars < 0) return [...lines];
  return lines.map((line) => {
    const isEllipsisShown = (line.paragraphStart ?? 0) - 1 <= visibleChars;
    return {
      ...line,
      glyphs: line.glyphs.filter((glyph) =>
        glyph.sourceIndex === undefined ? isEllipsisShown : glyph.sourceIndex < visibleChars
      ),
    };
  });
}

/** The GLYPHS behaviours: `visible_ratio * total_glyphs` glyphs, counted in visual order across lines. */
function revealGlyphs(lines: readonly TextLineLayout[], budget: VisibleCharsBudget): TextLineLayout[] {
  if (budget.visibleRatio === undefined || budget.visibleRatio >= 1) return [...lines];
  const totalGlyphs = lines.reduce((sum, l) => sum + l.glyphs.length, 0);
  const limit = Math.trunc(totalGlyphs * Math.max(0, budget.visibleRatio));
  const fromEnd =
    budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_RTL ||
    (budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_AUTO && budget.rtl === true);
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
 * Label's shaped text with autowrap off, null when empty, shared through the solve handoff
 * (`r3f/controls/native/solveHandoff.ts`) by `labelMinimumSize` and `Component.tsx`. Only autowrap off is
 * pure in `(n, theme)`: with it on, this pass can still move the width, so each side shapes at its own.
 * It is windowed to `lines_skipped` and `max_lines_visible`, so never window it again.
 */
export const labelUnwrappedShape = defineShare<TextLayoutResult | null>((n, theme) => {
  const props = n.node.properties as LabelProperties;
  const text = labelPreShapeText(props.text ?? '', props.visibleCharacters, props.visibleCharactersBehavior);
  if (text.length === 0) return null;
  const { fontSizePx, lineSpacingPx, paragraphSpacingPx } = labelEffectiveTextTheme(
    labelTextTheme(n, props, { theme }),
    n.labelSettings,
    n.constants
  );
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx,
    uppercase: props.uppercase,
    fontMetrics: labelFontState(n).metrics,
    paragraphSeparator: props.paragraphSeparator ?? LABEL_PARAGRAPH_SEPARATOR,
    tabStopsPx: props.tabStopsPx,
    autowrapTrimFlags: props.autowrapTrimFlags,
    ...controlBidiOptions(props, n),
  });
  return windowLabelLines(
    layout,
    labelVisibleLineRange(layout.lines.length, props.linesSkipped ?? 0, props.maxLinesVisible),
    paragraphSpacingPx
  );
});

/**
 * `minsize.height` (`label.cpp:246-262`): the windowed extent, floored at one font line pitch.
 * `_update_visible` (`:344-388`) subtracts one trailing `line_spacing` and `paragraph_spacing`,
 * since the last line and paragraph carry no gap after them, while `windowLabelLines` counts both.
 */
function labelMinimumHeightPx(
  windowed: TextLayoutResult,
  spacing: LabelSpacing,
  fontHeightPx: number
): number {
  const extentPx =
    windowed.heightPx > 0 ? windowed.heightPx - spacing.lineSpacingPx - spacing.paragraphSpacingPx : 0;
  return Math.max(extentPx, fontHeightPx);
}

/**
 * `Label::get_minimum_size` (`:973-998`). Autowrap off (`:992-996`): {@link labelUnwrappedShape}'s widest
 * line (`:252-257`) by `_update_visible`'s height, plus a `min_style` that is zero for Label's `StyleBoxEmpty`
 * (`default_theme.cpp:379`). Autowrap on (`:984-991`): `Size2(1, height)`, with the height of the text
 * wrapped at `_shape`'s width (`:581,:227`).
 */
export const labelMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LabelProperties;
  const themeResolved = labelTextTheme(n, props, ctx);
  const spacing = labelEffectiveTextTheme(themeResolved, n.labelSettings, n.constants);
  const { fontSizePx } = spacing;
  const fontMetrics = labelFontState(n).metrics;
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);
  // `props.visibleCharacters` is already resolved (label.cpp:1285-1327). CHARS_BEFORE_SHAPING
  // truncates before shaping, so it runs before the empty-text gate. `uppercase` stays a `shapeText`
  // option (`label.cpp:154`), as in the painter's shape, so the rule lives in one place.
  const text = labelPreShapeText(props.text ?? '', props.visibleCharacters, props.visibleCharactersBehavior);

  // Empty text (`:239-241`): `Size2(1, get_line_height())`, and with no shaped lines
  // `get_line_height()` (`:125-134`) is the font height, with no `line_spacing`.
  if (text.length === 0) {
    return { x: 1, y: fontHeightPx };
  }

  // An absent measurer means the text contributes nothing.
  if (!ctx.measureText) return { x: 0, y: 0 };

  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.AUTOWRAP_OFF);
  if (autowrapMode !== AutowrapMode.AUTOWRAP_OFF) {
    // A bottom-up pass has no rect yet, so the first pass shapes unwrapped and the second reads the
    // width the first resolved (`SolveContext.tentativeRect`, `registerSizeDependentMinimum`). One
    // extra pass suffices: the width floor is 1 on every pass, so this height cannot move the width.
    // Godot does the same over frames (`:901-905`, `:339-341`, `container.cpp:33-36`).
    const shapedWidthPx = ctx.tentativeRect?.(n)?.w;
    const wrapped = shapeText(text, {
      fontSizePx,
      boxWidthPx: shapedWidthPx === undefined ? 0 : labelShapingWidthPx(shapedWidthPx),
      autowrapMode: shapedWidthPx === undefined ? AutowrapMode.AUTOWRAP_OFF : autowrapMode,
      lineSpacingPx: spacing.lineSpacingPx,
      uppercase: props.uppercase,
      fontMetrics,
      paragraphSeparator: props.paragraphSeparator ?? LABEL_PARAGRAPH_SEPARATOR,
      tabStopsPx: props.tabStopsPx,
      autowrapTrimFlags: props.autowrapTrimFlags,
      ...controlBidiOptions(props, n),
    });
    // Not modelled: `min_size.height = 1` and the `max_lines_visible` clamp (`:985-987`), which
    // need `clip` or an `overrun_behavior` other than `OVERRUN_NO_TRIMMING`.
    const range = labelVisibleLineRange(wrapped.lines.length, props.linesSkipped ?? 0, props.maxLinesVisible);
    const windowed = windowLabelLines(wrapped, range, spacing.paragraphSpacingPx);
    return { x: 1, y: labelMinimumHeightPx(windowed, spacing, fontHeightPx) };
  }

  // Non-null: empty text, the share's only null, returned above.
  const windowed = labelUnwrappedShape(n, ctx.theme)!;
  const height = labelMinimumHeightPx(windowed, spacing, fontHeightPx);
  // `minsize.width` is the widest line's ceiled `shaped_text_get_size(...).x` (`label.cpp:252-257`).
  // The max of the ceils is the ceil of the max, so the widest raw line converts once.
  // `clip_text` or an overrun behaviour other than NO_TRIMMING drops the width floor to 1
  // (label.cpp:993-995), since a narrower box trims the text.
  const overrunBehavior = props.overrunBehavior ?? OverrunBehavior.OVERRUN_NO_TRIMMING;
  const widthPx =
    props.clipText || overrunBehavior !== OverrunBehavior.OVERRUN_NO_TRIMMING
      ? 1
      : shapedTextSizeWidthPx(windowed.widthPx);
  return { x: widthPx, y: height };
};

// Draw-time layout: per-line placement and the vertical origin.

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
  /** This line's box-top Y, box-local Godot px. A single-line `<TextRun>` anchors the line at its baseline from here (`buildGlyphQuadArrays`), where Godot draws it. */
  y: number;
  /** This line for its own `<TextRun>`: justified for `HORIZONTAL_ALIGNMENT_FILL`, else unchanged. */
  line: TextLineLayout;
}

/**
 * `Label::_get_line_rect`'s x (`label.cpp:487-512`). H_CENTER writes `int(size.width - line_size.width) / 2`
 * and H_RIGHT `int(size.width - margin - line_size.width)`, both truncating toward zero. A box narrower
 * than its line (only with `clip_text`) makes the difference negative, where `Math.floor` is a pixel
 * off. `margin` is zero for Label's `StyleBoxEmpty` (`default_theme.cpp:379`).
 */
function horizontalOffsetPx(
  lineWidthPx: number,
  boxWidthPx: number,
  alignment: number | undefined,
  direction: LineDirection
): number {
  const { rtl, isRtlParagraph, isAutowrapped } = direction;
  // `rtl_layout` swaps the two arms outright (`:481-497`): LEFT takes the
  // trailing-edge expression and RIGHT takes `style->get_offset().x`, which is
  // zero for the StyleBoxEmpty above. CENTER carries no arm. FILL's own arm reads
  // the inferred paragraph direction instead (`:472-478`).
  const trailingEdge = Math.trunc(boxWidthPx - lineWidthPx);
  switch (alignment ?? H_LEFT) {
    case H_CENTER:
      // Transcribed as written: `trunc(trunc(d) / 2)` equals `trunc(d / 2)` for every real d.
      return Math.trunc(Math.trunc(boxWidthPx - lineWidthPx) / 2);
    case H_RIGHT:
      return rtl ? 0 : trailingEdge;
    case H_LEFT:
      return rtl ? trailingEdge : 0;
    case H_FILL:
      return isRtlParagraph && isAutowrapped ? trailingEdge : 0;
    default:
      return 0;
  }
}

/** The two directions `_get_line_rect`'s x reads (`label.cpp:470-471`), and the autowrap gate of FILL's arm. */
interface LineDirection {
  /** `is_layout_rtl()`. */
  rtl: boolean;
  /** `shaped_text_get_inferred_direction() == DIRECTION_RTL` of the line's paragraph. */
  isRtlParagraph: boolean;
  isAutowrapped: boolean;
}

interface LabelLayoutOptions extends Partial<LabelSpacing> {
  // The spacings default to Label's theme defaults, which the Graph titlebar's title Label uses.
  /** `is_layout_rtl()` (`SolveNode.rtl`). Defaults `false`. */
  rtl?: boolean;
  /** `autowrap_mode != AUTOWRAP_OFF`, the gate of FILL's RTL arm (`label.cpp:473`). Defaults `false`. */
  isAutowrapped?: boolean;
  /** The overrun trim `_shape` runs on each line after the fit, before `_get_line_rect` aligns it (`label.cpp:319-330`). */
  trim?: LineTrim;
}

/** The two overrun trims of `_shape` with autowrap off (`label.cpp:319-330`). */
export interface LineTrim {
  /** Trims a line that FILL did not fit first. */
  line: (line: TextLineLayout) => TextLineLayout;
  /** Trims a line FILL fitted, then fits it again with `justificationFlags` (`label.cpp:325`). */
  filledLine: (line: TextLineLayout, justificationFlags: number) => TextLineLayout;
}

/**
 * Whether the fit of a line stopped above the smallest spaces: `fit_width_minimum_reached` is false
 * (`text_server_adv.cpp:5660`), so a justification-aware trim returns early (`:5947`).
 */
function isFitAboveMinimum(fitted: TextLineLayout, widthPx: number): boolean {
  return Math.floor(widthPx) >= Math.floor(fitted.widthPx);
}

/**
 * Per-line placement for `horizontal_alignment` and `vertical_alignment` (`_get_line_rect`'s x,
 * `get_layout_data`'s vbegin and vsep, `label.cpp:592-617`). Godot aligns each line by its own
 * width, which one merged `<TextRun>` cannot express, so each placement is for its own `<TextRun>`.
 */
export function layoutLabelLines(
  layout: TextLayoutResult,
  boxWidthPx: number,
  boxHeightPx: number,
  horizontalAlignment: number | undefined,
  verticalAlignment: number | undefined,
  justificationFlags: number = DEFAULT_JUSTIFICATION_FLAGS,
  options: LabelLayoutOptions = {}
): LabelLinePlacement[] {
  const {
    rtl = false,
    isAutowrapped = false,
    trim,
    lineSpacingPx = LABEL_LINE_SPACING_PX,
    paragraphSpacingPx = LABEL_PARAGRAPH_SPACING_PX,
  } = options;
  const lineCount = layout.lines.length;
  if (lineCount === 0) return [];

  // label.cpp:599: `total_h - line_spacing - paragraph_spacing`. `labelMinimumSize` applies the same correction.
  const contentHeightPx = layout.heightPx - lineSpacingPx - paragraphSpacingPx;

  // `get_layout_data` declares `int vbegin = 0, vsep = 0` (`label.cpp:591`), so each offset
  // truncates toward zero to a whole pixel, negative when the box is shorter than the text. The
  // rasteriser floors per glyph (`text_server_adv.cpp`'s `_font_draw_glyph`), so a fractional
  // vsep under FILL would add up per gap into whole-row drift by the last line.
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
  // `ofs.y += paragraph_spacing` after each paragraph's last shown line (`label.cpp:889`).
  let paragraphGapsAbovePx = 0;
  const isFill = (horizontalAlignment ?? H_LEFT) === H_FILL;
  const shapingWidthPx = labelShapingWidthPx(boxWidthPx);
  // `_shape` justifies at the truncated `int width` it broke the lines at (`label.cpp:297,331`),
  // not the raw `get_size()` that `_get_line_rect` reads.
  const fitted = isFill
    ? justifyParagraphs(layout.lines, {
        widthPx: shapingWidthPx,
        flags: justificationFlags,
      })
    : layout.lines;
  // With autowrap off, FILL trims `OVERRUN_JUSTIFICATION_AWARE` (`label.cpp:322-325`).
  const isTrimJustificationAware = isFill && !isAutowrapped;
  const lines = trim
    ? fitted.map((line, index) => {
        const shaped = layout.lines[index]!;
        if (!isTrimJustificationAware || line === shaped) return trim.line(line);
        return isFitAboveMinimum(line, shapingWidthPx) ? line : trim.filledLine(line, justificationFlags);
      })
    : fitted;

  return lines.map((line, lineIndex) => {
    if (lineIndex > 0 && startsParagraph(lines, lineIndex)) {
      paragraphGapsAbovePx += paragraphSpacingPx;
    }
    const y = vbeginPx + lineIndex * effectivePitchPx + paragraphGapsAbovePx;
    // `_get_line_rect` aligns against the ceiled `TS->shaped_text_get_size(rid)` (`label.cpp:478`),
    // not the raw pen advance the fit needs.
    const direction = { rtl, isRtlParagraph: line.isRtl === true, isAutowrapped };
    return {
      x: horizontalOffsetPx(shapedTextSizeWidthPx(line.widthPx), boxWidthPx, horizontalAlignment, direction),
      y,
      line,
    };
  });
}
