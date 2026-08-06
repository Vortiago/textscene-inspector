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
import { AutowrapMode, shapeText, type GlyphPlacement, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { resolveTextTheme, type ResolvedTextTheme, type TextThemeDefaults, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import { getAscentPx, getUnderlinePositionPx, getUnderlineThicknessPx } from '../../../../r3f/controls/native/text/openSansMetrics';
import { getFontAscentPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
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

const AUTOWRAP_OFF = 0;

/** `rich_text_label.h:557`: `TextServer::AutowrapMode autowrap_mode = TextServer::AUTOWRAP_WORD_SMART;` — RichTextLabel's own default, unlike Label's OFF (`label.h`/`Label`'s constructor). */
const RICH_TEXT_LABEL_DEFAULT_AUTOWRAP = 3;

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
  const autowrapMode = props.autowrapMode ?? RICH_TEXT_LABEL_DEFAULT_AUTOWRAP;
  const wraps = autowrapMode !== AUTOWRAP_OFF;

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
  // `line_separation` is 0 for RichTextLabel (`default_theme.cpp:1217`), matching
  // `lineSpacingPx`'s own default of 0 here (Label's own measurer instead passes
  // its own non-zero constant).
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx: 0,
    fontSizePxAt: fontSizePxAtFromRuns(runs),
    fontMetrics,
  });
  const measured = { x: layout.widthPx, y: layout.heightPx };

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
 */
function resolveRunFontSizePx(
  bold: boolean,
  italic: boolean,
  props: RichTextLabelProperties,
  normalFontSizePx: number,
  n: SolveNode,
  builtInDefaultPx: number
): number {
  if (!bold && !italic) return normalFontSizePx;
  const key = bold && italic ? RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.boldItalic : bold ? RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.bold : RICH_TEXT_LABEL_STYLE_FONT_SIZE_KEYS.italic;
  return resolveNodeFontSizePx(n, key, props.themeOverrideFontSizes?.[key], builtInDefaultPx);
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
      : [{ text: raw, bold: false, italic: false, underline: false, color: defaultColor, fontSizePx: normalFontSizePx }];
  }

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
        fontSizePx: resolveRunFontSizePx(bold, italic, props, normalFontSizePx, n, builtInDefaultPx),
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
 * embolden=1.2 renders that stem 3.04px wide (half-max crossings at x≈21.7
 * and x≈24.8, row y=7 of the fixture's capture). The former value here,
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
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: ControlColor;
  /** This run's OWN resolved font size, px (`StyledTextRun.fontSizePx`) — the scale `<TextRun>` and `underlineRectPx` must use for THIS placement, which can differ from the paragraph's `normal_font_size` (`resolveRunFontSizePx`'s own doc). */
  fontSizePx: number;
  /** A single-line `TextLayoutResult` wrapper holding ONLY this run's glyphs from that line — `glyph.x` values are untouched (already this LINE's own pen-relative x), so this needs no rebasing, only the line's own wrapping `<group>` position. */
  layout: TextLayoutResult;
}

/**
 * Echoes the PARENT layout's own `fontMetrics`/`baselineOffsetPx` rather than
 * leaving them unset — see `label/Component.tsx`'s `soloLineLayout`, the
 * SAME hazard: `TextRun` dispatches MSDF-atlas vs. canvas-rasterised painting
 * off `layout.fontMetrics.kind`, so an omitted value here would silently
 * force every run back onto the atlas path regardless of which font `layout`
 * (the ALREADY-SHAPED paragraph this run's glyphs were sliced from) was
 * actually shaped against.
 *
 * `baselineOffsetPx`, unlike `fontMetrics`/`linePitchPx`, is NOT inherited
 * from the parent paragraph layout — it is recomputed at `runFontSizePx`, THIS
 * run's own resolved size (`RichTextRunPlacement.fontSizePx`, which a `[b]`/
 * `[i]` run's `resolveRunFontSizePx` can leave DIFFERENT from the paragraph's
 * `normal_font_size` — that function's own doc). `<TextRun>` is handed this
 * placement's `fontSizePx`, not the paragraph's, for the atlas geometry AND
 * the canvas raster's `baselineY` alike (`buildGlyphQuadArrays`/
 * `paintSceneFontCanvas` both key off `layout.baselineOffsetPx` directly, with
 * no independent per-call fontSizePx re-derivation of their own) — inheriting
 * the paragraph's ascent here would paint every glyph in a differently-sized
 * run at the WRONG baseline y (a whole ascent-delta vertical miss on the
 * canvas path, which has no ascent bake-time correction of any kind to
 * absorb it).
 */
function soloRunLayout(
  text: string,
  glyphs: GlyphPlacement[],
  parentLayout: TextLayoutResult,
  runFontSizePx: number
): TextLayoutResult {
  const widthPx = glyphs.length ? glyphs[glyphs.length - 1]!.x + glyphs[glyphs.length - 1]!.advance - glyphs[0]!.x : 0;
  const fontMetrics = parentLayout.fontMetrics ?? OPEN_SANS_FONT_METRICS;
  return {
    lines: [{ text, glyphs, widthPx }],
    linePitchPx: parentLayout.linePitchPx,
    widthPx,
    heightPx: parentLayout.linePitchPx,
    baselineOffsetPx: getFontAscentPx(fontMetrics, runFontSizePx),
    fontMetrics: parentLayout.fontMetrics,
  };
}

/**
 * Attributes `layout`'s glyphs (already shaped from the CONCATENATION of every
 * `styledRuns[].text`, in order) back to their originating run, splitting each
 * line into one placement per contiguous style-run it contains.
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
export function layoutRichTextRuns(
  styledRuns: readonly StyledTextRun[],
  layout: TextLayoutResult
): RichTextRunPlacement[] {
  const plainText = styledRuns.map((r) => r.text).join('');
  const charRunIndex: number[] = [];
  styledRuns.forEach((run, runIdx) => {
    for (let i = 0; i < run.text.length; i++) charRunIndex.push(runIdx);
  });

  const placements: RichTextRunPlacement[] = [];
  let cursor = 0;

  layout.lines.forEach((line, lineIndex) => {
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
      const run = styledRuns[runIdx];
      // No run, or no glyph consumed (the cursor ran off the end of the plain
      // text while glyphs remain — only reachable if `layout` was shaped from a
      // different string than `styledRuns` concatenates). Both mean this pass
      // cannot advance, and the enclosing `while` has no other exit: without
      // this it spins forever rather than dropping the unattributable tail.
      if (!run || i === start) break;
      placements.push({
        lineIndex,
        bold: run.bold,
        italic: run.italic,
        underline: run.underline,
        color: run.color,
        fontSizePx: run.fontSizePx,
        layout: soloRunLayout(plainText.slice(textStart, cursor), line.glyphs.slice(start, i), layout, run.fontSizePx),
      });
    }
  });

  return placements;
}

/** A `[u]`-styled run's underline stroke rect, target-font-size px, in the SAME pen-space `TextRun`'s glyph geometry uses (Y-down, line-top-relative). */
export interface UnderlineRectPx {
  /** Left edge — the run's first glyph's own pen `x` (no left-side-bearing correction; matches `rich_text_label.cpp:1216-1244`'s `ul_start` sitting at the glyph's pen position, not its ink). */
  x0: number;
  /** Right edge — the run's last glyph's pen `x` + its own advance. */
  x1: number;
  /** Top edge of the stroke rect (centered on the underline y, `heightPx` tall). */
  topPx: number;
  heightPx: number;
}

/**
 * `rich_text_label.cpp:1049` (`off.y += l_ascent`) puts a line's BASELINE at
 * `getAscentPx(fontSizePx)` below its own top — the same reference point
 * `TextRun`'s italic shear now pivots at. `:1242-1244`'s `y_off = upos` (this
 * engine's `getUnderlinePositionPx`) offsets DOWN from that baseline to the
 * stroke's own y, and `:1243`'s `MAX(1.0, uth * base_scale)` floors the
 * stroke to at least 1px (`base_scale` — a UI content-scale factor this
 * renderer does not thread through text metrics — is always its own default
 * of 1 here, so the max only ever fires on the font's own sub-1px thickness).
 * `draw_line`'s own width is CENTERED on the from/to segment, hence the
 * `heightPx / 2` split either side of the stroke's y.
 *
 * Returns `null` for an empty glyph list — nothing to underline, same as
 * `layoutRichTextRuns` never emitting a placement for a run with no glyphs.
 *
 * Deliberately stays on the vendored Open Sans's OWN ascent/underline-position/
 * thickness (`openSansMetrics.ts`) rather than the resolved `FontMetrics` a
 * scene font would carry: `fontMetrics.ts`'s `FontMetrics` contract exposes no
 * underline-position/thickness fields at all (only ascent/descent/advances —
 * a shaper's needs, not a stroke-drawer's), and there is no formula deriving
 * one font's underline geometry from another's. A scene-font RichTextLabel's
 * `[u]` stroke therefore keeps Open Sans's proportions — a documented,
 * pre-existing-class residual (the same one `TextRun.tsx`'s own doc already
 * carries for outline/synthesized-bold on the canvas path: an MSDF-only
 * feature approximated rather than ported, never silently dropped).
 */
export function underlineRectPx(glyphs: readonly GlyphPlacement[], fontSizePx: number): UnderlineRectPx | null {
  if (glyphs.length === 0) return null;

  const first = glyphs[0]!;
  const last = glyphs[glyphs.length - 1]!;
  const centerY = getAscentPx(fontSizePx) + getUnderlinePositionPx(fontSizePx);
  const heightPx = Math.max(1, getUnderlineThicknessPx(fontSizePx));

  return {
    x0: first.x,
    x1: last.x + last.advance,
    topPx: centerY - heightPx / 2,
    heightPx,
  };
}
