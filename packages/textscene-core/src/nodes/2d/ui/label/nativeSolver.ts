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
import { defineShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
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
 * Label's own theme font key, `SceneStringName(font)` (`scene/theme/default_theme.cpp:381`).
 * {@link labelUnwrappedShape} and `Component.tsx`'s autowrap-on re-shape both pass it to
 * `resolveNodeFontMetrics`, so the two shape in the same font.
 */
export const LABEL_THEME_FONT_KEY = 'font';

/**
 * `scene/theme/default_theme.cpp:392` sets Label's `line_spacing` to `Math::round(3 * scale)`,
 * 3 at UI scale 1.0. The Button family and LineEdit read no such key, RichTextLabel has its own
 * `line_separation` (0), and Label3D uses the authored value. The solve pass and `Component.tsx` shape
 * against this one constant, so they agree on the line pitch.
 */
export const LABEL_LINE_SPACING_PX = 3;

/**
 * `Label.paragraph_separator`'s default (`label.cpp:158`, `c_unescape`'d). Label splits on it
 * before line-breaking and shapes each paragraph alone, so an empty paragraph stays a blank
 * line (`ShapeTextOptions.paragraphSeparator`).
 */
export const LABEL_PARAGRAPH_SEPARATOR = '\n';

/**
 * Label's default font colour is opaque white: `default_theme.cpp` sets `font_color` for
 * "Label" to `Color(1, 1, 1)`, not the `control_font_color` gray (`DEFAULT_FONT_COLOR`) most
 * other widget types read.
 */
export const LABEL_DEFAULT_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

/** This Label's theme font size and colour: its overrides, else the ancestor Theme chain, else the theme default, else Label's white (`resolveTextTheme`). */
export function labelTextTheme(
  n: ShareNode,
  props: LabelProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: LABEL_DEFAULT_FONT_COLOR };
  return resolveTextTheme(n, props, LABEL_THEME_KEYS, defaults);
}

/** This node's own `label_settings`, resolved in its own scope. An unset ref, an ExtResource (not modelled, see `comparison.md`) or an unresolved id gives null: no settings. */
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
 * A valid `label_settings` replaces the theme, never merges with it, for `font_size`
 * (label.cpp:186,759), `font_color` (`:761`) and `line_spacing` (`:346`), even where a field keeps
 * its class default. `get_line_spacing()` is a `real_t` stored in an `int`, so it truncates toward
 * zero. `font` (`:185`) is not ported: Label shapes in its theme font (`comparison.md`).
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

/** `default_theme.cpp:386`: Label's `font_outline_color` defaults to opaque black. */
const LABEL_DEFAULT_OUTLINE_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 1 };
/** `default_theme.cpp:385`: Label's `font_shadow_color` defaults to transparent, so a Label draws no shadow until a scene sets it. */
const LABEL_DEFAULT_SHADOW_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 0 };
/**
 * `default_theme.cpp:388-391` sets `shadow_offset_x`, `shadow_offset_y` and `shadow_outline_size`
 * to `Math::round(1 * scale)`. Label's constants here are unscaled, as `LABEL_LINE_SPACING_PX` is.
 */
const LABEL_DEFAULT_SHADOW_OUTLINE_SIZE = 1;
const LABEL_DEFAULT_SHADOW_OFFSET = 1;

export interface LabelOutlineTheme {
  size: number;
  color: ControlColor;
}

/** `label.cpp:765-766`: `has_settings ? settings->get_outline_X() : theme_cache.font_outline_X`, the precedence `labelEffectiveTextTheme` states. */
export function labelOutlineTheme(n: SolveNode, settings: ReturnType<typeof resolveNodeLabelSettings>): LabelOutlineTheme {
  if (settings) return { size: settings.outlineSize, color: settings.outlineColor };
  return {
    size: n.constants['outline_size'] ?? 0,
    color: n.colors['font_outline_color'] ?? LABEL_DEFAULT_OUTLINE_COLOR,
  };
}

export interface LabelShadowTheme {
  /** The shadow's own outline width (`LabelSettings.shadow_size` or the theme's `shadow_outline_size`), not a copy of the offset. */
  size: number;
  color: ControlColor;
  offset: Vec2;
}

/** `label.cpp:762-767`: `has_settings ? settings->get_shadow_X() : theme_cache.font_shadow_X`, the precedence `labelEffectiveTextTheme` states. */
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
 * The width `Label::_shape` breaks lines at: `int width = (get_size().width - style->get_minimum_size().width)`
 * (`label.cpp:581`), where the style is Label's zero-size `StyleBoxEmpty` (`default_theme.cpp:379`).
 * The `int` wraps a word that fits in 320.6px but not in 320. The solver and `Component.tsx` share
 * this, so the solved height is the height of the drawn lines.
 */
export function labelShapingWidthPx(controlWidthPx: number): number {
  return Math.trunc(controlWidthPx);
}

// lines_skipped and max_lines_visible: label.cpp:344-361,520-561

export interface LabelLineRange {
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

/**
 * `layout.lines` cut to `range`, with height and width summed over the kept lines only, as
 * `_update_visible` and `get_layout_data` do (`label.cpp:359-361`, `:556-559`).
 */
export function windowLabelLines(layout: TextLayoutResult, range: LabelLineRange): TextLayoutResult {
  const lines = layout.lines.slice(range.start, range.end);
  const widthPx = lines.reduce((max, l) => Math.max(max, l.widthPx), 0);
  return { ...layout, lines, heightPx: lines.length * layout.linePitchPx, widthPx };
}

// visible_characters and visible_characters_behavior: label.cpp:778-883

/** `TextServer::VisibleCharactersBehavior` (`servers/text/text_server.h:90-96`). Godot default 0 (`label.h:74`). */
export const VC_CHARS_BEFORE_SHAPING = 0;
export const VC_CHARS_AFTER_SHAPING = 1;
export const VC_GLYPHS_AUTO = 2;
export const VC_GLYPHS_LTR = 3;
export const VC_GLYPHS_RTL = 4;

/**
 * `Label::_shape`'s pre-shape reveal (`label.cpp:155-156`): `txt.substr(0, visible_chars)` before
 * line-breaking, so a typewriter reveal re-wraps as it grows. Other behaviours trim at draw time
 * (`applyVisibleCharsReveal`). An unset or negative `visibleChars` shows all.
 */
export function labelPreShapeText(text: string, visibleChars: number | undefined, behavior: number | undefined): string {
  if (visibleChars === undefined || visibleChars < 0) return text;
  if ((behavior ?? VC_CHARS_BEFORE_SHAPING) !== VC_CHARS_BEFORE_SHAPING) return text;
  return text.slice(0, visibleChars);
}

export interface VisibleCharsBudget {
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
 * and windowed to `label.cpp`'s `start`/`end` (`:548-559`). CHARS_AFTER_SHAPING counts characters and GLYPHS_LTR glyphs from the front,
 * GLYPHS_RTL from the back (`label.cpp:780`), and GLYPHS_AUTO picks by `rtl_layout` (`:779-780`). One
 * glyph is one character here (no ligatures), except across a trimmed edge space (`comparison.md`).
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
 * Label's shaped text with autowrap off, null when empty, shared through the solve handoff
 * (`r3f/controls/native/solveHandoff.ts`) by `labelMinimumSize` and `Component.tsx`. Only autowrap off is
 * pure in `(n, theme)`: with it on, this pass can still move the width, so each side shapes at its own.
 * It is windowed to `lines_skipped` and `max_lines_visible`, so never window it again.
 */
export const labelUnwrappedShape = defineShare<TextLayoutResult | null>((n, theme) => {
  const props = n.node.properties as LabelProperties;
  const text = labelPreShapeText(props.text ?? '', props.visibleCharacters, props.visibleCharactersBehavior);
  if (text.length === 0) return null;
  const settings = resolveNodeLabelSettings(props, n.resources.internalResources);
  const { fontSizePx, lineSpacingPx } = labelEffectiveTextTheme(labelTextTheme(n, props, { theme }), settings);
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx,
    uppercase: props.uppercase,
    fontMetrics: resolveNodeFontMetrics(n, LABEL_THEME_FONT_KEY),
    paragraphSeparator: props.paragraphSeparator ?? LABEL_PARAGRAPH_SEPARATOR,
    tabStopsPx: props.tabStopsPx,
    autowrapTrimFlags: props.autowrapTrimFlags,
  });
  return windowLabelLines(layout, labelVisibleLineRange(layout.lines.length, props.linesSkipped ?? 0, props.maxLinesVisible));
});

/**
 * `minsize.height` (`label.cpp:246-262`): the windowed extent, floored at one font line pitch.
 * `_update_visible` (`:344-388`) subtracts one trailing `line_spacing`, since N lines carry N-1
 * gaps, while `shapeText` returns `N * linePitchPx`.
 */
function labelMinimumHeightPx(windowed: TextLayoutResult, lineSpacingPx: number, fontHeightPx: number): number {
  return Math.max(Math.max(0, windowed.heightPx - lineSpacingPx), fontHeightPx);
}

/**
 * `Label::get_minimum_size` (`:973-998`). Autowrap off (`:992-996`): {@link labelUnwrappedShape}'s widest
 * line (`:252-257`) by `_update_visible`'s height, plus a `min_style` that is zero for Label's `StyleBoxEmpty`
 * (`default_theme.cpp:379`). Autowrap on (`:984-991`): `Size2(1, height)`, with the height of the text
 * wrapped at `_shape`'s width (`:581,:227`).
 */
export const labelMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LabelProperties;
  const settings = resolveNodeLabelSettings(props, n.resources.internalResources);
  const themeResolved = labelTextTheme(n, props, ctx);
  const { fontSizePx, lineSpacingPx } = labelEffectiveTextTheme(themeResolved, settings);
  const fontMetrics = resolveNodeFontMetrics(n, LABEL_THEME_FONT_KEY);
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

  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF);
  if (autowrapMode !== AutowrapMode.OFF) {
    // A bottom-up pass has no rect yet, so the first pass shapes unwrapped and the second reads the
    // width the first resolved (`SolveContext.tentativeRect`, `registerSizeDependentMinimum`). One
    // extra pass suffices: the width floor is 1 on every pass, so this height cannot move the width.
    // Godot does the same over frames (`:901-905`, `:339-341`, `container.cpp:33-36`).
    const shapedWidthPx = ctx.tentativeRect?.(n)?.w;
    const wrapped = shapeText(text, {
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
    // Not modelled: `min_size.height = 1` and the `max_lines_visible` clamp (`:985-987`), which
    // need `clip` or an `overrun_behavior` other than `OVERRUN_NO_TRIMMING`.
    const range = labelVisibleLineRange(wrapped.lines.length, props.linesSkipped ?? 0, props.maxLinesVisible);
    return { x: 1, y: labelMinimumHeightPx(windowLabelLines(wrapped, range), lineSpacingPx, fontHeightPx) };
  }

  // Non-null: empty text, the share's only null, returned above.
  const windowed = labelUnwrappedShape(n, ctx.theme)!;
  const height = labelMinimumHeightPx(windowed, lineSpacingPx, fontHeightPx);
  // `minsize.width` is the widest line's ceiled `shaped_text_get_size(...).x` (`label.cpp:252-257`).
  // The max of the ceils is the ceil of the max, so the widest raw line converts once.
  // `clip_text` or an overrun behaviour other than NO_TRIMMING drops the width floor to 1
  // (label.cpp:993-995), since a narrower box trims the text.
  const overrunBehavior = props.overrunBehavior ?? OverrunBehavior.NO_TRIMMING;
  const widthPx =
    props.clipText || overrunBehavior !== OverrunBehavior.NO_TRIMMING ? 1 : shapedTextSizeWidthPx(windowed.widthPx);
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

/** `Label.jst_flags`'s default (`label.h:46`), used absent a scene override. */
export const LABEL_DEFAULT_JUSTIFICATION_FLAGS =
  JustificationFlag.WORD_BOUND | JustificationFlag.KASHIDA | JustificationFlag.SKIP_LAST_LINE | JustificationFlag.DO_NOT_SKIP_SINGLE_LINE;

/** `TS->shaped_text_has_visible_chars` reduced to this engine's charset: any glyph whose own character is not whitespace. */
function lineHasVisibleChars(line: TextLineLayout): boolean {
  return line.glyphs.some((g) => !isWhitespace(g.char.codePointAt(0)!));
}

/**
 * How many leading `lines` get justified: `jst_to_line` for autowrap off (`label.cpp:304-319`).
 * The autowrap-on copy (`:273-289`) serves `lines_hidden`, which this slice does not model.
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
 * `Label::_get_line_rect`'s x (`label.cpp:487-512`). H_CENTER writes `int(size.width - line_size.width) / 2`
 * and H_RIGHT `int(size.width - margin - line_size.width)`, both truncating toward zero. A box narrower
 * than its line (only with `clip_text`) makes the difference negative, where `Math.floor` is a pixel
 * off. `margin` is zero for Label's `StyleBoxEmpty` (`default_theme.cpp:379`).
 */
function horizontalOffsetPx(lineWidthPx: number, boxWidthPx: number, alignment: number | undefined, rtl: boolean): number {
  // `rtl_layout` swaps the two arms outright (`:481-497`): LEFT takes the
  // trailing-edge expression and RIGHT takes `style->get_offset().x`, which is
  // zero for the StyleBoxEmpty above. CENTER carries no arm.
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
    default:
      return 0;
  }
}

/**
 * `_get_line_rect`'s x reads two directions (`label.cpp:470-471`), and only `rtl_layout` is here.
 * The paragraph direction follows `text_direction`, default `TEXT_DIRECTION_AUTO` (`label.h:70`),
 * which infers LTR for Latin text (`:179`, `text_server_adv.cpp:7241-7247`). FILL's own arm
 * (`:472`) is unreachable while `text_direction` is unmodelled (`comparison.md`).
 */
export interface LabelLayoutDirection {
  /** `is_layout_rtl()` (`SolveNode.rtl`). Defaults `false`. */
  rtl?: boolean;
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
  justificationFlags: number = LABEL_DEFAULT_JUSTIFICATION_FLAGS,
  // Feeds only `fitLineToWidth`'s 0.1*font_size shrink floor. The default is the theme's 16.
  fontSizePx: number = 16,
  direction: LabelLayoutDirection = {}
): LabelLinePlacement[] {
  const { rtl = false } = direction;
  const lineCount = layout.lines.length;
  if (lineCount === 0) return [];

  const lineSpacingPx = LABEL_LINE_SPACING_PX;
  // label.cpp:599: `total_h - line_spacing - paragraph_spacing`, with one paragraph, so
  // paragraph_spacing is 0. `labelMinimumSize` applies the same correction.
  const contentHeightPx = layout.heightPx - lineSpacingPx;

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
  const isFill = (horizontalAlignment ?? H_LEFT) === H_FILL;
  const jstToLine = isFill ? justifyToLineIndex(layout.lines, justificationFlags) : 0;
  // `_shape` justifies at the truncated `int width` it broke the lines at (`label.cpp:297,331`),
  // not the raw `get_size()` that `_get_line_rect` reads.
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
    // `_get_line_rect` aligns against the ceiled `TS->shaped_text_get_size(rid)` (`label.cpp:478`),
    // not the raw pen advance `fitLineToWidth` needs.
    return { x: horizontalOffsetPx(shapedTextSizeWidthPx(line.widthPx), boxWidthPx, horizontalAlignment, rtl), y, line };
  });
}
