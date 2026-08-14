/**
 * RichTextLabel's native (WebGL canvas) rect solver — `get_minimum_size`
 * (`scene/gui/rich_text_label.cpp:8036-8047`), backed by `get_content_height`/
 * `get_content_width` (`:7491-7522`); the theme-override key mapping
 * (`normal_font_size`/`default_color`) and default colour RichTextLabel reads
 * (`scene/theme/default_theme.cpp:1194-1211`); plus the bbcode-subset →
 * styled-run split the native painter draws from. Registered via
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
import { getFontAscentPx, getFontLinePitchPx, type FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics, resolveNodeFontSizePx } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { ControlColor } from '../control/types';
import type { RichTextLabelProperties } from './types';
import { hasOpenTag, lastTagValue, parseBBCodeRuns, resolveBBColor } from './bbcode';

/** RichTextLabel reads `theme_override_font_sizes/normal_font_size` and `theme_override_colors/default_color` — different override key NAMES from Label's `font_size`/`font_color`, same mechanism (`textTheme.ts`). */
export const RICH_TEXT_LABEL_THEME_KEYS: TextThemeKeys = { sizeKey: 'normal_font_size', colorKey: 'default_color' };

/**
 * RichTextLabel's own PLAIN-paragraph theme font key —
 * `scene/theme/default_theme.cpp:1194`: `theme->set_font("normal_font",
 * "RichTextLabel", Ref<Font>());`. Godot's `_find_font` (`rich_text_label.cpp:
 * 3226-3296`) reads a DIFFERENT key per bbcode style (`bold_font`/
 * `italics_font`/`bold_italics_font`/`mono_font`) — out of scope here exactly
 * like `resolveRunFontSizePx`'s own doc frames the style-specific font-SIZE
 * keys: this engine synthesizes bold/italic as an MSDF-distance-field/shear
 * effect over the SAME base face (`BOLD_DISTANCE_BIAS`/`ITALIC_SKEW`, this
 * module's own doc), never a separate loaded font resource, so only the
 * paragraph's own base key is resolved to a `FontMetrics` at all.
 */
export const RICH_TEXT_LABEL_THEME_FONT_KEY = 'normal_font';

/** `default_theme.cpp:1205`: `theme->set_color("default_color", "RichTextLabel", Color(1, 1, 1))` — opaque white, its own literal (coincidentally the same value as Label's, a separate call site). */
export const RICH_TEXT_LABEL_DEFAULT_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

/** `rich_text_label.h:557`: `TextServer::AutowrapMode autowrap_mode = TextServer::AUTOWRAP_WORD_SMART;` — RichTextLabel's own default, unlike Label's OFF (`label.h`/`Label`'s constructor). */
export const RICH_TEXT_LABEL_DEFAULT_AUTOWRAP = AutowrapMode.WORD_SMART;

/** Resolves this RichTextLabel's own theme font size/colour (overrides, else the ancestor Theme chain / theme default / RichTextLabel's own white — `resolveTextTheme`'s own doc). */
export function richTextLabelTextTheme(
  n: SolveNode,
  props: RichTextLabelProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: RICH_TEXT_LABEL_DEFAULT_FONT_COLOR };
  return resolveTextTheme(n, props, RICH_TEXT_LABEL_THEME_KEYS, defaults);
}

/**
 * `RichTextLabel::get_minimum_size` (`rich_text_label.cpp:8036-8047`):
 *
 * ```
 * Size2 sb_min_size = theme_cache.normal_style->get_minimum_size(); // (0,0):
 *   normal_style is StyleBoxEmpty (default_theme.cpp:1186), not modelled here,
 *   same non-goal Label's own nativeSolver.ts documents for its own chrome.
 * Size2 min_size;
 * if (fit_content) {
 *   min_size.x = get_content_width();
 *   min_size.y = get_content_height();
 * }
 * return sb_min_size + ((autowrap_mode != AUTOWRAP_OFF) ? Size2(1, min_size.height) : min_size);
 * ```
 *
 * Two divergences from Label's own `get_minimum_size` this ports separately
 * rather than reusing Label's shape:
 *
 * - WITHOUT `fit_content`, `min_size` stays `Size2()` (zero) — RichTextLabel's
 *   box NEVER floors to its own text unless `fit_content` opts in (Label,
 *   by contrast, always floors to its single line). Autowrap still floors the
 *   WIDTH to 1 regardless (`Size2(1, 0)`), since that branch of the ternary
 *   fires on `autowrap_mode` alone, independent of `fit_content`.
 * - `get_content_height` (`:7491-7506`) short-circuits to 0 for empty text
 *   (`to_line === 0`), UNLIKE Label's `get_line_height()` empty-text fallback
 *   to `font->get_height()` — an RichTextLabel with no text contributes
 *   nothing even with `fit_content` on.
 *
 * `get_content_height`'s own accumulation (`total_height = ... + line_count *
 * line_separation + paragraph_separation`, non-negative branch) adds a term
 * that is 0 by default (`default_theme.cpp:1217-1218`: both `line_separation`
 * and `paragraph_separation` default to 0 for RichTextLabel — a THEME
 * CONSTANT, not modelled as an override here, matching Label's own theme-
 * override-chrome non-goal), so content height reduces to `N *
 * getLinePitchPx(fontSizePx, 0)` — RichTextLabel's own per-line step is the
 * bare ascent+descent, with NO extra spacing folded in (contrast Label's own
 * `getLinePitchPx(fontSizePx)` default-3 spacing).
 *
 * `ctx.measureText` takes that spacing as an argument and defaults it to 0, so
 * this reads its `.y` directly. It used to shape at Label's constant whatever
 * the caller was, leaving each widget to undo it — which is how the widgets
 * that did not undo it ended up a whole `line_spacing` too tall.
 */
export const richTextLabelMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as RichTextLabelProperties;
  const autowrapMode = clampAutowrapMode(props.autowrapMode, RICH_TEXT_LABEL_DEFAULT_AUTOWRAP);
  const wraps = autowrapMode !== AutowrapMode.OFF;

  if (!props.fitContent) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  const { fontSizePx, color } = richTextLabelTextTheme(n, props, ctx);
  const runs = styledTextRuns(n, props, color, fontSizePx, ctx.theme.fontSize);
  const text = runs.map((r) => r.text).join('');

  if (text.length === 0) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  // `ctx.measureText` is the text engine's own presence signal (`null` until
  // it lands) — this measurement calls `shapeText` directly rather than
  // through it, since a bold/italic-mixed line needs `fontSizePxAt` (a
  // per-CHARACTER size `TextMeasurer`'s flat-size signature has no room for),
  // but the gate stays: no text engine, no attempted measurement.
  if (!ctx.measureText) return { x: 0, y: 0 };

  const fontMetrics = resolveNodeFontMetrics(n, RICH_TEXT_LABEL_THEME_FONT_KEY);
  // `line_separation` is 0 for RichTextLabel (`default_theme.cpp:1217`) —
  // NOT Label's 3, which is why `lineSpacingPx` is stated rather than defaulted.
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx: 0,
    fontSizePxAt: fontSizePxAtFromRuns(runs),
    fontMetrics,
  });
  // `get_content_height` sums each PARAGRAPH's `text_buf->get_size().y`, itself
  // the sum of its own lines' ascent+descent — never a count times one pitch,
  // which a `[b]`/`[i]` span at a size of its own would make wrong by a pixel
  // per size change (`richTextLineMetrics`).
  const lines = richTextLineMetrics(runs, layout);
  const lastLine = lines[lines.length - 1];
  const measured = {
    // `get_content_width` maxes `l.text_buf->get_size().x`, itself a max over
    // `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`)
    // — the CEILED extent, not the raw pen advance.
    x: shapedTextSizeWidthPx(layout.widthPx),
    y: lastLine ? lastLine.topPx + lastLine.ascentPx + lastLine.descentPx : 0,
  };

  if (wraps) {
    return { x: 1, y: measured.y };
  }
  return { x: measured.x, y: measured.y };
};

// --- Draw-time: the bbcode subset -> styled runs -> per-line/per-run placement ---

/** One styled run of the plain (tag-stripped) text — the drawing-time counterpart of the old `plainTextOf`, carrying what `[b]`/`[i]`/`[u]`/`[color]` resolve to for this run. */
export interface StyledTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  /** `[u]` open anywhere on the tag stack (`rich_text_label.cpp:4677`'s `push_underline`) — drawn as a baseline-relative stroke, `underlineRectPx`. */
  underline: boolean;
  color: ControlColor;
  /** This run's OWN resolved font size, px — see `resolveRunFontSizePx`'s doc. Equal to `normal_font_size` for a plain (non-bold, non-italic) run. */
  fontSizePx: number;
  /**
   * The `HorizontalAlignment` governing the paragraph this run sits in —
   * `_find_alignment` over the run's own tag stack, falling back to the node's
   * `horizontal_alignment` property (`resolveParagraphAlignment`). Resolved
   * here because this is where the tag stack still exists; consumed a layer
   * later, once lines are known.
   */
  alignment: number;
}

/**
 * `scene/theme/default_theme.cpp:1199-1202` — RichTextLabel's default theme
 * registers FOUR independent font-size keys, one per `_find_font`
 * (`rich_text_label.cpp:3226-3296`) font selection, each its OWN theme
 * constant rather than a shared one:
 *
 * ```
 * theme->set_font_size("normal_font_size", "RichTextLabel", -1);
 * theme->set_font_size("bold_font_size", "RichTextLabel", -1);
 * theme->set_font_size("italics_font_size", "RichTextLabel", -1);
 * theme->set_font_size("bold_italics_font_size", "RichTextLabel", -1);
 * ```
 *
 * `_find_font` reads the matching one UNCONDITIONALLY per style
 * (`:3257`/`:3270`/`:3283`: `fi->font_size = theme_cache.bold_font_size` for
 * `RTL_BOLD_FONT`, etc.) — a `[b]` span NEVER falls back to
 * `theme_cache.normal_font_size`, even though every one of these defaults to
 * the SAME sentinel. `Theme::get_font_size` (`scene/resources/theme.cpp:
 * 658-661`) treats a stored value `<= 0` as unset and falls through to
 * `ThemeDB::get_fallback_font_size()` — hardcoded 16
 * (`scene/theme/theme_db.h:85`) — independently of whatever `normal_font_size`
 * itself resolved to. So a scene overriding ONLY `normal_font_size` (this
 * fixture's own `18`) renders every `[b]`/`[i]`/`[b][i]` span at Godot's
 * fallback size (16, scaled) instead — two pixels smaller here, which is why
 * a styled run's own cumulative advance runs measurably short of the
 * surrounding plain text: measured directly against real Godot 4.6.3
 * (`pnpm ref:godot`, richtextlabel/comparison.md's own worked numbers), the
 * bold word "Bold" alone advances the pen ~3px less than the SAME word set
 * unstyled, and the italic word "italic" alone ~4px less — both close entirely
 * when the scene ALSO overrides the style-specific key to match
 * `normal_font_size`.
 */
const RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS = {
  boldItalic: 'bold_italics_font_size',
  bold: 'bold_font_size',
  italic: 'italics_font_size',
} as const;

/**
 * A styled run's own font size — `normalFontSizePx` for a plain run, else the
 * matching `RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS` key resolved through the
 * SAME ancestor-Theme walk `richTextLabelTextTheme` uses for
 * `normal_font_size` (`resolveNodeFontSizePx`/`Theme::get_font_size`,
 * `scene/resources/theme.cpp:658-666`) — NEVER falling back to
 * `normalFontSizePx` itself, see `RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS`'s own
 * doc: a `[b]` span's key is looked up independently, all the way down to
 * `builtInDefaultPx` (Godot's `ThemeDB::get_fallback_font_size()`), so an
 * ancestor Theme setting only `default_font_size` resolves the SAME size for
 * `[b]` text as it does for the surrounding plain text (a scene overriding
 * ONLY `normal_font_size` locally, by contrast, still leaves `[b]` at the
 * built-in default — that divergence is Godot's own real behaviour, not a
 * bug this walk papers over).
 *
 * `cache` is `styledTextRuns`'s OWN per-call memo, keyed by the style key
 * itself — only 3 keys exist at all (`RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS`),
 * so a paragraph with N styled spans (`[b]` repeated, say, five times) walks
 * the ancestor Theme chain at most 3 times total rather than once per span:
 * every input to the walk (`n.themeChain`/`n.projectTheme`/`props.themeOverrideFontSizes`/
 * `normalFontSizePx`/`builtInDefaultPx`) is fixed for the WHOLE `styledTextRuns`
 * call, so the same key always resolves to the same answer within it.
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
 * Splits `props.text` into styled runs. With `bbcode_enabled` false, Godot
 * shows the text literally — bracket characters included, no styling at all
 * (`Component.tsx`'s own header comment; ADR-0003) — a single run at
 * `normalFontSizePx`. With it true, every run gets `[b]`/`[i]`'s boolean flags
 * (independent, and they COMBINE when nested — `rich_text_label.cpp:
 * 5452-5471`'s `RTL_BOLD_ITALICS_FONT` selection), `[u]`'s boolean flag
 * (independent of both — Godot's underline is a drawn STROKE, not a font
 * variant, so it combines freely with bold/italic/colour), the innermost open
 * `[color=...]`'s value resolved via `resolveBBColor`, falling back to
 * `defaultColor` (this node's own resolved theme colour) absent an override,
 * AND its own resolved font size (`resolveRunFontSizePx`) — every other
 * recognised-but-out-of-scope tag ([s]/[code]/[center]) still tokenizes (so
 * nesting stays correct) but contributes no native styling here, same as an
 * unrecognised tag.
 */
export function styledTextRuns(
  n: SolveNode,
  props: RichTextLabelProperties,
  defaultColor: ControlColor,
  normalFontSizePx: number,
  builtInDefaultPx: number
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

  // Per-call memo — see `resolveRunFontSizePx`'s own doc: bounds the ancestor
  // Theme walk at 3 (one per possible style key) regardless of how many
  // styled spans this paragraph declares.
  const runFontSizeCache = new Map<string, number>();
  return parseBBCodeRuns(raw)
    .filter((run) => run.text.length > 0)
    .map((run) => {
      const colorValue = lastTagValue(run.tags, 'color');
      const bold = hasOpenTag(run.tags, 'b');
      const italic = hasOpenTag(run.tags, 'i');
      return {
        text: run.text,
        bold,
        italic,
        underline: hasOpenTag(run.tags, 'u'),
        color: colorValue !== undefined ? resolveBBColor(colorValue, defaultColor) : defaultColor,
        fontSizePx: resolveRunFontSizePx(bold, italic, props, normalFontSizePx, n, builtInDefaultPx, runFontSizeCache),
        alignment: resolveParagraphAlignment(run.tags, props.horizontalAlignment),
      };
    });
}

/**
 * Builds the per-character `fontSizePxAt` callback `shapeText` accepts, from
 * `styledTextRuns`' own OUTPUT — one lookup array over the SAME concatenated
 * plain text those runs' `.text` fields join into (in order), so the index
 * `shapeText` walks lines up with the index this array was built from.
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
 * `scene/theme/default_theme.cpp:1392-1403` — Godot's default theme has no
 * separate bold/italic font FILES for RichTextLabel; it builds three
 * `FontVariation`s over the SAME base font:
 *
 * ```
 * bold_font->set_variation_embolden(1.2);                                             // :1394
 * bold_italics_font->set_variation_embolden(1.2);                                      // :1398 (bold+italic COMBINES both effects)
 * bold_italics_font->set_variation_transform(Transform2D(1.0, 0.2, 0.0, 1.0, 0.0, 0.0)); // :1399
 * italics_font->set_variation_transform(Transform2D(1.0, 0.2, 0.0, 1.0, 0.0, 0.0));      // :1403
 * ```
 *
 * `Transform2D(1.0, 0.2, 0.0, 1.0, ...)`'s x-basis is `(1, 0.2)`: a shear of
 * 0.2 horizontal units per vertical unit, EXACTLY `TextRun`'s own `skew`
 * parameter's semantics (`dx = -skew * (yPx - lineTopPx)`, `TextRun.tsx`) —
 * `ITALIC_SKEW` transcribes it directly, no conversion needed.
 *
 * `variation_embolden` has no such direct analogue: it is a FreeType outline
 * stroke-widening strength consumed by `modules/text_server_adv/
 * text_server_adv.cpp:1313-1314` (`FT_Pos strength = embolden * p_size.x / 16`,
 * a 26.6 fixed-point FreeType unit), a completely different rasterizer and
 * unit space from this engine's MSDF `distanceBias` (a normalized signed-
 * distance threshold shift — `msdfMaterial.ts`, whose own doc already frames
 * `distanceBias` as a parameterised synthesized-bold effect, not a calibrated
 * port) — there is no formula converting one to the other, so this value is
 * TUNED against a real Godot 4.6.3 measurement rather than derived.
 *
 * Measured on `unit-rich-text-label.tscn`'s `[b]Bold[/b]` span (`pnpm
 * ref:godot` / `pnpm ref:ours`, a horizontal transect through the 'l' stem —
 * a single vertical stroke, so its half-max-crossing width is the stroke
 * thickness directly, uncontaminated by any neighbouring glyph): Godot's own
 * embolden=1.2 renders that stem 3.04px wide (half-max crossings at x≈22.2
 * and x≈25.3, read on any row strictly inside the stem). Reading the SAME
 * stem's own column VERTICALLY (half-max crossings, linear-interpolated
 * between samples, at the stem's own peak-darkness column) puts Godot's
 * cap-top/baseline-bottom at y≈6.38/19.5 against this engine's y≈6.75/19.82 —
 * a real but sub-pixel (~0.35px lower) residual, not a whole row, so a single
 * integer row number still cannot address both crisply at a coarse
 * ink-visibility threshold (`richtextlabel/comparison.md`'s own divergence
 * entry has the fuller account: three glyphs on this SAME 16px run measure
 * three different residuals, which rules out a per-run constant and points
 * at Godot's own FreeType hinting, not at `buildGlyphQuadArrays`). The
 * former value here,
 * 0.08 (an unmeasured placeholder), rendered only 2.15px — visibly thinner.
 * 0.35 renders 3.01px, matching to within the measurement's own row-to-row
 * noise (a single scanline's sub-pixel crossings), without collapsing 'o's
 * counter to a solid blob: Godot's OWN real embolden at this render size
 * (18px) already nearly closes 'o's counter too (the SAME capture's 'o' glyph
 * is solid ink but for a sliver at its very top), so a closely-matched
 * counter is Godot's own behaviour at this size, not an artifact to avoid.
 * The word's own overall ink span (x1..38 here against Godot's x1..39) is
 * insensitive to this constant in the 0.08-0.35 range tested — bounded by the
 * 'd' bowl's own outermost curve, which a uniform SDF threshold shift moves
 * only a fraction of a pixel — so stem thickness, not span width, is the
 * signal this constant actually controls.
 */
export const BOLD_DISTANCE_BIAS = 0.35;

/** See `BOLD_DISTANCE_BIAS`'s doc — `default_theme.cpp:1399`/`:1403`'s `Transform2D(1.0, 0.2, ...)` shear coefficient, transcribed exactly. */
export const ITALIC_SKEW = 0.2;

/**
 * `default_theme.cpp:1231`: `theme->set_constant("underline_alpha", "RichTextLabel", 50)`.
 * `rich_text_label.cpp:1237`: absent a `[u=color]` override, the stroke's
 * colour is the run's own font colour with `.a *= underline_alpha / 100.0` —
 * a DIMMER stroke, not a differently-coloured one. This bbcode subset has no
 * `[u=color]` support (`bbcode.ts`'s own non-goal list), so every `[u]` run
 * takes this default-colour, halved-alpha path.
 */
export const RICH_TEXT_LABEL_UNDERLINE_ALPHA = 0.5;

/** One (line, contiguous-style-run) pair, ready for its own `<TextRun>`. */
export interface RichTextRunPlacement {
  lineIndex: number;
  /** This line's own box top, px, from the CONTROL's top — `RichTextLineMetrics.topPx` plus `vertical_alignment`'s own shift (`richTextVerticalOffsets`), NOT `lineIndex * layout.linePitchPx`: lines carrying different font sizes are different heights. */
  lineTopPx: number;
  /** This line's own left offset, px, from the control's left — `horizontal_alignment` or the `[center]`/`[right]` tag governing it, resolved per LINE because each is aligned by its OWN width (`richTextHorizontalOffsetPx`). */
  lineOffsetXPx: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: ControlColor;
  /** This run's OWN resolved font size, px (`StyledTextRun.fontSizePx`) — the scale `<TextRun>` draws THIS placement's glyph geometry at, which can differ from the paragraph's `normal_font_size` (`resolveRunFontSizePx`'s own doc). The BASELINE those glyphs sit on is the line's, not this size's: `layout.baselineOffsetPx`. */
  fontSizePx: number;
  /** A single-line `TextLayoutResult` wrapper holding ONLY this run's glyphs from that line — `glyph.x` values are untouched (already this LINE's own pen-relative x), so this needs no rebasing, only the line's own wrapping `<group>` position. */
  layout: TextLayoutResult;
}

/**
 * Echoes the PARENT layout's own `fontMetrics`/`linePitchPx` rather than
 * leaving them unset — see `textLayout.ts`'s `soloLineLayout`, the
 * SAME hazard: `TextRun` dispatches MSDF-atlas vs. canvas-rasterised painting
 * off `layout.fontMetrics.kind`, so an omitted value here would silently
 * force every run back onto the atlas path regardless of which font `layout`
 * (the ALREADY-SHAPED paragraph this run's glyphs were sliced from) was
 * actually shaped against.
 *
 * `baselineOffsetPx` is neither inherited from the paragraph nor re-derived
 * from this run's own size: it is the LINE's ascent (`RichTextLineMetrics`),
 * the MAX over the fonts that actually land on that line. Godot applies it
 * ONCE per line — `rich_text_label.cpp:1055`'s `off.y += l_ascent`, with
 * `off_step.y` never varying across the glyph loop that follows — so a 16px
 * `[b]` word and a 15px normal word on one line share one baseline and only
 * their glyph SIZES differ. `<TextRun>` and `paintSceneFontCanvas` both key
 * baseline placement off `layout.baselineOffsetPx` directly (with no
 * fontSizePx re-derivation of their own), so this field is the only place
 * that decision can be made.
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
 * Descent at `fontSizePx`, px — `getFontLinePitchPx` minus `getFontAscentPx`
 * at zero spacing, rather than a local ceiling of the design-unit descent:
 * `fontMetrics.ts` owns the independent-ceiling quantization rule
 * (`text_server_adv.cpp:1515-1516`) and exposes no descent getter of its own,
 * and a second reading of that rule here is exactly the drift that module's
 * doc exists to prevent.
 */
function fontDescentPx(metrics: FontMetrics, fontSizePx: number): number {
  return getFontLinePitchPx(metrics, fontSizePx, 0) - getFontAscentPx(metrics, fontSizePx);
}

/** One wrapped line's own vertical metrics — Godot recomputes these PER LINE (`text_server_adv.cpp:5486-5487`), unlike the underline's (`richTextUnderlineMetrics`). */
export interface RichTextLineMetrics {
  /** This line's box top, px, from the paragraph's top — the running sum of every earlier line's own `ascentPx + descentPx`. */
  topPx: number;
  /** Baseline offset from `topPx` — MAX `getFontAscentPx` over the fonts on THIS line. */
  ascentPx: number;
  /** MAX descent over the fonts on THIS line. */
  descentPx: number;
}

/**
 * Per-line ascent/descent/top for an already-shaped paragraph, from the sizes
 * of the runs whose glyphs actually land on each line.
 *
 * `_shape_substr` (`modules/text_server_adv/text_server_adv.cpp:5486-5487`)
 * rebuilds a wrapped line's `ascent`/`descent` as a MAX over the fonts of THAT
 * line's own glyphs, and `rich_text_label.cpp:1055`/`:1589` step `off.y` by
 * `l_ascent` before the line and `l_descent` after it. A paragraph mixing
 * `normal_font_size` with a differently-sized `[b]`/`[i]` span therefore has
 * lines of DIFFERENT heights, and every line after the first tall one sits
 * lower than one paragraph-wide pitch would put it — a full pixel per size
 * change, cumulative down the paragraph.
 *
 * `theme_cache.line_separation` adds nothing between lines here
 * (`default_theme.cpp:1217`: RichTextLabel's own default is 0, unlike Label's
 * 3), so a line's top is the bare running sum of the earlier lines' heights.
 *
 * A line with no attributed run at all — a blank line between two hard breaks,
 * whose only character is the break itself — keeps the PARAGRAPH's own
 * ascent/descent (`layout.baselineOffsetPx` and the rest of
 * `layout.linePitchPx`): Godot shapes that line's newline against the
 * paragraph's own font, so its height is that font's, never zero.
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
    let ascentPx = 0;
    let descentPx = 0;
    for (const segment of segments) {
      const { fontSizePx } = styledRuns[segment.runIndex]!;
      ascentPx = Math.max(ascentPx, getFontAscentPx(layout.fontMetrics, fontSizePx));
      descentPx = Math.max(descentPx, fontDescentPx(layout.fontMetrics, fontSizePx));
    }
    if (segments.length === 0) {
      ascentPx = paragraphAscentPx;
      descentPx = paragraphDescentPx;
    }
    const metrics = { topPx, ascentPx, descentPx };
    topPx += ascentPx + descentPx;
    return metrics;
  });
}

/** The `[u]`/`[s]` stroke geometry a whole PARAGRAPH draws with — `sd->upos`/`sd->uthk`, before `rich_text_label.cpp:1243`'s 1px floor. */
export interface RichTextUnderlineMetrics {
  /** Downward offset from the line's baseline to the stroke's CENTRE, px (`shaped_text_get_underline_position`). */
  positionPx: number;
  /** The font's own stroke thickness, px, UNFLOORED (`shaped_text_get_underline_thickness`) — `underlineRectPx` applies `MAX(1.0, uth)`, exactly where Godot does. */
  thicknessPx: number;
}

/**
 * The paragraph-wide underline position/thickness every `[u]` run in it draws
 * with — MAX over EVERY run's font size, not the underlined run's own.
 *
 * The asymmetry with `richTextLineMetrics` is Godot's, and it is easy to get
 * backwards: `_shape_substr` (`modules/text_server_adv/text_server_adv.cpp:
 * 5310-5311`) copies the parent paragraph's `upos`/`uthk` into each wrapped
 * line VERBATIM, while recomputing that line's `ascent`/`descent` from its own
 * glyphs a hundred lines further down. So `rich_text_label.cpp:1053-1054`'s
 * `upos`/`uth`, read off the LINE's rid, are really the paragraph's — a
 * paragraph containing one 16px `[b]` word draws every underline in it,
 * including a 15px one on a line with no 16px glyph, at the 16px position.
 *
 * Both are monotonic in font size (a plain scale of one `post` table), so the
 * MAX is taken over the runs' scaled values directly, which is what
 * `text_server_adv.cpp:7174-7175` accumulates glyph by glyph.
 *
 * Deliberately stays on the vendored Open Sans's OWN `post` table
 * (`openSansMetrics.ts`) rather than the resolved `FontMetrics` a scene font
 * would carry: `fontMetrics.ts`'s contract exposes no underline-position/
 * thickness fields at all (only ascent/descent/advances — a shaper's needs,
 * not a stroke-drawer's), and there is no formula deriving one font's
 * underline geometry from another's. A scene-font RichTextLabel's `[u]`
 * stroke therefore keeps Open Sans's proportions — a documented,
 * pre-existing-class residual (the same one `TextRun.tsx`'s own doc already
 * carries for outline/synthesized-bold on the canvas path: an MSDF-only
 * feature approximated rather than ported, never silently dropped).
 */
export function richTextUnderlineMetrics(styledRuns: readonly StyledTextRun[]): RichTextUnderlineMetrics {
  let positionPx = 0;
  let thicknessPx = 0;
  for (const run of styledRuns) {
    positionPx = Math.max(positionPx, getUnderlinePositionPx(run.fontSizePx));
    thicknessPx = Math.max(thicknessPx, getUnderlineThicknessPx(run.fontSizePx));
  }
  return { positionPx, thicknessPx };
}

/** One line's worth of one style run — the attribution `layoutRichTextRuns` turns into a placement and `richTextLineMetrics` reads a font size out of. */
interface RunLineSegment {
  /** Index into `styledRuns`. */
  runIndex: number;
  /** The plain (tag-stripped) text these glyphs came from. */
  text: string;
  /** This run's own glyphs from that line, `x` values untouched (already the LINE's pen-relative x). */
  glyphs: GlyphPlacement[];
}

/**
 * Attributes `layout`'s glyphs (already shaped from the CONCATENATION of every
 * `styledRuns[].text`, in order) back to their originating run, splitting each
 * line into one segment per contiguous style-run it contains.
 *
 * Godot never needs this: its own `RichTextLabel` shapes styled runs
 * natively (per-`Item` font/color, `_shape_line`) and never has to reverse
 * the mapping. This engine's `shapeText` has no notion of styled runs at all
 * (by design — `textLayout.ts` is shared by every text-bearing Control, most
 * of which have no bbcode), so the ONLY way to keep wrapping correct across a
 * `[b]`/`[i]`/`[color]` boundary (the line-break decision needs the WHOLE
 * paragraph's width, not each run measured alone) is to shape once, then
 * split back up — this function is that split, not a Godot port.
 *
 * It is also what makes a line's OWN font sizes knowable at all: which sizes
 * land on a given line is an output of wrapping, not of the markup, so
 * `richTextLineMetrics` can only take its per-line MAX ascent/descent after
 * this pass has run.
 *
 * The split walks a cursor through the plain (tag-stripped) text character by
 * character alongside each line's own glyphs: wherever a glyph's `.char`
 * doesn't match the plain text at the cursor, the cursor is a TRIMMED edge
 * space `shapeText`'s own break-trim rule dropped from the emitted line
 * (`label.h:45`'s `BREAK_TRIM_START/END_EDGE_SPACES` default, ported in
 * `textLayout.ts`) — advancing past it is always safe since trimmed
 * characters are, by that same rule, always whitespace. This is a single
 * forward pass with no substring search, so it cannot mis-attribute a run
 * from an earlier, coincidentally-identical piece of text elsewhere in the
 * paragraph.
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
      // No run, or no glyph consumed (the cursor ran off the end of the plain
      // text while glyphs remain — only reachable if `layout` was shaped from a
      // different string than `styledRuns` concatenates). Both mean this pass
      // cannot advance, and the enclosing `while` has no other exit: without
      // this it spins forever rather than dropping the unattributable tail.
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

// --- Paragraph alignment (rich_text_label.cpp + text_paragraph.cpp) ---

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

/**
 * The bbcode tags that PUSH a paragraph alignment
 * (`rich_text_label.cpp:5681-5696`) — each maps to the `HorizontalAlignment`
 * its own `push_paragraph` call passes.
 */
const ALIGNMENT_TAGS: ReadonlyMap<string, number> = new Map([
  ['left', H_LEFT],
  ['center', H_CENTER],
  ['right', H_RIGHT],
  ['fill', H_FILL],
]);

/**
 * `RichTextLabel::_find_alignment` (`rich_text_label.cpp:3492-3505`): a
 * paragraph takes the alignment of the nearest enclosing `ITEM_PARAGRAPH`,
 * falling back to `default_alignment` — the node's own `horizontal_alignment`
 * property (`:7245-7258`; the property and the tags are the SAME input, which
 * is why one function resolves both).
 *
 * The walk is outward from the item, so the INNERMOST alignment tag on the
 * stack wins; `tags` is ordered outermost-first, hence the reverse scan.
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
 * One line's own left offset — `TextParagraph::draw`'s alignment switch
 * (`scene/resources/text_paragraph.cpp:989-1023`), LTR arm.
 *
 * NOT Label's arithmetic, and deliberately so: Label aligns through
 * `Label::_get_line_rect`, which truncates and measures against the CEILED
 * shaped size, while RichTextLabel goes through `TextParagraph`, which floors
 * and measures against `shaped_text_get_width` — the raw pen advance. The two
 * disagree by a pixel on the same text, so each slice transcribes its own.
 *
 * `width > 0` guards the whole switch (`:990`): a paragraph with no width set
 * aligns nothing. CENTER additionally no-ops when the line OVERFLOWS its box
 * (`:1004`'s `length <= l_width`), where LEFT and CENTER coincide for LTR;
 * RIGHT carries no such guard and pushes an overflowing line off to the left.
 *
 * The result is floored because Godot's own floor lands one step later, on the
 * assembled glyph position (`text_server_adv.cpp:4084`'s `cpos.x =
 * Math::floor(cpos.x)`) — same pixels, and this is the only place in this
 * renderer that offset exists as a number.
 */
export function richTextHorizontalOffsetPx(
  lineWidthPx: number,
  boxWidthPx: number,
  alignment: number
): number {
  if (boxWidthPx <= 0) return 0;
  switch (alignment) {
    case H_CENTER:
      return lineWidthPx <= boxWidthPx ? Math.floor((boxWidthPx - lineWidthPx) / 2) : 0;
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
 * `RichTextLabel::_notification`'s vertical-alignment block
 * (`rich_text_label.cpp:1619-1652`).
 *
 * The `text_rect.size.y > total_height` guard (`:1630`) is load-bearing: a
 * paragraph TALLER than its box stays top-aligned rather than being pulled
 * upward by a negative offset, which is the opposite of what Label does with
 * the same authored value.
 *
 * `text_rect` is the control rect inset by the `normal` stylebox, and
 * RichTextLabel's default-theme `normal` is `make_empty_stylebox(0, 0, 0, 0)`
 * (`default_theme.cpp:1186`) — zero on every side, so the box height is the
 * solved rect's own. `line_separation`/`paragraph_separation` are both 0 for
 * this class (`:1217-1218`), which is what collapses `:1621-1627`'s two
 * branches into the plain content height.
 *
 * `vbegin`/`vsep` are `float` here (`:1628`), NOT the `int` pair Label's own
 * `get_layout_data` declares — so no truncation, and a half-pixel offset
 * survives to the glyph floor.
 */
export function richTextVerticalOffsets(
  contentHeightPx: number,
  boxHeightPx: number,
  alignment: number | undefined,
  lineCount: number
): RichTextVerticalOffsets {
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
 * One `<TextRun>`-ready placement per (line, contiguous-style-run) pair —
 * `attributeRunsToLines`'s split, carrying each line's own top and baseline
 * from `richTextLineMetrics` so a caller never has to re-derive either from a
 * paragraph-wide pitch, plus the two alignment offsets that decide where the
 * line sits inside the control.
 *
 * Alignment is resolved PER LINE rather than once for the paragraph, because
 * `_find_alignment` reads the tag stack (`[center]` et al.) and a wrapped
 * paragraph can carry different ones on different lines. `alignment` omitted
 * — the default — leaves every offset at 0, which is what LEFT/TOP produce
 * anyway.
 */
export function layoutRichTextRuns(
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult,
  alignment?: RichTextAlignment
): RichTextRunPlacement[] {
  const perLine = attributeRunsToLines(styledRuns, layout);
  const lineMetrics = lineMetricsOf(perLine, styledRuns, layout);

  const boxWidthPx = alignment?.boxWidthPx ?? 0;
  const { vbeginPx, vsepPx } = richTextVerticalOffsets(
    layout.heightPx,
    alignment?.boxHeightPx ?? 0,
    alignment?.verticalAlignment,
    layout.lines.length
  );

  const placements: RichTextRunPlacement[] = [];
  perLine.forEach((segments, lineIndex) => {
    const { topPx, ascentPx } = lineMetrics[lineIndex]!;
    // Every line on the same tag stack shares one alignment; the FIRST
    // segment's stack is that line's, since a paragraph tag cannot open
    // mid-line without starting a new paragraph.
    const lineAlignment = segments[0]
      ? styledRuns[segments[0].runIndex]!.alignment
      : (alignment?.horizontalAlignment ?? H_LEFT);
    const lineOffsetXPx = richTextHorizontalOffsetPx(
      layout.lines[lineIndex]?.widthPx ?? 0,
      boxWidthPx,
      lineAlignment
    );
    for (const segment of segments) {
      const run = styledRuns[segment.runIndex]!;
      placements.push({
        lineIndex,
        // Floored, because Godot's own floor lands one step later on the
        // assembled glyph position (`text_server_adv.cpp:4083`'s `cpos.y =
        // Math::floor(cpos.y)`) and `vbegin`/`vsep` are floats that reach it
        // fractional. Engine-checked: a 23px line centred in a 150px box puts
        // `vbegin` at 63.5 and Godot's own ink on row 69, which is where
        // flooring the line top — not the glyph — also puts it.
        lineTopPx: Math.floor(topPx + vbeginPx + lineIndex * vsepPx),
        lineOffsetXPx,
        bold: run.bold,
        italic: run.italic,
        underline: run.underline,
        color: run.color,
        fontSizePx: run.fontSizePx,
        layout: soloRunLayout(segment.text, segment.glyphs, layout, ascentPx),
      });
    }
  });

  return placements;
}

/** A `[u]`-styled run's underline stroke rect, px, in the SAME pen-space `TextRun`'s glyph geometry uses (Y-down, line-top-relative) — every edge on a whole pixel (`underlineRectPx`). */
export interface UnderlineRectPx {
  /** Left edge — the first pixel column the run's first glyph's own pen `x` covers (no left-side-bearing correction; matches `rich_text_label.cpp:1216-1244`'s `ul_start` sitting at the glyph's pen position, not its ink). */
  x0: number;
  /** Right edge, exclusive — one past the last pixel column the run's last glyph's pen `x` + advance covers. */
  x1: number;
  /** Top edge of the stroke rect — the first pixel row Godot's own quad covers. */
  topPx: number;
  /** How many whole rows that quad covers — 1 for any stroke at its `MAX(1.0, uth)` floor. */
  heightPx: number;
}

/**
 * The whole pixels an axis-aligned edge pair `[from, to)` covers when the
 * rasterizer takes ONE sample at each pixel's centre and keeps no partial
 * coverage — `[first, last]` inclusive, `last >= first` for any span at least
 * one pixel long. A pixel `n` is in iff `from <= n + 0.5 < to`, the half-open
 * top-left fill rule.
 */
function coveredPixelRange(from: number, to: number): { first: number; last: number } {
  return { first: Math.ceil(from - 0.5), last: Math.ceil(to - 0.5) - 1 };
}

/**
 * A `[u]` run's stroke rect, in the SAME pen-space `TextRun`'s glyph geometry
 * uses (Y-down, line-top-relative), snapped to the whole pixels Godot's own
 * quad covers.
 *
 * `rich_text_label.cpp:1055` (`off.y += l_ascent`) puts a line's BASELINE at
 * `lineAscentPx` below its own top — the same reference point `TextRun`'s
 * italic shear pivots at. `:1242-1244`'s `y_off = upos` offsets DOWN from that
 * baseline to the stroke's own y, and `:1243`'s `MAX(1.0, uth * base_scale)`
 * floors the stroke to at least 1px (`base_scale` — a UI content-scale factor
 * this renderer does not thread through text metrics — is always its own
 * default of 1 here, so the max only ever fires on the font's own sub-1px
 * thickness). `draw_line`'s width is CENTERED on the from/to segment, hence
 * the half-thickness split either side of the stroke's y.
 *
 * That leaves the stroke's edges on a FRACTION — a 1px rule centred 0.78 below
 * an integer baseline spans y+0.28..y+1.28. Godot draws it as a plain
 * untextured, un-antialiased quad (`canvas_item_add_line` builds one from the
 * segment and its width) onto a 2D canvas with no MSAA, so the GPU's one
 * sample per pixel centre turns those fractional edges into exactly ONE fully
 * covered row. This renderer's canvas is multisampled, where the same
 * fractional quad instead feathers across two rows at partial coverage — half
 * a rule twice over, visibly softer than a hair-line should be at any size.
 * Rounding the rect out to `coveredPixelRange` reproduces the sampling rather
 * than the geometry, which is the thing that is actually visible.
 *
 * The snap is only equivalent to snapping in canvas space because everything
 * between this rect and the canvas is whole-pixel: the Control's own drawn
 * origin (`controlPixelSnap.ts`, on by default) and every line top above this
 * one (`richTextLineMetrics` sums ceiling-quantized ascents and descents, and
 * RichTextLabel's `line_separation` is an integer 0). A fractional origin
 * would put the rule back on a fraction, one whole row away from the glyphs it
 * belongs to.
 *
 * Returns `null` for an empty glyph list — nothing to underline, same as
 * `layoutRichTextRuns` never emitting a placement for a run with no glyphs.
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

  const rows = coveredPixelRange(centerY - widthPx / 2, centerY + widthPx / 2);
  const columns = coveredPixelRange(first.x, last.x + last.advance);

  return {
    x0: columns.first,
    x1: columns.last + 1,
    topPx: rows.first,
    heightPx: rows.last + 1 - rows.first,
  };
}
