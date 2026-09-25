/**
 * RichTextLabel's native (WebGL canvas) solve: `get_minimum_size` (`scene/gui/rich_text_label.cpp:8036-8047`)
 * over `get_content_height` and `get_content_width` (`:7491-7522`), the theme keys of
 * `scene/theme/default_theme.cpp:1194-1211`, and the styled-run layout the painter draws.
 * Pure math, no THREE or React.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TscnNode } from '../../../../parser/types';
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import {
  AutowrapMode,
  clampAutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  soloLineLayout,
  type GlyphPlacement,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveTextTheme, type ResolvedTextTheme, type TextThemeDefaults, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import { getUnderlinePositionPx, getUnderlineThicknessPx } from '../../../../r3f/controls/native/text/openSansMetrics';
import { getFontAscentPx, getFontGlyphAdvancePx, getFontLinePitchPx, type FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics, resolveNodeFontSizePx } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { ControlColor } from '../control/types';
import type { RichTextLabelProperties } from './types';
import {
  IMAGE_OBJECT_CHAR,
  hasOpenTag,
  lastTagValue,
  parseBBCodeRuns,
  resolveBBColor,
  type ParsedImageAlignment,
  type ParsedImageRegion,
  type ParsedImgTag,
} from './bbcode';

/** RichTextLabel reads `theme_override_font_sizes/normal_font_size` and `theme_override_colors/default_color`, not Label's `font_size` and `font_color`. */
export const RICH_TEXT_LABEL_THEME_KEYS: TextThemeKeys = { sizeKey: 'normal_font_size', colorKey: 'default_color' };

/**
 * The plain-paragraph font key, `scene/theme/default_theme.cpp:1194`:
 * `theme->set_font("normal_font", "RichTextLabel", Ref<Font>());`. `_find_font`
 * (`rich_text_label.cpp:3226-3296`) reads other keys per style, but bold and
 * italic are synthesised over this one face, so only it resolves.
 */
export const RICH_TEXT_LABEL_THEME_FONT_KEY = 'normal_font';

/** `default_theme.cpp:1205`: `theme->set_color("default_color", "RichTextLabel", Color(1, 1, 1))`, a call separate from Label's. */
export const RICH_TEXT_LABEL_DEFAULT_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

/** `rich_text_label.h:557`: `TextServer::AutowrapMode autowrap_mode = TextServer::AUTOWRAP_WORD_SMART;`, unlike Label's OFF (`label.h`). */
export const RICH_TEXT_LABEL_DEFAULT_AUTOWRAP = AutowrapMode.WORD_SMART;

/** Resolves this node's font size and colour: overrides, then the ancestor Theme chain, then RichTextLabel's white. */
export function richTextLabelTextTheme(
  n: SolveNode,
  props: RichTextLabelProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: RICH_TEXT_LABEL_DEFAULT_FONT_COLOR };
  return resolveTextTheme(n, props, RICH_TEXT_LABEL_THEME_KEYS, defaults);
}

// ── [img]: its size, and its width through the shared shaper ──

/**
 * `RichTextLabel::_get_image_size` (`rich_text_label.cpp:4120-4155`). Three
 * branches read the texture's natural size, `SolveNode.textureSlots[path]`.
 * `null` means it cannot be sized yet, and the caller drops the run rather
 * than reserve a wrong box.
 */
export function imageSizePx(
  widthPx: number,
  heightPx: number,
  region: ParsedImageRegion | undefined,
  naturalSize?: Vec2 | null
): Vec2 | null {
  const hasRegion = region !== undefined && region.w > 0 && region.h > 0; // Rect2::has_area().
  if (widthPx > 0) {
    if (heightPx > 0) return { x: widthPx, y: heightPx };
    if (hasRegion) return { x: widthPx, y: (region!.h * widthPx) / region!.w };
    if (naturalSize && naturalSize.x > 0) return { x: widthPx, y: (naturalSize.y * widthPx) / naturalSize.x };
    return null;
  }
  if (heightPx > 0) {
    if (hasRegion) return { x: (region!.w * heightPx) / region!.h, y: heightPx };
    if (naturalSize && naturalSize.y > 0) return { x: (naturalSize.x * heightPx) / naturalSize.y, y: heightPx };
    return null;
  }
  if (hasRegion) return { x: region!.w, y: region!.h };
  if (naturalSize) return { x: naturalSize.x, y: naturalSize.y };
  return null;
}

/**
 * Whether `_get_image_size` reads `p_image->get_width()`/`get_height()`: never
 * with a `region=`, and never with both dimensions authored. A percent
 * dimension counts as authored.
 */
function imageNeedsNaturalSize(tag: ParsedImgTag): boolean {
  const hasRegion = tag.region !== undefined && tag.region.w > 0 && tag.region.h > 0;
  if (hasRegion) return false;
  return !(tag.width > 0 && tag.height > 0);
}

/**
 * The `[img]` refs whose natural size this node's BBCode needs, keyed by the
 * raw ref that `styledTextRuns` reads back.
 */
export const richTextLabelTextureSlots: TextureSlotsFn = (node: TscnNode) => {
  const props = node.properties as RichTextLabelProperties;
  if (!props.bbcodeEnabled || !props.text) return [];
  const seen = new Set<string>();
  const requests: TextureSlotRequest[] = [];
  for (const run of parseBBCodeRuns(props.text)) {
    const tag = run.image;
    if (!tag || !tag.path || seen.has(tag.path) || !imageNeedsNaturalSize(tag)) continue;
    seen.add(tag.path);
    requests.push({ key: tag.path, ref: tag.path });
  }
  return requests;
};

/**
 * `width_in_percent` and `height_in_percent` (`rich_text_label.cpp:503-506`)
 * both scale against the paragraph width, never its height. `boxWidthPx` is
 * `undefined` on the first solve pass, and a percent dimension is then 0.
 */
function resolveImageDimension(amount: number, inPercent: boolean, boxWidthPx: number | undefined): number {
  if (!inPercent) return amount;
  if (boxWidthPx === undefined) return 0;
  return (boxWidthPx * amount) / 100;
}

/**
 * `InlineAlignment` (`core/math/math_defs.h:94-113`) against the line's
 * text-only ascent and descent, as `TextServerAdvanced::_realign`
 * (`modules/text_server_adv/text_server_adv.cpp:5189-5254`). Returns the
 * image's top edge, baseline-relative and down-positive.
 */
export function imageBaselineOffsetPx(
  textAscentPx: number,
  textDescentPx: number,
  imageHeightPx: number,
  alignment: ParsedImageAlignment
): number {
  let y: number;
  switch (alignment.textPoint) {
    case 'top':
      y = -textAscentPx;
      break;
    case 'center':
      y = (-textAscentPx + textDescentPx) / 2;
      break;
    case 'baseline':
      y = 0;
      break;
    case 'bottom':
    default:
      y = textDescentPx;
      break;
  }
  switch (alignment.imagePoint) {
    case 'bottom':
      y -= imageHeightPx;
      break;
    case 'center':
      y -= imageHeightPx / 2;
      break;
    case 'top':
    default:
      break; // `INLINE_ALIGNMENT_TOP_TO` is 0.
  }
  return y;
}

/**
 * An `[img]`'s resolved draw box. `sizePx` is never `null`: `styledTextRuns`
 * drops an image `imageSizePx` cannot size, as Godot does when
 * `ResourceLoader::load` fails.
 */
export interface ResolvedImageRun {
  spec: ParsedImgTag;
  sizePx: Vec2;
}

/**
 * Makes `shapeText` advance `IMAGE_OBJECT_CHAR` by the image width, carried in
 * as its font size. Godot sets `gl.advance = rect.size.x` (`text_server_adv.cpp:7370-7383`).
 * At `unitsPerEm` units the advance chain returns that size rounded to 1/64px,
 * exact for whole and half pixels and within 1/128px otherwise.
 */
export function imageObjectFontMetrics(base: FontMetrics): FontMetrics {
  // A fractional width skips the whole-pixel round, and the size change at each
  // edge resets the remainder and kerning, as a separate shaped run would.
  return {
    ...base,
    getGlyphAdvanceUnits(ch: string): number | null {
      if (ch === IMAGE_OBJECT_CHAR) return base.unitsPerEm;
      return base.getGlyphAdvanceUnits(ch);
    },
    getKerningAdjustmentUnits(a: string, b: string): number {
      if (a === IMAGE_OBJECT_CHAR || b === IMAGE_OBJECT_CHAR) return 0;
      return base.getKerningAdjustmentUnits(a, b);
    },
  };
}

/**
 * `tab_stops`, else one stop of `max(1, tab_size * space_advance)`
 * (`_find_tab_stops`, `rich_text_label.cpp:479-482`). `SPACING_SPACE` is 0 for
 * every loaded font. `tab_size <= 0` disables tab alignment (`:479`).
 */
export function richTextTabStopsPx(
  tabStopsPx: number[] | undefined,
  tabSize: number | undefined,
  fontMetrics: FontMetrics,
  fontSizePx: number
): number[] {
  if (tabStopsPx && tabStopsPx.length > 0) return tabStopsPx;
  const size = tabSize ?? 4;
  if (size <= 0) return [];
  return [Math.max(1, size * getFontGlyphAdvancePx(fontMetrics, ' ', fontSizePx))];
}

/**
 * `RichTextLabel::get_minimum_size` (`rich_text_label.cpp:8036-8047`): zero
 * without `fit_content`, and `Size2(1, min_size.height)` under autowrap. `normal_style`
 * is empty (default_theme.cpp:1186), and empty text has height 0
 * (`:7491-7506`), unlike Label.
 */
export const richTextLabelMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as RichTextLabelProperties;
  const autowrapMode = clampAutowrapMode(props.autowrapMode, RICH_TEXT_LABEL_DEFAULT_AUTOWRAP);
  const wraps = autowrapMode !== AutowrapMode.OFF;

  if (!props.fitContent) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  // Read whatever the autowrap: a `%`-form `[img]` resolves against the
  // paragraph width, `undefined` on the first pass.
  const availableWidthPx = ctx.tentativeRect?.(n)?.w;
  const { fontSizePx, color } = richTextLabelTextTheme(n, props, ctx);
  const runs = styledTextRuns(n, props, color, fontSizePx, ctx.theme.fontSize, availableWidthPx);
  const text = runs.map((r) => r.text).join('');

  if (text.length === 0) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  // No text engine, no measurement. This calls `shapeText` directly, since
  // per-character sizes do not fit `TextMeasurer`.
  if (!ctx.measureText) return { x: 0, y: 0 };

  const fontMetrics = resolveNodeFontMetrics(n, RICH_TEXT_LABEL_THEME_FONT_KEY);
  // Wrapped at the control's width: `_validate_line_caches` resizes the lines, then
  // `update_minimum_size()` runs under `fit_content` (`rich_text_label.cpp:3873,3880`).
  // `tentativeRect` is `undefined` on the first pass, as in Godot's pre-resize state.
  // The empty `normal` StyleBox (`default_theme.cpp:1186`) makes the text rect the control's.
  const wrapWidthPx = wraps ? availableWidthPx : undefined;
  // `line_separation` and `paragraph_separation` are 0 (`default_theme.cpp:1217-1218`),
  // not Label's 3.
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: wrapWidthPx ?? 0,
    autowrapMode: wrapWidthPx === undefined ? AutowrapMode.OFF : autowrapMode,
    lineSpacingPx: 0,
    fontSizePxAt: fontSizePxAtFromRuns(runs),
    // An `[img]` placeholder shapes at the image width, as in `Component.tsx`,
    // so measure and paint wrap alike.
    fontMetrics: imageObjectFontMetrics(fontMetrics),
    tabStopsPx: richTextTabStopsPx(props.tabStopsPx, props.tabSize, fontMetrics, fontSizePx),
    autowrapTrimFlags: props.autowrapTrimFlags,
  });
  // `get_content_height` sums each line's own ascent+descent, never a count
  // times one pitch (`richTextLineMetrics`).
  const lines = richTextLineMetrics(runs, layout);
  const lastLine = lines[lines.length - 1];
  const measured = {
    // `get_content_width` maxes `TS->shaped_text_get_size(lines_rid[i])`
    // (`text_paragraph.cpp:601-608`): the ceiled extent.
    x: shapedTextSizeWidthPx(layout.widthPx),
    y: lastLine ? lastLine.topPx + lastLine.ascentPx + lastLine.descentPx : 0,
  };

  if (wraps) {
    return { x: 1, y: measured.y };
  }
  return { x: measured.x, y: measured.y };
};

// ── Draw time: BBCode to styled runs to per-line placements ──

/** One styled run of the plain text, with what `[b]`/`[i]`/`[u]`/`[color]` resolve to. */
export interface StyledTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  /** `[u]` open on the tag stack (`rich_text_label.cpp:4677`'s `push_underline`), drawn by `underlineRectPx`. */
  underline: boolean;
  color: ControlColor;
  /** This run's font size, px (`resolveRunFontSizePx`): `normal_font_size` for a plain run. */
  fontSizePx: number;
  /**
   * The paragraph's `HorizontalAlignment`: `_find_alignment` over the tag
   * stack, else `horizontal_alignment` (`resolveParagraphAlignment`).
   */
  alignment: number;
  /**
   * Set only on the `[img]` placeholder run. There `fontSizePx` carries
   * `sizePx.x` (`imageObjectFontMetrics`), so check this field first.
   */
  image?: ResolvedImageRun;
}

/**
 * `scene/theme/default_theme.cpp:1199-1202` gives each style its own font size,
 * -1, and `_find_font` (`rich_text_label.cpp:3226-3296`, `:3257`/`:3270`/`:3283`)
 * reads it with no fallback to `normal_font_size`. `Theme::get_font_size` in
 * `scene/resources/theme.cpp` (`:658-661`) sends `<= 0` to 16 (`scene/theme/theme_db.h:85`).
 */
const RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS = {
  boldItalic: 'bold_italics_font_size',
  bold: 'bold_font_size',
  italic: 'italics_font_size',
} as const;

/**
 * A styled run's font size: `normalFontSizePx` for a plain run, else its style
 * key through the ancestor-Theme walk (`resolveNodeFontSizePx`,
 * `scene/resources/theme.cpp:658-666`) down to `builtInDefaultPx`. `cache`
 * holds one answer per key for one `styledTextRuns` call.
 */
function resolveRunFontSizePx(
  bold: boolean,
  italic: boolean,
  props: RichTextLabelProperties,
  normalFontSizePx: number,
  n: SolveNode,
  builtInDefaultPx: number,
  cache: Map<string, number>
): number {
  if (!bold && !italic) return normalFontSizePx;
  const key = bold && italic ? RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.boldItalic : bold ? RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.bold : RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.italic;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const resolved = resolveNodeFontSizePx(n, key, props.themeOverrideFontSizes?.[key], builtInDefaultPx);
  cache.set(key, resolved);
  return resolved;
}

/**
 * Splits `props.text` into styled runs. Without `bbcode_enabled` it is one
 * literal run. `[b]` and `[i]` combine when nested (`rich_text_label.cpp:5452-5471`),
 * `[u]` combines with both, and the innermost `[color=...]` wins. `boxWidthPx`
 * sizes a `%`-form `[img]`, `undefined` on the first solve pass.
 */
export function styledTextRuns(
  n: SolveNode,
  props: RichTextLabelProperties,
  defaultColor: ControlColor,
  normalFontSizePx: number,
  builtInDefaultPx: number,
  boxWidthPx?: number
): StyledTextRun[] {
  const raw = props.text ?? '';
  if (!props.bbcodeEnabled) {
    return raw.length === 0
      ? []
      : [
          {
            text: raw,
            bold: false,
            italic: false,
            underline: false,
            color: defaultColor,
            fontSizePx: normalFontSizePx,
            alignment: resolveParagraphAlignment([], props.horizontalAlignment),
          },
        ];
  }

  // One Theme walk per style key, however many spans the paragraph has.
  const runFontSizeCache = new Map<string, number>();
  const styled: StyledTextRun[] = [];
  for (const run of parseBBCodeRuns(raw)) {
    if (run.image) {
      const widthPx = resolveImageDimension(run.image.width, run.image.widthInPercent, boxWidthPx);
      const heightPx = resolveImageDimension(run.image.height, run.image.heightInPercent, boxWidthPx);
      const sizePx = imageSizePx(widthPx, heightPx, run.image.region, n.textureSlots[run.image.path]);
      if (!sizePx) continue; // Unsizable yet: dropped, as a failed load is in Godot.
      styled.push({
        text: run.text,
        bold: false,
        italic: false,
        underline: false,
        color: run.image.color,
        // Carries the image width: `imageObjectFontMetrics`.
        fontSizePx: sizePx.x,
        alignment: resolveParagraphAlignment(run.tags, props.horizontalAlignment),
        image: { spec: run.image, sizePx },
      });
      continue;
    }
    if (run.text.length === 0) continue;
    const colorValue = lastTagValue(run.tags, 'color');
    const bold = hasOpenTag(run.tags, 'b');
    const italic = hasOpenTag(run.tags, 'i');
    styled.push({
      text: run.text,
      bold,
      italic,
      underline: hasOpenTag(run.tags, 'u'),
      color: colorValue !== undefined ? resolveBBColor(colorValue, defaultColor) : defaultColor,
      fontSizePx: resolveRunFontSizePx(bold, italic, props, normalFontSizePx, n, builtInDefaultPx, runFontSizeCache),
      alignment: resolveParagraphAlignment(run.tags, props.horizontalAlignment),
    });
  }
  return styled;
}

/**
 * The per-character `fontSizePxAt` for `shapeText`, indexed over the
 * concatenated text of `styledRuns`.
 */
export function fontSizePxAtFromRuns(styledRuns: readonly StyledTextRun[]): (charIndex: number) => number {
  const sizes: number[] = [];
  for (const run of styledRuns) {
    for (let i = 0; i < run.text.length; i++) sizes.push(run.fontSizePx);
  }
  const lastSize = sizes.length > 0 ? sizes[sizes.length - 1]! : 0;
  return (charIndex: number) => sizes[charIndex] ?? lastSize;
}

/**
 * `scene/theme/default_theme.cpp:1392-1403` builds bold as embolden 1.2 (`:1394`, `:1398`),
 * a FreeType stroke (`text_server_adv.cpp:1313-1314`: `FT_Pos strength = embolden * p_size.x / 16`)
 * with no formula to MSDF `distanceBias`. 0.35 is tuned: the 18px 'l' stem of `[b]Bold[/b]`
 * renders 3.01px against Godot's 3.04px. `richtextlabel/comparison.md` holds the residuals.
 */
export const BOLD_DISTANCE_BIAS = 0.35;

/**
 * `default_theme.cpp:1399`/`:1403`: `Transform2D(1.0, 0.2, 0.0, 1.0, 0.0, 0.0)`, bold+italic
 * combining both. Its x-basis `(1, 0.2)` is exactly `TextRun`'s `skew`
 * (`dx = -skew * (yPx - lineTopPx)`).
 */
export const ITALIC_SKEW = 0.2;

/**
 * `default_theme.cpp:1231`: `theme->set_constant("underline_alpha", "RichTextLabel", 50)`.
 * Without `[u=color]`, which this subset lacks, `rich_text_label.cpp:1237`
 * draws the run's font colour with `.a *= underline_alpha / 100.0`.
 */
export const RICH_TEXT_LABEL_UNDERLINE_ALPHA = 0.5;

/** An `[img]`'s draw geometry in its line: `_draw_line`'s `ITEM_IMAGE` arm (`rich_text_label.cpp:1090-1102`). */
export interface RichTextImagePlacement {
  spec: ParsedImgTag;
  /** Left edge in line-relative pen space: the placeholder glyph's `x`, already `sd->objects[key].rect.position.x`. */
  xPx: number;
  /** Top edge from the line top: `lineAscentPx + imageBaselineOffsetPx(...)` (`rich_text_label.cpp:1055`'s `off.y += l_ascent`, then `_realign`'s `rect.position.y`). */
  yPx: number;
  widthPx: number;
  heightPx: number;
}

/** One line and style run for one `<TextRun>`, or an `[img]` when `image` is set, which leaves the text fields unused. */
export interface RichTextRunPlacement {
  lineIndex: number;
  /** The line's top from the control's top: `RichTextLineMetrics.topPx` plus the `vertical_alignment` shift (`richTextVerticalOffsets`). */
  lineTopPx: number;
  /** The line's left offset, per line since each aligns by its own width (`richTextHorizontalOffsetPx`). */
  lineOffsetXPx: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: ControlColor;
  /** The run's font size, px, for its glyphs. The baseline is the line's: `layout.baselineOffsetPx`. */
  fontSizePx: number;
  /** A single-line layout of only this run's glyphs from the line, `glyph.x` already line-relative. */
  layout: TextLayoutResult;
  image?: RichTextImagePlacement;
}

/**
 * Keeps the parent's `fontMetrics` and `linePitchPx` (`soloLineLayout`), since
 * `TextRun` picks atlas or canvas painting from `layout.fontMetrics.kind`.
 * `baselineOffsetPx` is the line's ascent, applied once per line
 * (`rich_text_label.cpp:1055`'s `off.y += l_ascent`), so mixed sizes share it.
 */
function soloRunLayout(
  text: string,
  glyphs: GlyphPlacement[],
  parentLayout: TextLayoutResult,
  lineAscentPx: number
): TextLayoutResult {
  const widthPx = glyphs.length ? glyphs[glyphs.length - 1]!.x + glyphs[glyphs.length - 1]!.advance - glyphs[0]!.x : 0;
  return soloLineLayout({ text, glyphs, widthPx }, parentLayout, lineAscentPx);
}

/**
 * Descent at `fontSizePx`: pitch minus ascent at zero spacing, so
 * `fontMetrics.ts` keeps the one reading of the ceiling rule
 * (`text_server_adv.cpp:1515-1516`).
 */
function fontDescentPx(metrics: FontMetrics, fontSizePx: number): number {
  return getFontLinePitchPx(metrics, fontSizePx, 0) - getFontAscentPx(metrics, fontSizePx);
}

/** One wrapped line's vertical metrics, recomputed per line (`text_server_adv.cpp:5486-5487`), unlike the underline's. */
export interface RichTextLineMetrics {
  /** The line's top from the paragraph's top: the sum of the earlier lines' `ascentPx + descentPx`. */
  topPx: number;
  /** Baseline offset from `topPx`: the max ascent of this line's fonts and images (`imageBaselineOffsetPx`). */
  ascentPx: number;
  /** The max descent of this line's fonts and images. */
  descentPx: number;
  /** `ascentPx` before images fold in: `_realign` measures each image against it. */
  textAscentPx: number;
  /** `descentPx` before images fold in. */
  textDescentPx: number;
}

/**
 * Per-line top, ascent and descent of a shaped paragraph. `_shape_substr`
 * (`modules/text_server_adv/text_server_adv.cpp:5486-5487`) takes each line's max
 * over its own fonts, and `rich_text_label.cpp:1055`/`:1589` step by them, so
 * mixed sizes make lines of different heights.
 */
export function richTextLineMetrics(
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult
): RichTextLineMetrics[] {
  return lineMetricsOf(attributeRunsToLines(styledRuns, layout), styledRuns, layout);
}

function lineMetricsOf(
  perLine: readonly RunLineSegment[][],
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult
): RichTextLineMetrics[] {
  const paragraphAscentPx = layout.baselineOffsetPx;
  const paragraphDescentPx = layout.linePitchPx - layout.baselineOffsetPx;

  let topPx = 0;
  return perLine.map((segments) => {
    // Text first: `_realign` measures every image against these values, and an
    // image adds nothing to them.
    let ascentPx = 0;
    let descentPx = 0;
    for (const segment of segments) {
      const run = styledRuns[segment.runIndex]!;
      if (run.image) continue;
      ascentPx = Math.max(ascentPx, getFontAscentPx(layout.fontMetrics, run.fontSizePx));
      descentPx = Math.max(descentPx, fontDescentPx(layout.fontMetrics, run.fontSizePx));
    }
    // A blank line shapes its break in the paragraph font, so it keeps that height.
    if (segments.length === 0) {
      ascentPx = paragraphAscentPx;
      descentPx = paragraphDescentPx;
    }
    const textAscentPx = ascentPx;
    const textDescentPx = descentPx;

    for (const segment of segments) {
      const run = styledRuns[segment.runIndex]!;
      if (!run.image) continue;
      const yOffset = imageBaselineOffsetPx(textAscentPx, textDescentPx, run.image.sizePx.y, run.image.spec.alignment);
      ascentPx = Math.max(ascentPx, -yOffset);
      descentPx = Math.max(descentPx, yOffset + run.image.sizePx.y);
    }

    const metrics = { topPx, ascentPx, descentPx, textAscentPx, textDescentPx };
    // `line_separation` is 0 (`default_theme.cpp:1217`), so tops are a bare sum.
    topPx += ascentPx + descentPx;
    return metrics;
  });
}

/** The paragraph's `[u]`/`[s]` stroke geometry, `sd->upos`/`sd->uthk`, before `rich_text_label.cpp:1243`'s 1px floor. */
export interface RichTextUnderlineMetrics {
  /** Downward offset from the line's baseline to the stroke's CENTRE, px (`shaped_text_get_underline_position`). */
  positionPx: number;
  /** The font's stroke thickness, px, unfloored (`shaped_text_get_underline_thickness`): `underlineRectPx` applies `MAX(1.0, uth)`. */
  thicknessPx: number;
}

/**
 * The paragraph's underline position and thickness: a max over every run's size.
 * `_shape_substr` in `modules/text_server_adv/text_server_adv.cpp` (`:5310-5311`) copies the
 * paragraph's `upos`/`uthk` into each line that `rich_text_label.cpp:1053-1054` reads.
 * Both scale monotonically, as `text_server_adv.cpp:7174-7175` accumulates them.
 */
export function richTextUnderlineMetrics(styledRuns: readonly StyledTextRun[]): RichTextUnderlineMetrics {
  // Open Sans's `post` table (`openSansMetrics.ts`): `fontMetrics.ts` has no
  // underline fields, so a scene font keeps Open Sans proportions.
  let positionPx = 0;
  let thicknessPx = 0;
  for (const run of styledRuns) {
    positionPx = Math.max(positionPx, getUnderlinePositionPx(run.fontSizePx));
    thicknessPx = Math.max(thicknessPx, getUnderlineThicknessPx(run.fontSizePx));
  }
  return { positionPx, thicknessPx };
}

/** One line's share of one style run. */
interface RunLineSegment {
  /** Index into `styledRuns`. */
  runIndex: number;
  /** The plain (tag-stripped) text these glyphs came from. */
  text: string;
  /** This run's glyphs from that line, `x` already line-relative. */
  glyphs: GlyphPlacement[];
}

/**
 * Splits each shaped line back into its style runs. `shapeText` shapes the
 * whole paragraph once so line breaks see its full width, and this split is
 * not a Godot port. It also tells which font sizes land on each line.
 */
function attributeRunsToLines(styledRuns: readonly StyledTextRun[], layout: TextLayoutResult): RunLineSegment[][] {
  const plainText = styledRuns.map((r) => r.text).join('');
  const charRunIndex: number[] = [];
  styledRuns.forEach((run, runIdx) => {
    for (let i = 0; i < run.text.length; i++) charRunIndex.push(runIdx);
  });

  let cursor = 0;

  return layout.lines.map((line) => {
    const segments: RunLineSegment[] = [];
    let i = 0;
    while (i < line.glyphs.length) {
      // A mismatch at the cursor is an edge space `label.h:45`'s BREAK_TRIM default
      // dropped, always whitespace. One forward pass cannot mis-attribute repeated text.
      while (cursor < plainText.length && plainText[cursor] !== line.glyphs[i]!.char) {
        cursor++;
      }
      const runIdx = charRunIndex[cursor] ?? charRunIndex[charRunIndex.length - 1] ?? 0;
      const start = i;
      const textStart = cursor;
      while (
        i < line.glyphs.length &&
        cursor < plainText.length &&
        plainText[cursor] === line.glyphs[i]!.char &&
        charRunIndex[cursor] === runIdx
      ) {
        cursor++;
        i++;
      }
      // No run or no glyph consumed means `layout` came from other text: break,
      // or the loop never ends.
      if (!styledRuns[runIdx] || i === start) break;
      segments.push({
        runIndex: runIdx,
        text: plainText.slice(textStart, cursor),
        glyphs: line.glyphs.slice(start, i),
      });
    }
    return segments;
  });
}

// ── Paragraph alignment (rich_text_label.cpp, text_paragraph.cpp) ──

/** `HorizontalAlignment` (`core/variant/variant.h` enum order), as authored on `horizontal_alignment`. */
const H_LEFT = 0;
const H_CENTER = 1;
const H_RIGHT = 2;
const H_FILL = 3;

/** `VerticalAlignment`, as authored on `vertical_alignment`. */
const V_TOP = 0;
const V_CENTER = 1;
const V_BOTTOM = 2;
const V_FILL = 3;

/** The tags that push a paragraph alignment (`rich_text_label.cpp:5681-5696`), mapped to it. */
const ALIGNMENT_TAGS: ReadonlyMap<string, number> = new Map([
  ['left', H_LEFT],
  ['center', H_CENTER],
  ['right', H_RIGHT],
  ['fill', H_FILL],
]);

/**
 * `RichTextLabel::_find_alignment` (`rich_text_label.cpp:3492-3505`): the
 * innermost alignment tag wins, else `horizontal_alignment` (`:7245-7258`).
 * `tags` is outermost-first, hence the reverse scan.
 */
export function resolveParagraphAlignment(
  tags: readonly { name: string }[],
  defaultAlignment: number | undefined
): number {
  for (let i = tags.length - 1; i >= 0; i--) {
    const pushed = ALIGNMENT_TAGS.get(tags[i]!.name);
    if (pushed !== undefined) return pushed;
  }
  return defaultAlignment ?? H_LEFT;
}

/**
 * A line's left offset: the LTR arms of `_draw_line` (`rich_text_label.cpp:1000-1014`), not
 * `TextParagraph::draw` (`scene/resources/text_paragraph.cpp:989-1023`), whose guards at `:1004`
 * and `:990` it lacks. An overflowing line hangs off the leading edge, clipped at `:8225`.
 * `lineWidthPx` is ceiled, as `:984` reads it.
 */
export function richTextHorizontalOffsetPx(
  lineWidthPx: number,
  boxWidthPx: number,
  alignment: number
): number {
  // The RTL arms (`rich_text_label.cpp:987-1014`) follow `_find_direction` (`:599`,
  // `:3507-3525`), which the default `TEXT_DIRECTION_AUTO` (`rich_text_label.h:615`)
  // keeps from `layout_direction`. `comparison.md` records the gap.
  switch (alignment) {
    case H_CENTER:
      // Floored as Godot floors the glyph (`text_server_adv.cpp:4084`), which absorbs
      // the `int p_width` (`rich_text_label.h:672,678`) but not the line's ceil
      // (`text_paragraph.cpp:773-779`, `text_server_adv.cpp:7524-7537`). Label
      // truncates instead, a pixel apart on an overflowing line.
      return Math.floor((boxWidthPx - lineWidthPx) / 2);
    case H_RIGHT:
      return Math.floor(boxWidthPx - lineWidthPx);
    case H_LEFT:
    case H_FILL:
    default:
      return 0;
  }
}

/** `vertical_alignment`'s two contributions: a one-off shift of the whole block, and an extra gap between lines under FILL. */
export interface RichTextVerticalOffsets {
  /** Added to every line's own top. */
  vbeginPx: number;
  /** Added once per line ABOVE the first (`vsep` in `rich_text_label.cpp:1629`). */
  vsepPx: number;
}

/**
 * `RichTextLabel::_notification`'s vertical alignment (`rich_text_label.cpp:1619-1652`).
 * The `text_rect.size.y > total_height` guard (`:1630`) keeps a taller paragraph
 * top-aligned, unlike Label. `vbegin`/`vsep` are floats (`:1628`), not Label's ints.
 */
export function richTextVerticalOffsets(
  contentHeightPx: number,
  boxHeightPx: number,
  alignment: number | undefined,
  lineCount: number
): RichTextVerticalOffsets {
  // Zero separations (`:1217-1218`) collapse `:1621-1627` to the content height.
  const none = { vbeginPx: 0, vsepPx: 0 };
  if (boxHeightPx <= contentHeightPx) return none;

  switch (alignment ?? V_TOP) {
    case V_CENTER:
      return { vbeginPx: (boxHeightPx - contentHeightPx) / 2, vsepPx: 0 };
    case V_BOTTOM:
      return { vbeginPx: boxHeightPx - contentHeightPx, vsepPx: 0 };
    case V_FILL:
      return { vbeginPx: 0, vsepPx: lineCount > 1 ? (boxHeightPx - contentHeightPx) / (lineCount - 1) : 0 };
    case V_TOP:
    default:
      return none;
  }
}

/** The box a paragraph aligns inside, plus the node's own two alignment properties. */
export interface RichTextAlignment {
  boxWidthPx: number;
  boxHeightPx: number;
  horizontalAlignment?: number;
  verticalAlignment?: number;
}

/**
 * One placement per line and style run, with each line's top and baseline from
 * `richTextLineMetrics` and its alignment offsets. Alignment resolves per line,
 * since tags differ between lines. Without `alignment`, the box is zero-width.
 */
export function layoutRichTextRuns(
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult,
  alignment?: RichTextAlignment
): RichTextRunPlacement[] {
  const perLine = attributeRunsToLines(styledRuns, layout);
  const lineMetrics = lineMetricsOf(perLine, styledRuns, layout);

  const boxWidthPx = alignment?.boxWidthPx ?? 0;
  // `get_content_height`'s sum of each line's ascent+descent, not `layout.heightPx`,
  // a count times one pitch that mixed sizes make wrong.
  const lastLine = lineMetrics[lineMetrics.length - 1];
  const contentHeightPx = lastLine ? lastLine.topPx + lastLine.ascentPx + lastLine.descentPx : 0;
  const { vbeginPx, vsepPx } = richTextVerticalOffsets(
    contentHeightPx,
    alignment?.boxHeightPx ?? 0,
    alignment?.verticalAlignment,
    layout.lines.length
  );

  const placements: RichTextRunPlacement[] = [];
  perLine.forEach((segments, lineIndex) => {
    const { topPx, ascentPx, textAscentPx, textDescentPx } = lineMetrics[lineIndex]!;
    // A paragraph tag cannot open mid-line, so the first segment's stack is the line's.
    const lineAlignment = segments[0]
      ? styledRuns[segments[0].runIndex]!.alignment
      : (alignment?.horizontalAlignment ?? H_LEFT);
    const lineOffsetXPx = richTextHorizontalOffsetPx(
      shapedTextSizeWidthPx(layout.lines[lineIndex]?.widthPx ?? 0),
      boxWidthPx,
      lineAlignment
    );
    for (const segment of segments) {
      const run = styledRuns[segment.runIndex]!;
      // Floored as Godot floors the glyph (`text_server_adv.cpp:4083`'s `cpos.y =
      // Math::floor(cpos.y)`), with `vbegin` and `vsep` fractional. In Godot a 23px
      // line centred in a 150px box has `vbegin` 63.5 and ink on row 69.
      const lineTopPx = Math.floor(topPx + vbeginPx + lineIndex * vsepPx);
      placements.push({
        lineIndex,
        lineTopPx,
        lineOffsetXPx,
        bold: run.bold,
        italic: run.italic,
        underline: run.underline,
        color: run.color,
        fontSizePx: run.fontSizePx,
        layout: soloRunLayout(segment.text, segment.glyphs, layout, ascentPx),
        image: run.image
          ? {
              spec: run.image.spec,
              xPx: segment.glyphs[0]?.x ?? 0,
              yPx: ascentPx + imageBaselineOffsetPx(textAscentPx, textDescentPx, run.image.sizePx.y, run.image.spec.alignment),
              widthPx: run.image.sizePx.x,
              heightPx: run.image.sizePx.y,
            }
          : undefined,
      });
    }
  });

  return placements;
}

/** A `[u]` run's stroke rect, px, in `TextRun`'s pen space (Y-down, line-top-relative), on whole pixels. */
export interface UnderlineRectPx {
  /** Left edge: the first column the first glyph's pen `x` covers, as `rich_text_label.cpp:1216-1244`'s `ul_start` sits at the pen, not the ink. */
  x0: number;
  /** Right edge, exclusive: one past the last column the last glyph's pen `x` + advance covers. */
  x1: number;
  /** Top edge: the first pixel row Godot's quad covers. */
  topPx: number;
  /** Whole rows the quad covers: 1 for a stroke at its `MAX(1.0, uth)` floor. */
  heightPx: number;
}

/**
 * The whole pixels `[from, to)` covers with one sample per pixel centre:
 * pixel `n` is in iff `from <= n + 0.5 < to`, the top-left fill rule.
 */
function coveredPixelRange(from: number, to: number): { first: number; last: number } {
  return { first: Math.ceil(from - 0.5), last: Math.ceil(to - 0.5) - 1 };
}

/**
 * A `[u]` run's stroke rect, snapped to the pixels Godot's quad covers, or `null`
 * with no glyphs. The stroke centres `upos` below the baseline (`rich_text_label.cpp:1055`,
 * `:1242-1244`), at least 1px thick (`:1243`, with `base_scale` 1 here).
 */
export function underlineRectPx(
  glyphs: readonly GlyphPlacement[],
  lineAscentPx: number,
  metrics: RichTextUnderlineMetrics
): UnderlineRectPx | null {
  if (glyphs.length === 0) return null;

  const first = glyphs[0]!;
  const last = glyphs[glyphs.length - 1]!;
  const centerY = lineAscentPx + metrics.positionPx;
  const widthPx = Math.max(1, metrics.thicknessPx);

  // Godot's un-antialiased quad on a canvas without MSAA covers whole rows, where
  // this multisampled canvas would feather two. The snap holds because the origin
  // (`controlPixelSnap.ts`) and every line top above are whole pixels.
  const rows = coveredPixelRange(centerY - widthPx / 2, centerY + widthPx / 2);
  const columns = coveredPixelRange(first.x, last.x + last.advance);

  return {
    x0: columns.first,
    x1: columns.last + 1,
    topPx: rows.first,
    heightPx: rows.last + 1 - rows.first,
  };
}
