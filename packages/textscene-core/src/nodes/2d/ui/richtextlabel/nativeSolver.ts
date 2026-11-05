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
import { perObject } from '../../../../utils/perObject';
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  clampAutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  soloLineLayout,
  startsParagraph,
  type GlyphPlacement,
  type ShapeTextOptions,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { justifyParagraphs } from '../../../../r3f/controls/native/text/textJustify';
import { faceOfStyle, resolveRichTextFaces, type RichTextFaces } from './styleFaces';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import {
  getUnderlinePositionPx,
  getUnderlineThicknessPx,
} from '../../../../r3f/controls/native/text/openSansMetrics';
import {
  getFontAscentPx,
  getFontTabStopsPx,
  getFontLinePitchPx,
  type FontMetrics,
} from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontSizePx } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { RichTextLabelProperties } from './types';
import {
  IMAGE_OBJECT_CHAR,
  hasOpenTag,
  lastTagValue,
  parseBBCodeRuns,
  resolveBBColor,
  type OpenBBCodeTag,
  type ParsedImageAlignment,
  type ParsedImageRegion,
  type ParsedImgTag,
  type ParsedRuleTag,
} from './bbcode';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { HorizontalAlignment, VerticalAlignment } from '../../../../godot/math/alignment';
import {
  controlBidiOptions,
  isDrawnRtl,
  type TextBidiOptions,
} from '../../../../r3f/controls/native/text/textBidiOptions';
import {
  paragraphAlignment,
  paragraphBidiOptions,
  paragraphJustificationFlags,
  paragraphTabStopsPx,
} from './paragraph';
import { paragraphListings, runListing, type ParagraphListing, type RunListing } from './listing';

/** RichTextLabel reads `theme_override_font_sizes/normal_font_size` and `theme_override_colors/default_color`, not Label's `font_size` and `font_color`. */
const RICH_TEXT_LABEL_THEME_KEYS: TextThemeKeys = {
  sizeKey: 'normal_font_size',
  colorKey: 'default_color',
};

/** `default_theme.cpp:1205`: `theme->set_color("default_color", "RichTextLabel", Color(1, 1, 1))`, a call separate from Label's. */
const RICH_TEXT_LABEL_DEFAULT_FONT_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** `rich_text_label.h:557`: `TextServer::AutowrapMode autowrap_mode = TextServer::AUTOWRAP_WORD_SMART;`, unlike Label's OFF (`label.h`). */
export const RICH_TEXT_LABEL_DEFAULT_AUTOWRAP = AutowrapMode.AUTOWRAP_WORD_SMART;

/** Resolves this node's font size and colour: overrides, then the ancestor Theme chain, then RichTextLabel's white. */
export function richTextLabelTextTheme(
  n: SolveNode,
  props: RichTextLabelProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: RICH_TEXT_LABEL_DEFAULT_FONT_COLOR,
  };
  return resolveTextTheme(n, props, RICH_TEXT_LABEL_THEME_KEYS, defaults);
}

// ── [img]: its size, and its width through the shared shaper ──

/**
 * `RichTextLabel::_get_image_size` (`rich_text_label.cpp:4120-4155`). Three
 * branches read the texture's natural size, `SolveNode.textureSlots[path]`.
 * `null` means it cannot be sized yet, and the caller drops the run rather
 * than reserve a wrong box.
 */
function imageSizePx(
  widthPx: number,
  heightPx: number,
  region: ParsedImageRegion | undefined,
  naturalSize?: Vector2 | null
): Vector2 | null {
  const hasRegion = region !== undefined && region.w > 0 && region.h > 0; // Rect2::has_area().
  if (widthPx > 0) {
    if (heightPx > 0) return { x: widthPx, y: heightPx };
    if (hasRegion) return { x: widthPx, y: (region!.h * widthPx) / region!.w };
    if (naturalSize && naturalSize.x > 0) return { x: widthPx, y: (naturalSize.y * widthPx) / naturalSize.x };
    return null;
  }
  if (heightPx > 0) {
    if (hasRegion) return { x: (region!.w * heightPx) / region!.h, y: heightPx };
    if (naturalSize && naturalSize.y > 0)
      return { x: (naturalSize.x * heightPx) / naturalSize.y, y: heightPx };
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
  // `_get_image_size` takes `int p_width` and `int p_height` (`rich_text_label.h:741`).
  return Math.trunc((boxWidthPx * amount) / 100);
}

/** `horizontal_rule` is a 2 x 2 white image (`default_theme.cpp:1187-1192`). */
const RULE_TEXTURE_SIZE_PX: Vector2 = { x: 2, y: 2 };

/** `add_hr` makes an `ItemImage` of the `horizontal_rule` icon, centred on the text (`:4180-4184`). */
const RULE_ALIGNMENT: ParsedImageAlignment = { imagePoint: 'center', textPoint: 'center' };

/**
 * The `ResolvedImageRun` of an `[hr]`, sized as an image of the 2 x 2 icon. Its colour is
 * `Color::from_string(color_option->value, theme_cache.default_color)` (`:5967-5971`).
 */
function resolveRule(
  rule: ParsedRuleTag,
  boxWidthPx: number | undefined,
  defaultColor: Rgba
): ResolvedImageRun {
  const sizePx = imageSizePx(
    resolveImageDimension(rule.width, rule.widthInPercent, boxWidthPx),
    resolveImageDimension(rule.height, rule.heightInPercent, boxWidthPx),
    undefined,
    RULE_TEXTURE_SIZE_PX
  )!;
  const spec: ParsedImgTag = {
    path: '',
    width: rule.width,
    height: rule.height,
    widthInPercent: rule.widthInPercent,
    heightInPercent: rule.heightInPercent,
    color: rule.colorOption === undefined ? defaultColor : resolveBBColor(rule.colorOption, defaultColor),
    pad: false,
    tooltip: '',
    altText: '',
    alignment: RULE_ALIGNMENT,
    solid: true,
  };
  return { spec, sizePx };
}

/**
 * `InlineAlignment` (`core/math/math_defs.h:94-113`) against the line's
 * text-only ascent and descent, as `TextServerAdvanced::_realign`
 * (`modules/text_server_adv/text_server_adv.cpp:5189-5254`). Returns the
 * image's top edge, baseline-relative and down-positive.
 */
function imageBaselineOffsetPx(
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
interface ResolvedImageRun {
  spec: ParsedImgTag;
  sizePx: Vector2;
}

/**
 * Makes `shapeText` advance `IMAGE_OBJECT_CHAR` by the image width, carried in
 * as its font size. Godot sets `gl.advance = rect.size.x` (`text_server_adv.cpp:7370-7383`).
 * At `unitsPerEm` units the advance chain returns that size rounded to 1/64px,
 * exact for whole and half pixels and within 1/128px otherwise.
 */
const imageObjectFontMetrics = perObject(wrapForImageObject);

/** One wrapper per face, so `shapeText` sees the same face on every call and its memo keeps hits. */
function wrapForImageObject(base: FontMetrics): FontMetrics {
  // A fractional width skips the whole-pixel round, and the size change at each
  // edge resets the remainder and kerning, as a separate shaped run would.
  // `Object.create` keeps the rest of the face live. An image has no outline, so no embolden or skew.
  return Object.create(base, {
    embolden: { value: 0 },
    skew: { value: 0 },
    getGlyphAdvanceUnits: {
      value(ch: string): number | null {
        if (ch === IMAGE_OBJECT_CHAR) return base.unitsPerEm;
        return base.getGlyphAdvanceUnits(ch);
      },
    },
    getKerningAdjustmentUnits: {
      value(a: string, b: string): number {
        if (a === IMAGE_OBJECT_CHAR || b === IMAGE_OBJECT_CHAR) return 0;
        return base.getKerningAdjustmentUnits(a, b);
      },
    },
  });
}

/** `tab_size`'s default (`rich_text_label.h:575`). */
const DEFAULT_TAB_SIZE = 4;

/**
 * `get_content_width` (`rich_text_label.cpp:7513-7518`): the widest paragraph, its inset plus its
 * ceiled width, truncated into the `int` the function keeps.
 */
function contentWidthPx(layout: TextLayoutResult): number {
  let widestPx = 0;
  for (const line of layout.lines) {
    widestPx = Math.max(widestPx, Math.trunc((line.indentPx ?? 0) + shapedTextSizeWidthPx(line.widthPx)));
  }
  return widestPx;
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
  const wraps = autowrapMode !== AutowrapMode.AUTOWRAP_OFF;

  if (!props.fitContent) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  // Read whatever the autowrap: a `%`-form `[img]` resolves against the
  // paragraph width, `undefined` on the first pass.
  const availableWidthPx = ctx.tentativeRect?.(n)?.w;
  const { fontSizePx, color } = richTextLabelTextTheme(n, props, ctx);
  const runs = styledTextRuns(n, props, color, fontSizePx, ctx.theme.fontSize, availableWidthPx);
  const text = plainTextOf(runs);

  if (text.length === 0) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  // No text engine, no measurement. `shapeRichText` shapes directly, since per-character sizes
  // and faces do not fit `TextMeasurer`.
  if (!ctx.measureText) return { x: 0, y: 0 };

  // Wrapped at the control's width: `_validate_line_caches` resizes the lines, then
  // `update_minimum_size()` runs under `fit_content` (`rich_text_label.cpp:3873,3880`).
  // `tentativeRect` is `undefined` on the first pass, as in Godot's pre-resize state.
  // The empty `normal` StyleBox (`default_theme.cpp:1186`) makes the text rect the control's.
  const wrapWidthPx = wraps ? availableWidthPx : undefined;
  const layout = shapeRichText(runs, resolveRichTextFaces(n, runs), {
    fontSizePx,
    boxWidthPx: wrapWidthPx ?? 0,
    autowrapMode: wrapWidthPx === undefined ? AutowrapMode.AUTOWRAP_OFF : autowrapMode,
    tabSize: props.tabSize,
    autowrapTrimFlags: props.autowrapTrimFlags,
  });
  const measured = {
    // `get_content_width` maxes `TS->shaped_text_get_size(lines_rid[i])`
    // (`text_paragraph.cpp:601-608`): the ceiled extent.
    x: contentWidthPx(layout),
    y: richTextContentHeightPx(runs, layout),
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
  color: Rgba;
  /** This run's font size, px (`resolveRunFontSizePx`): `normal_font_size` for a plain run. */
  fontSizePx: number;
  /** The paragraph's `HorizontalAlignment` (`paragraphAlignment`). */
  alignment: number;
  /** The paragraph's direction, language and override (`paragraphBidiOptions`), INHERITED resolved. */
  bidi: TextBidiOptions;
  /** Set only on a run inside an `[indent]`, `[ul]` or `[ol]` (`listing.ts`). */
  listing?: RunListing;
  /** The paragraph's `JustificationFlag` bits (`paragraphJustificationFlags`). */
  justificationFlags: number;
  /** The paragraph's tab stops, px (`paragraphTabStopsPx`). Empty falls to `tab_size`. */
  tabStopsPx: readonly number[];
  /** Set only on the `\n` run that ends a line of no height (`BBCodeRun.zeroHeightBreak`). */
  zeroHeightBreak?: true;
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
  const key =
    bold && italic
      ? RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.boldItalic
      : bold
        ? RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.bold
        : RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.italic;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const resolved = resolveNodeFontSizePx(n, key, props.themeOverrideFontSizes?.[key], builtInDefaultPx);
  cache.set(key, resolved);
  return resolved;
}

/** An `[img]` run's resolved size and spec, or `undefined` while its texture cannot size it. */
function resolveImage(
  spec: ParsedImgTag,
  n: SolveNode,
  boxWidthPx: number | undefined
): ResolvedImageRun | undefined {
  const widthPx = resolveImageDimension(spec.width, spec.widthInPercent, boxWidthPx);
  const heightPx = resolveImageDimension(spec.height, spec.heightInPercent, boxWidthPx);
  const sizePx = imageSizePx(widthPx, heightPx, spec.region, n.textureSlots[spec.path]);
  return sizePx ? { spec, sizePx } : undefined;
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
  defaultColor: Rgba,
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
            alignment: paragraphAlignment([], props.horizontalAlignment),
            bidi: controlBidiOptions(props, n),
            ...paragraphShapeOptions([], props),
          },
        ];
  }

  // One Theme walk per style key, however many spans the paragraph has.
  const runFontSizeCache = new Map<string, number>();
  const fontSizePxOf = (bold: boolean, italic: boolean): number =>
    resolveRunFontSizePx(bold, italic, props, normalFontSizePx, n, builtInDefaultPx, runFontSizeCache);
  const styled: StyledTextRun[] = [];
  for (const run of parseBBCodeRuns(raw)) {
    const listing = runListing({
      tags: run.tags,
      startTags: run.startTags,
      openedAtStart: run.openedAtStart,
      defaultColor,
      fontSizePxOf,
    });
    const image = run.rule
      ? resolveRule(run.rule, boxWidthPx, defaultColor)
      : run.image && resolveImage(run.image, n, boxWidthPx);
    if (run.rule || run.image) {
      // An image that cannot be sized yet is dropped, as a failed load is in Godot.
      if (!image) continue;
      styled.push({
        text: run.text,
        bold: false,
        italic: false,
        underline: false,
        color: image.spec.color,
        // Carries the object width: `imageObjectFontMetrics`.
        fontSizePx: image.sizePx.x,
        alignment: paragraphAlignment(run.tags, props.horizontalAlignment),
        bidi: paragraphBidiOptions(run.tags, props, n),
        listing,
        ...paragraphShapeOptions(run.tags, props),
        image,
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
      fontSizePx: fontSizePxOf(bold, italic),
      alignment: paragraphAlignment(run.tags, props.horizontalAlignment),
      bidi: paragraphBidiOptions(run.tags, props, n),
      listing,
      ...paragraphShapeOptions(run.tags, props),
      zeroHeightBreak: run.zeroHeightBreak,
    });
  }
  return styled;
}

/** The justification flags and tab stops of the paragraph the tags open on. */
function paragraphShapeOptions(
  tags: readonly OpenBBCodeTag[],
  props: RichTextLabelProperties
): Pick<StyledTextRun, 'justificationFlags' | 'tabStopsPx'> {
  return {
    justificationFlags: paragraphJustificationFlags(tags, props.justificationFlags),
    tabStopsPx: paragraphTabStopsPx(tags, props.tabStopsPx ?? []),
  };
}

/** The text the runs draw, without their tags. */
function plainTextOf(styledRuns: readonly StyledTextRun[]): string {
  return styledRuns.map((run) => run.text).join('');
}

/**
 * One value per character of the concatenated text of `styledRuns`, the shape `shapeText`'s
 * per-character options take. An index past the end takes the last character's value.
 */
function perCharacter<T>(
  styledRuns: readonly StyledTextRun[],
  valueOf: (run: StyledTextRun) => T
): (charIndex: number) => T | undefined {
  const values: T[] = [];
  for (const run of styledRuns) {
    const value = valueOf(run);
    for (let i = 0; i < run.text.length; i++) values.push(value);
  }
  return (charIndex) => (charIndex < values.length ? values[charIndex] : values.at(-1));
}

/** The per-character `fontSizePxAt` for `shapeText`. 0 for no runs. */
function fontSizePxAtFromRuns(styledRuns: readonly StyledTextRun[]): (charIndex: number) => number {
  const sizeAt = perCharacter(styledRuns, (run) => run.fontSizePx);
  return (charIndex) => sizeAt(charIndex) ?? 0;
}

/**
 * The per-character `fontMetricsAt` for `shapeText`: each character takes the face of its run
 * (`faceOfStyle`), and an `[img]` placeholder the normal face with the image's advance
 * (`imageObjectFontMetrics`). Past the end, and for no runs, it is the last run's face and the
 * normal one.
 */
function fontMetricsAtFromRuns(
  styledRuns: readonly StyledTextRun[],
  faces: RichTextFaces
): (charIndex: number) => FontMetrics {
  const faceAt = perCharacter(styledRuns, (run) =>
    run.image ? imageObjectFontMetrics(faces.normal) : faceOfStyle(faces, run)
  );
  return (charIndex) => faceAt(charIndex) ?? faces.normal;
}

/** The run a character of the concatenated text is in (`runAtFromRuns`). */
type RunAt = (charIndex: number) => StyledTextRun | undefined;

/**
 * The run a character of the concatenated text is in, found by its start among the runs' starts: a
 * lookup once per paragraph or line needs no table as long as the text. Past the end it is the last
 * run, and undefined for no runs.
 */
function runAtFromRuns(styledRuns: readonly StyledTextRun[]): RunAt {
  // An empty run holds no character, so only the others take part.
  const runs = styledRuns.filter((run) => run.text.length > 0);
  const starts: number[] = [];
  let start = 0;
  for (const run of runs) {
    starts.push(start);
    start += run.text.length;
  }
  return (charIndex) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle]! <= charIndex) low = middle;
      else high = middle - 1;
    }
    return runs[low];
  };
}

/**
 * The per-paragraph `paragraphBidiAt` for `shapeText`: each paragraph takes the options of the run
 * its first character is in, as a line reads them from its first item (`rich_text_label.cpp:598-599`).
 */
function paragraphBidiAtFromRuns(runAt: RunAt): (paragraphStart: number) => TextBidiOptions {
  return (paragraphStart) => runAt(paragraphStart)?.bidi ?? {};
}

/**
 * The per-paragraph `tabStopsPxAt` for `shapeText`: each paragraph takes the stops of the run it
 * starts in, and a paragraph with none takes `defaultStopsPx`.
 */
function tabStopsPxAtFromRuns(
  runAt: RunAt,
  defaultStopsPx: readonly number[]
): (paragraphStart: number) => readonly number[] {
  return (paragraphStart) => {
    const stopsPx = runAt(paragraphStart)?.tabStopsPx ?? [];
    return stopsPx.length > 0 ? stopsPx : defaultStopsPx;
  };
}

/** The shaped text, and the inset and marker of each paragraph that sits in an indent or a list. */
export interface RichTextLayout extends TextLayoutResult {
  listings?: ReadonlyMap<number, ParagraphListing>;
}

/** What `shapeRichText` takes from the control: the paragraph's box, and the three properties that shape it. */
interface RichTextShapeOptions
  extends
    Pick<ShapeTextOptions, 'fontSizePx' | 'boxWidthPx' | 'autowrapMode'>,
    Pick<RichTextLabelProperties, 'tabSize' | 'autowrapTrimFlags'> {}

/**
 * Shapes the whole paragraph once, each character at the size and in the face of its run, so line
 * breaks see the full width. The solve and the painter both call it, so measure and paint wrap alike.
 */
export function shapeRichText(
  styledRuns: readonly StyledTextRun[],
  faces: RichTextFaces,
  options: RichTextShapeOptions
): RichTextLayout {
  const { fontSizePx, boxWidthPx, autowrapMode, autowrapTrimFlags } = options;
  const tabSize = options.tabSize ?? DEFAULT_TAB_SIZE;
  const runAt = runAtFromRuns(styledRuns);
  const listings = paragraphListings(styledRuns, { faces, tabSize });
  const layout = shapeText(plainTextOf(styledRuns), {
    fontSizePx,
    boxWidthPx,
    autowrapMode,
    // `line_separation` and `paragraph_separation` are 0 (`default_theme.cpp:1217-1218`), not Label's 3.
    lineSpacingPx: 0,
    fontSizePxAt: fontSizePxAtFromRuns(styledRuns),
    fontMetricsAt: fontMetricsAtFromRuns(styledRuns, faces),
    fontMetrics: faces.normal,
    tabStopsPxAt: tabStopsPxAtFromRuns(runAt, getFontTabStopsPx(faces.normal, tabSize, fontSizePx)),
    autowrapTrimFlags,
    paragraphSeparator: '\n',
    terminateLastParagraph: false,
    paragraphBidiAt: paragraphBidiAtFromRuns(runAt),
    paragraphIndentPx: (paragraphStart) => listings.get(paragraphStart)?.indentPx ?? 0,
  });
  return listings.size > 0 ? { ...layout, listings } : layout;
}

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
interface RichTextRunPlacement {
  lineIndex: number;
  /** The line's top from the control's top: `RichTextLineMetrics.topPx` plus the `vertical_alignment` shift (`richTextVerticalOffsets`). */
  lineTopPx: number;
  /** The line's left offset, per line since each aligns by its own width (`richTextHorizontalOffsetPx`). */
  lineOffsetXPx: number;
  underline: boolean;
  color: Rgba;
  /** The run's font size, px, for its glyphs. The baseline is the line's: `layout.baselineOffsetPx`. */
  fontSizePx: number;
  /** A single-line layout of only this run's glyphs from the line, `glyph.x` already line-relative. */
  layout: TextLayoutResult;
  image?: RichTextImagePlacement;
}

/**
 * Keeps the parent's `linePitchPx` (`soloLineLayout`) and takes the run's own face, since `TextRun`
 * picks atlas or canvas painting, and the shear, from `layout.fontMetrics`. `baselineOffsetPx` is
 * the line's ascent, applied once per line (`rich_text_label.cpp:1055`'s `off.y += l_ascent`),
 * so mixed sizes share it.
 */
function soloRunLayout(
  segment: RunLineSegment,
  parentLayout: TextLayoutResult,
  lineAscentPx: number
): TextLayoutResult {
  const { text, glyphs, fontMetrics } = segment;
  // The right edge from the line origin, not the run's own span: the glyphs keep their line-relative
  // `x`, and a canvas raster sized to the span alone would clip a run that starts mid-line.
  const lastGlyph = glyphs.at(-1);
  const widthPx = lastGlyph ? lastGlyph.x + lastGlyph.advance : 0;
  return soloLineLayout(
    { text, glyphs, widthPx, paragraphIndex: 0 },
    parentLayout,
    lineAscentPx,
    fontMetrics
  );
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
interface RichTextLineMetrics {
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
function richTextLineMetrics(
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult
): RichTextLineMetrics[] {
  return lineMetricsOf(attributeRunsToLines(styledRuns, layout), styledRuns, layout);
}

/**
 * `get_content_height`'s sum of each line's own ascent+descent, not `layout.heightPx`, a count
 * times one pitch that mixed sizes make wrong.
 */
function contentHeightOf(lines: readonly RichTextLineMetrics[]): number {
  const lastLine = lines[lines.length - 1];
  return lastLine ? lastLine.topPx + lastLine.ascentPx + lastLine.descentPx : 0;
}

/** The height of the whole shaped text, px: what the scrollbar and `fit_content` compare against. */
export function richTextContentHeightPx(
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult
): number {
  return contentHeightOf(richTextLineMetrics(styledRuns, layout));
}

/**
 * The paragraph indexes (counted by `\n`) of the lines of no height: each `zeroHeightBreak` run ends
 * one, and so does a final `\n`, which leaves a line that holds no item (`a\n` is one line tall,
 * measured in Godot 4.6.3).
 */
function zeroHeightParagraphsOf(styledRuns: readonly StyledTextRun[]): ReadonlySet<number> {
  const paragraphs = new Set<number>();
  const endsInBreak = styledRuns.at(-1)?.text.endsWith('\n') ?? false;
  if (!endsInBreak && !styledRuns.some((run) => run.zeroHeightBreak)) return paragraphs;
  let paragraphIndex = 0;
  for (const run of styledRuns) {
    for (let at = run.text.indexOf('\n'); at >= 0; at = run.text.indexOf('\n', at + 1)) {
      if (run.zeroHeightBreak) paragraphs.add(paragraphIndex);
      paragraphIndex++;
    }
  }
  if (endsInBreak) paragraphs.add(paragraphIndex);
  return paragraphs;
}

function lineMetricsOf(
  perLine: readonly RunLineSegment[][],
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult
): RichTextLineMetrics[] {
  const paragraphAscentPx = layout.baselineOffsetPx;
  const paragraphDescentPx = layout.linePitchPx - layout.baselineOffsetPx;
  const zeroHeightParagraphs = zeroHeightParagraphsOf(styledRuns);

  let topPx = 0;
  return perLine.map((segments, lineIndex) => {
    // An empty text buffer has no ascent or descent (measured in Godot 4.6.3).
    if (zeroHeightParagraphs.has(layout.lines[lineIndex]!.paragraphIndex)) {
      return { topPx, ascentPx: 0, descentPx: 0, textAscentPx: 0, textDescentPx: 0 };
    }
    // Text first: `_realign` measures every image against these values, and an
    // image adds nothing to them.
    let ascentPx = 0;
    let descentPx = 0;
    for (const segment of segments) {
      const run = styledRuns[segment.runIndex]!;
      if (run.image) continue;
      ascentPx = Math.max(ascentPx, getFontAscentPx(segment.fontMetrics, run.fontSizePx));
      descentPx = Math.max(descentPx, fontDescentPx(segment.fontMetrics, run.fontSizePx));
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
      const yOffset = imageBaselineOffsetPx(
        textAscentPx,
        textDescentPx,
        run.image.sizePx.y,
        run.image.spec.alignment
      );
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
interface RichTextUnderlineMetrics {
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
  /** The face the glyphs were shaped in: the run's. */
  fontMetrics: FontMetrics;
}

/**
 * Splits each shaped line back into its style runs by each glyph's `sourceIndex`. `shapeText`
 * shapes the whole text once so line breaks see its full width, and this split is not a Godot
 * port. It also tells which font sizes land on each line.
 */
function attributeRunsToLines(
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult
): RunLineSegment[][] {
  const charRunIndex: number[] = [];
  styledRuns.forEach((run, runIdx) => {
    for (let i = 0; i < run.text.length; i++) charRunIndex.push(runIdx);
  });
  // A terminator glyph sits past the last character of its paragraph, on the separator itself.
  const runOf = (glyph: GlyphPlacement): number => charRunIndex[glyph.sourceIndex!] ?? styledRuns.length - 1;

  return layout.lines.map((line) => {
    const segments: RunLineSegment[] = [];
    let start = 0;
    while (start < line.glyphs.length) {
      const runIndex = runOf(line.glyphs[start]!);
      let end = start + 1;
      while (end < line.glyphs.length && runOf(line.glyphs[end]!) === runIndex) end++;
      const glyphs = line.glyphs.slice(start, end);
      segments.push({
        runIndex,
        text: glyphs.map((g) => g.char).join(''),
        glyphs,
        fontMetrics: glyphs[0]!.fontMetrics ?? layout.fontMetrics,
      });
      start = end;
    }
    return segments;
  });
}

// ── Paragraph alignment (rich_text_label.cpp, text_paragraph.cpp) ──

const {
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_RIGHT,
  HORIZONTAL_ALIGNMENT_FILL,
} = HorizontalAlignment;

/**
 * A line's left offset: the arms of `_draw_line` (`rich_text_label.cpp:987-1014`), not
 * `TextParagraph::draw` (`scene/resources/text_paragraph.cpp:989-1023`), whose guards at `:1004`
 * and `:990` it lacks. `isRtl` is the direction the paragraph sets, `text_buf->get_direction()`
 * (`:940`), so an AUTO paragraph stays at the left. An overflowing line hangs off the leading edge,
 * clipped at `:8225`. `lineWidthPx` is ceiled, as `:984` reads it.
 */
function richTextHorizontalOffsetPx(
  lineWidthPx: number,
  boxWidthPx: number,
  alignment: number,
  isRtl: boolean
): number {
  // `_draw_line` takes the width less the scrollbar's and the paragraph's inset, which the caller
  // passes as `boxWidthPx`.
  switch (alignment) {
    case HORIZONTAL_ALIGNMENT_CENTER:
      // Floored as Godot floors the glyph (`text_server_adv.cpp:4084`), which absorbs
      // the `int p_width` (`rich_text_label.h:672,678`) but not the line's ceil
      // (`text_paragraph.cpp:773-779`, `text_server_adv.cpp:7524-7537`). Label
      // truncates instead, a pixel apart on an overflowing line.
      return Math.floor((boxWidthPx - lineWidthPx) / 2);
    case HORIZONTAL_ALIGNMENT_RIGHT:
      return isRtl ? 0 : Math.floor(boxWidthPx - lineWidthPx);
    case HORIZONTAL_ALIGNMENT_LEFT:
    case HORIZONTAL_ALIGNMENT_FILL:
    default:
      return isRtl ? Math.floor(boxWidthPx - lineWidthPx) : 0;
  }
}

/** `vertical_alignment`'s two contributions: a one-off shift of the whole block, and an extra gap between lines under FILL. */
interface RichTextVerticalOffsets {
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
function richTextVerticalOffsets(
  contentHeightPx: number,
  boxHeightPx: number,
  alignment: number | undefined,
  lineCount: number
): RichTextVerticalOffsets {
  // Zero separations (`:1217-1218`) collapse `:1621-1627` to the content height.
  const none = { vbeginPx: 0, vsepPx: 0 };
  if (boxHeightPx <= contentHeightPx) return none;

  switch (alignment ?? VerticalAlignment.VERTICAL_ALIGNMENT_TOP) {
    case VerticalAlignment.VERTICAL_ALIGNMENT_CENTER:
      return { vbeginPx: (boxHeightPx - contentHeightPx) / 2, vsepPx: 0 };
    case VerticalAlignment.VERTICAL_ALIGNMENT_BOTTOM:
      return { vbeginPx: boxHeightPx - contentHeightPx, vsepPx: 0 };
    case VerticalAlignment.VERTICAL_ALIGNMENT_FILL:
      return { vbeginPx: 0, vsepPx: lineCount > 1 ? (boxHeightPx - contentHeightPx) / (lineCount - 1) : 0 };
    case VerticalAlignment.VERTICAL_ALIGNMENT_TOP:
    default:
      return none;
  }
}

/** What `fitLineToWidth` reads of the control: the size behind its space-shrink floor. */
interface RichTextJustification {
  fontSizePx: number;
}

/** The box a paragraph aligns inside, plus the node's own two alignment properties. */
interface RichTextAlignment {
  boxWidthPx: number;
  boxHeightPx: number;
  horizontalAlignment?: number;
  verticalAlignment?: number;
  /** How far the scroll value has moved the text up (`vofs`, `rich_text_label.cpp:1613`). Absent is 0. */
  scrollOffsetPx?: number;
  /** Absent leaves FILL paragraphs unfitted. */
  justification?: RichTextJustification;
}

/**
 * The layout with every FILL paragraph fitted to the text rect (`text_paragraph.cpp:234-292`).
 * `_shape_line` takes an `int p_width` (`rich_text_label.h:672`), so the fit width truncates.
 */
function fitFilledParagraphs(
  layout: RichTextLayout,
  isFilled: (firstLineIndex: number) => boolean,
  flagsOf: (firstLineIndex: number) => number,
  boxWidthPx: number,
  justification: RichTextJustification
): RichTextLayout {
  const lines = justifyParagraphs(layout.lines, {
    widthPx: Math.trunc(boxWidthPx),
    flags: flagsOf,
    fontSizePx: justification.fontSizePx,
    isFilled,
  });
  return { ...layout, lines };
}

/**
 * One placement per line and style run, with each line's top and baseline from
 * `richTextLineMetrics` and its alignment offsets. Alignment and direction resolve per
 * paragraph, since tags differ between paragraphs. Without `alignment`, the box is zero-width
 * and no line falls below it.
 */
export function layoutRichTextRuns(
  styledRuns: readonly StyledTextRun[],
  unfittedLayout: RichTextLayout,
  alignment?: RichTextAlignment
): RichTextRunPlacement[] {
  const boxWidthPx = alignment?.boxWidthPx ?? 0;
  // Every line of a paragraph aligns as its first item does (`rich_text_label.cpp:598-599`).
  const runAt = runAtFromRuns(styledRuns);
  const paragraphRunOf = (lineIndex: number): StyledTextRun | undefined =>
    runAt(unfittedLayout.lines[lineIndex]?.paragraphStart ?? 0);
  const alignmentOfLine = (lineIndex: number): number =>
    paragraphRunOf(lineIndex)?.alignment ?? alignment?.horizontalAlignment ?? HORIZONTAL_ALIGNMENT_LEFT;

  const unfittedPerLine = attributeRunsToLines(styledRuns, unfittedLayout);
  const isFilled = (firstLineIndex: number): boolean =>
    alignmentOfLine(firstLineIndex) === HORIZONTAL_ALIGNMENT_FILL;
  // A label with no FILL paragraph keeps its layout object, so it skips the second attribution.
  let hasFilledParagraph = false;
  for (let i = 0; i < unfittedLayout.lines.length; i++) {
    if (startsParagraph(unfittedLayout.lines, i) && isFilled(i)) hasFilledParagraph = true;
  }
  const flagsOf = (firstLineIndex: number): number => paragraphRunOf(firstLineIndex)?.justificationFlags ?? 0;
  const layout =
    alignment?.justification && hasFilledParagraph
      ? fitFilledParagraphs(unfittedLayout, isFilled, flagsOf, boxWidthPx, alignment.justification)
      : unfittedLayout;
  // Fitting moves glyphs and keeps their text, so the second attribution reads the same runs.
  const perLine = layout === unfittedLayout ? unfittedPerLine : attributeRunsToLines(styledRuns, layout);
  const lineMetrics = lineMetricsOf(perLine, styledRuns, layout);

  const { vbeginPx, vsepPx } = richTextVerticalOffsets(
    contentHeightOf(lineMetrics),
    alignment?.boxHeightPx ?? 0,
    alignment?.verticalAlignment,
    layout.lines.length
  );

  const placements: RichTextRunPlacement[] = [];
  perLine.forEach((segments, lineIndex) => {
    const { topPx, ascentPx, descentPx, textAscentPx, textDescentPx } = lineMetrics[lineIndex]!;
    // `vbegin` and `vsep` are fractional. In Godot a 23px line centred in a 150px box has
    // `vbegin` 63.5 and ink on row 69, since the glyph floors (`text_server_adv.cpp:4083`'s
    // `cpos.y = Math::floor(cpos.y)`) and the line top does not.
    const exactTopPx = topPx + vbeginPx + lineIndex * vsepPx - (alignment?.scrollOffsetPx ?? 0);
    // A line that starts at or below the box bottom, or ends at or above its top, is never drawn
    // (`:973,978-981`), clipped or not.
    if (alignment && (exactTopPx >= alignment.boxHeightPx || exactTopPx + ascentPx + descentPx <= 0)) return;
    const lineWidthPx = shapedTextSizeWidthPx(layout.lines[lineIndex]?.widthPx ?? 0);
    const isRtl = isDrawnRtl(paragraphRunOf(lineIndex)?.bidi ?? {});
    // The text rect starts after the inset, or ends before it under RTL (`:988-996`).
    const indentPx = layout.lines[lineIndex]?.indentPx ?? 0;
    const lineOffsetXPx =
      (isRtl ? 0 : indentPx) +
      richTextHorizontalOffsetPx(lineWidthPx, boxWidthPx - indentPx, alignmentOfLine(lineIndex), isRtl);
    const marker = startsParagraph(layout.lines, lineIndex)
      ? layout.listings?.get(layout.lines[lineIndex]!.paragraphStart!)?.marker
      : undefined;
    if (marker) {
      placements.push({
        lineIndex,
        lineTopPx: Math.floor(exactTopPx),
        // Beside the text, on the side it starts from (`:1021-1038`).
        lineOffsetXPx: isRtl ? lineOffsetXPx + lineWidthPx : lineOffsetXPx - marker.widthPx,
        underline: false,
        color: marker.color,
        fontSizePx: marker.fontSizePx,
        layout: marker.layout,
      });
    }
    for (const segment of segments) {
      const run = styledRuns[segment.runIndex]!;
      const lineTopPx = Math.floor(exactTopPx);
      placements.push({
        lineIndex,
        lineTopPx,
        lineOffsetXPx,
        underline: run.underline,
        color: run.color,
        fontSizePx: run.fontSizePx,
        layout: soloRunLayout(segment, layout, ascentPx),
        image: run.image
          ? {
              spec: run.image.spec,
              xPx: segment.glyphs[0]?.x ?? 0,
              yPx:
                ascentPx +
                imageBaselineOffsetPx(
                  textAscentPx,
                  textDescentPx,
                  run.image.sizePx.y,
                  run.image.spec.alignment
                ),
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
interface UnderlineRectPx {
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
