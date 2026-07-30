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
import { getLinePitchPx } from '../../../../r3f/controls/native/text/openSansMetrics';
import type { GlyphPlacement, TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { resolveTextTheme, type ResolvedTextTheme, type TextThemeDefaults, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import type { ControlColor } from '../control/types';
import type { RichTextLabelProperties } from './types';
import { hasOpenTag, lastTagValue, parseBBCodeRuns, resolveBBColor } from './bbcode';

/** RichTextLabel reads `theme_override_font_sizes/normal_font_size` and `theme_override_colors/default_color` — different override key NAMES from Label's `font_size`/`font_color`, same mechanism (`textTheme.ts`). */
export const RICH_TEXT_LABEL_THEME_KEYS: TextThemeKeys = { sizeKey: 'normal_font_size', colorKey: 'default_color' };

/** `default_theme.cpp:1205`: `theme->set_color("default_color", "RichTextLabel", Color(1, 1, 1))` — opaque white, its own literal (coincidentally the same value as Label's, a separate call site). */
export const RICH_TEXT_LABEL_DEFAULT_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

const AUTOWRAP_OFF = 0;

/** `rich_text_label.h:557`: `TextServer::AutowrapMode autowrap_mode = TextServer::AUTOWRAP_WORD_SMART;` — RichTextLabel's own default, unlike Label's OFF (`label.h`/`Label`'s constructor). */
const RICH_TEXT_LABEL_DEFAULT_AUTOWRAP = 3;

/** Resolves this RichTextLabel's own theme font size/colour (overrides, else the theme default / RichTextLabel's own white). */
export function richTextLabelTextTheme(
  props: RichTextLabelProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: RICH_TEXT_LABEL_DEFAULT_FONT_COLOR };
  return resolveTextTheme(props, RICH_TEXT_LABEL_THEME_KEYS, defaults);
}

/** The concatenated, tag-stripped text `shapeText`/`ctx.measureText` should measure — bbcode markup characters (`[b]`, `[/color]`, …) never occupy width or a line of their own once bbcode is enabled. */
function plainTextOf(props: RichTextLabelProperties): string {
  const raw = props.text ?? '';
  if (!props.bbcodeEnabled) return raw;
  return parseBBCodeRuns(raw)
    .map((run) => run.text)
    .join('');
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
 * `ctx.measureText` (`measurer.ts`) always shapes with the SHARED default
 * `lineSpacingPx=3` (Label's own constant) regardless of caller, so its
 * `.y` cannot be read directly as RichTextLabel's content height. The line
 * COUNT it implies is recovered by dividing by that same default pitch, then
 * reapplied at RichTextLabel's own (0-spacing) pitch — the same "recover
 * whatever default the shared engine baked in, then use OUR OWN constant"
 * approach Label's own nativeSolver.ts already documents for its `-lineSpacingPx`
 * subtraction.
 */
export const richTextLabelMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as RichTextLabelProperties;
  const autowrapMode = props.autowrapMode ?? RICH_TEXT_LABEL_DEFAULT_AUTOWRAP;
  const wraps = autowrapMode !== AUTOWRAP_OFF;

  if (!props.fitContent) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  const { fontSizePx } = richTextLabelTextTheme(props, ctx);
  const text = plainTextOf(props);

  if (text.length === 0) {
    return wraps ? { x: 1, y: 0 } : { x: 0, y: 0 };
  }

  if (!ctx.measureText) return { x: 0, y: 0 };

  const measured = ctx.measureText(text, fontSizePx);
  const sharedDefaultPitchPx = getLinePitchPx(fontSizePx); // measurer.ts's own hardcoded lineSpacingPx=3.
  const lineCount = Math.round(measured.y / sharedDefaultPitchPx);
  const ownPitchPx = getLinePitchPx(fontSizePx, 0); // default_theme.cpp:1217's line_separation=0.
  const height = lineCount * ownPitchPx;

  if (wraps) {
    return { x: 1, y: height };
  }
  return { x: measured.x, y: height };
};

// --- Draw-time: the bbcode subset -> styled runs -> per-line/per-run placement ---

/** One styled run of the plain (tag-stripped) text — the drawing-time counterpart of `plainTextOf`, carrying what `[b]`/`[i]`/`[color]` resolve to for this run. */
export interface StyledTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  color: ControlColor;
}

/**
 * Splits `props.text` into styled runs. With `bbcode_enabled` false, Godot
 * shows the text literally — bracket characters included, no styling at all
 * (`Component.tsx`'s own header comment; ADR-0003) — a single run. With it
 * true, every run gets `[b]`/`[i]`'s boolean flags (independent, and they
 * COMBINE when nested — `rich_text_label.cpp:5452-5471`'s
 * `RTL_BOLD_ITALICS_FONT` selection) and the innermost open `[color=...]`'s
 * value resolved via `resolveBBColor`, falling back to `defaultColor`
 * (this node's own resolved theme colour) absent an override — every other
 * recognised-but-out-of-scope tag ([u]/[s]/[code]/[center]) still tokenizes
 * (so nesting stays correct) but contributes no native styling here, same as
 * an unrecognised tag.
 */
export function styledTextRuns(props: RichTextLabelProperties, defaultColor: ControlColor): StyledTextRun[] {
  const raw = props.text ?? '';
  if (!props.bbcodeEnabled) {
    return raw.length === 0 ? [] : [{ text: raw, bold: false, italic: false, color: defaultColor }];
  }

  return parseBBCodeRuns(raw)
    .filter((run) => run.text.length > 0)
    .map((run) => {
      const colorValue = lastTagValue(run.tags, 'color');
      return {
        text: run.text,
        bold: hasOpenTag(run.tags, 'b'),
        italic: hasOpenTag(run.tags, 'i'),
        color: colorValue !== undefined ? resolveBBColor(colorValue, defaultColor) : defaultColor,
      };
    });
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
 * port). `BOLD_DISTANCE_BIAS` transcribes the QUALITATIVE fact (Godot's own
 * embolden is non-zero, so this must be too) at a magnitude in the range this
 * material's own tests already exercise (`msdfMaterial.test.ts`'s `0.08`
 * fixture) — visibly bolder without collapsing to a blob at this atlas's
 * `distanceRange` (4px, `openSansAtlas.ts`).
 */
export const BOLD_DISTANCE_BIAS = 0.08;

/** See `BOLD_DISTANCE_BIAS`'s doc — `default_theme.cpp:1399`/`:1403`'s `Transform2D(1.0, 0.2, ...)` shear coefficient, transcribed exactly. */
export const ITALIC_SKEW = 0.2;

/** One (line, contiguous-style-run) pair, ready for its own `<TextRun>`. */
export interface RichTextRunPlacement {
  lineIndex: number;
  bold: boolean;
  italic: boolean;
  color: ControlColor;
  /** A single-line `TextLayoutResult` wrapper holding ONLY this run's glyphs from that line — `glyph.x` values are untouched (already this LINE's own pen-relative x), so this needs no rebasing, only the line's own wrapping `<group>` position. */
  layout: TextLayoutResult;
}

function soloRunLayout(text: string, glyphs: GlyphPlacement[], linePitchPx: number): TextLayoutResult {
  const widthPx = glyphs.length ? glyphs[glyphs.length - 1]!.x + glyphs[glyphs.length - 1]!.advance - glyphs[0]!.x : 0;
  return { lines: [{ text, glyphs, widthPx }], linePitchPx, widthPx, heightPx: linePitchPx };
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
        color: run.color,
        layout: soloRunLayout(plainText.slice(textStart, cursor), line.glyphs.slice(start, i), layout.linePitchPx),
      });
    }
  });

  return placements;
}
