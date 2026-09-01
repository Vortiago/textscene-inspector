/**
 * Framework-free line-breaking + glyph placement for the native (WebGL)
 * Control text engine — a port of Godot's Label shaping, against a
 * `FontMetrics` (`./fontMetrics.ts`) rather than any one font directly.
 *
 * Two sources, two responsibilities, deliberately kept separate:
 *  - Shaping metrics — advances, kerning, ascent/descent/line-pitch — come
 *    from `options.fontMetrics`, a `FontMetrics` defaulting to
 *    `OPEN_SANS_FONT_METRICS` (`./openSansFontMetrics.ts`, an adapter over
 *    the generated `openSansMetrics.ts`). `fontMetrics.ts`'s own doc has the
 *    contract: an implementation supplies only raw design-unit data, and the
 *    shared px-quantization math (the ceiling-rounds-then-sums line-pitch
 *    rule in particular — see `getFontLinePitchPx`'s own doc for why a
 *    per-implementation copy of that rule is the bug this is structured to
 *    prevent) lives there, once, for every implementation.
 *  - `openSansAtlas.ts`'s `OPEN_SANS_ATLAS_GLYPHS` — the ONLY per-glyph
 *    atlas-bitmap table, consulted ONLY when `options.fontMetrics.kind` is
 *    `'atlas'` (the default, `OPEN_SANS_FONT_METRICS`). A `'canvas'` metrics
 *    object (`runtimeFontMetrics.ts`'s `CanvasFontMetrics` — a runtime-loaded
 *    scene font with no baked atlas) shapes through the exact same line-
 *    breaking/placement code below but every `GlyphPlacement.glyph` comes
 *    back `null`: there is no MSDF bitmap for it, and painting it is
 *    `TextRun.tsx`'s canvas-rasterisation path instead, which reads
 *    `TextLayoutResult.fontMetrics` (also carried below) to dispatch. Gating
 *    on `kind` here — rather than leaving the atlas lookup unconditional, as
 *    it used to be before a second `FontMetrics` implementation existed — is
 *    what closes the boundary this doc used to call "still open": an atlas
 *    lookup for a font the atlas was never baked from would otherwise return
 *    an Open-Sans bitmap for a DIFFERENT font's advances/kerning, silently.
 *
 * Line-breaking is a direct port of two Godot functions:
 *   scene/gui/label.cpp :: Label::_shape() (~209-225) — maps
 *     `Label.autowrap_mode` to TextServer break flags:
 *       AUTOWRAP_OFF          -> (no wrap flags; only the paragraph's own
 *                                 hard breaks apply)
 *       AUTOWRAP_ARBITRARY    -> BREAK_GRAPHEME_BOUND | BREAK_MANDATORY
 *       AUTOWRAP_WORD         -> BREAK_WORD_BOUND | BREAK_MANDATORY
 *       AUTOWRAP_WORD_SMART   -> BREAK_WORD_BOUND | BREAK_ADAPTIVE | BREAK_MANDATORY
 *     ORed with `autowrap_flags_trim`, whose Label-level DEFAULT (label.h:45)
 *     is BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES — every
 *     Label trims the edge space at a break even when the scene authors no
 *     trim flags, so that default is baked in here rather than an option.
 *   servers/text/text_server.cpp :: TextServer::shaped_text_get_line_breaks()
 *     (~1024-1209) — the scalar-width overload Label::_shape() actually calls
 *     (not the multi-chunk `_adv` sibling): the width/lastSafeBreak/wordCount
 *     bookkeeping, the overflow check, the TRIM_START/END branch walking
 *     start/end back off edge spaces, and the tail rule for the remainder.
 *     `width <= 0` disables the overflow check entirely (`width > 0 &&` in
 *     the source), which is what makes AUTOWRAP_OFF fall out of the SAME
 *     function with no special-casing: pass an unconstrained width and only
 *     the (always-on) hard-break branch below can still start a new line.
 *   modules/text_server_adv/text_server_adv.cpp :: _shaped_text_update_breaks()
 *     (~6258-6420) — ICU's UAX#14 line-break iterator populates
 *     GRAPHEME_IS_BREAK_SOFT; for plain space-separated ASCII that reduces to
 *     one rule reproduced below: the space glyph itself is the soft-break
 *     candidate (BREAK_WORD_BOUND), and BREAK_GRAPHEME_BOUND instead treats
 *     every glyph position as one.
 *   text_server.cpp:1174-1176 — BREAK_ADAPTIVE: a mid-word fallback break,
 *     live only while `wordCount === 0` (no word boundary found yet on the
 *     current line) — required so a single word wider than its box still
 *     wraps under WORD_SMART instead of overflowing (that overflow IS what
 *     plain WORD, lacking this flag, does instead).
 *   core/string/char_utils.h :: is_whitespace() / is_linebreak() — exact
 *     codepoint ranges, transcribed in full for fidelity though only the
 *     ASCII space and LF/CR are reachable by this engine's glyph set.
 *   scene/theme/default_theme.cpp:392 — Label's `line_spacing` theme
 *     constant, `round(3 * scale)`; `lineSpacingPx` defaults to 3 here (UI
 *     scale 1.0), matching `getFontLinePitchPx`'s own default.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { OPEN_SANS_ATLAS_GLYPHS, type OpenSansGlyph } from './openSansAtlas';
import {
  fontUsesSubpixelPositioning,
  getFontAscentPx,
  getFontGlyphAdvancePx,
  getFontKerningAdjustmentPx,
  getFontLinePitchPx,
  type FontMetrics,
} from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';

/** Godot `TextServer::AutowrapMode` (`core/templates/rid.h`-adjacent enum; values match the engine's). */
export enum AutowrapMode {
  OFF = 0,
  ARBITRARY = 1,
  WORD = 2,
  WORD_SMART = 3,
}

/**
 * Narrows a parsed `autowrap_mode` to the enum, falling back when the value is
 * absent or outside it — the same silent-lenient handling `parseOptionalInt`
 * already applies at parse time.
 *
 * The fallback differs per Control and is the caller's to state: `Label`
 * defaults to `OFF`, `RichTextLabel` to `WORD_SMART` (`rich_text_label.h:557`).
 */
export function clampAutowrapMode(mode: number | undefined, fallback: AutowrapMode): AutowrapMode {
  switch (mode) {
    case AutowrapMode.OFF:
    case AutowrapMode.ARBITRARY:
    case AutowrapMode.WORD:
    case AutowrapMode.WORD_SMART:
      return mode;
    default:
      return fallback;
  }
}

export interface ShapeTextOptions {
  /** Target render font size, px. Atlas advances (baked at 42px) scale by `fontSizePx / 42`. Used verbatim for every character absent `fontSizePxAt`. */
  fontSizePx: number;
  /** Wrap width, px. `<= 0` means unconstrained — no soft wrap, only hard breaks. */
  boxWidthPx: number;
  autowrapMode: AutowrapMode;
  /** `Label.uppercase` — shapes `text.toUpperCase()`, not the source casing. */
  uppercase?: boolean;
  /**
   * The theme `line_spacing` this control shapes at, px. Required, with no
   * default: it is a PER-CONTROL theme constant, not a property of shaping.
   * Label's is 3 (`LABEL_LINE_SPACING_PX`); every Button-family widget and
   * LineEdit read no such key at all and pass 0; RichTextLabel's own
   * `line_separation` default is 0 (`default_theme.cpp:1217`); Label3D passes
   * the node's authored `line_spacing`. A shared default here would be one
   * widget's constant silently applied to the rest — worth an explicit value
   * at every call site, because the miss shows only as a 1-3px vertical shift.
   */
  lineSpacingPx: number;
  /**
   * Per-character font size override, keyed by index into the (post-uppercase)
   * text — RichTextLabel's `[b]`/`[i]`/`[b][i]` bbcode spans shape at their OWN
   * theme font-size key (`bold_font_size`/`italics_font_size`/
   * `bold_italics_font_size`), independent of the paragraph's own
   * `normal_font_size` (`rich_text_label.cpp:3244-3290`'s `_find_font`, one
   * `theme_cache.*_font_size` read per `RTL_*_FONT` case — never a fallback to
   * `normal_font_size`). Absent for every other caller (Label, Button,
   * LineEdit — none has per-character styling), in which case every glyph
   * advances at the flat `fontSizePx` exactly as before. Kerning between two
   * adjacent characters is skipped when they resolve to different sizes — a
   * proxy for "different shaped run", matching HarfBuzz shaping each
   * RichTextLabel Item separately (no GPOS pair spans a style boundary).
   */
  fontSizePxAt?: (charIndex: number) => number;
  /**
   * The `FontMetrics` (`./fontMetrics.ts`) to shape advances, kerning, and
   * line pitch against. Defaults to `OPEN_SANS_FONT_METRICS` — the vendored
   * atlas font — when omitted, matching every caller's behaviour before this
   * option existed. Glyph PAINTING metadata (`GlyphPlacement.glyph`) is
   * unaffected by this: it is always looked up in `OPEN_SANS_ATLAS_GLYPHS`,
   * this module's own doc has why.
   */
  fontMetrics?: FontMetrics;
  /**
   * `Label.paragraph_separator`. When set, the text is split on it FIRST and
   * every paragraph is shaped and line-broken on its own, each terminated with
   * a ZERO WIDTH SPACE — `Label::_shape` (`label.cpp:158-166`), where
   * `txt.split(ps)` keeps empty entries and `para.text = str + chr(0x200B)`.
   * The terminator is what gives an empty paragraph a line at all: the break
   * loop drops a range whose start equals its end (`text_server.cpp:948`), so
   * a paragraph holding no glyph would vanish while one holding the ZWSP
   * survives at zero width.
   *
   * Absent for every other caller, and that is the ported rule's own scope,
   * not an omission: Label3D shapes the whole string in one pass
   * (`label_3d.cpp:485,530`) and `TextParagraph` — Button's and LineEdit's
   * path — neither splits nor terminates, so a blank line really does collapse
   * for them. Label's own separator property is not parsed today; `'\n'` is
   * the engine default the callers pass.
   */
  paragraphSeparator?: string;
}

/** One glyph's placement within its line, in target-font-size px. */
export interface GlyphPlacement {
  /** The character rendered (post-uppercase-transform, if requested). */
  char: string;
  /** Pen-origin x within the line — left edge of this glyph's ADVANCE box, not its ink. */
  x: number;
  /**
   * This glyph's own advance to the next glyph's pen x, target px. Includes
   * any kerning adjustment against the FOLLOWING glyph (kerning narrows or
   * widens the gap between a pair, and is folded into the leading glyph's
   * advance so a single running sum serves both the line-break width check
   * and this placement pass with no second calculation to drift from it).
   */
  advance: number;
  /** Atlas bitmap metadata for this glyph, or `null` if the atlas has none (outside the vendored ASCII set) OR the line was shaped against a non-`'atlas'` `FontMetrics` (this module's own doc has why). */
  glyph: OpenSansGlyph | null;
}

export interface TextLineLayout {
  /** The rendered text of this line, edge-space-trimmed per Label's default. */
  text: string;
  glyphs: GlyphPlacement[];
  /**
   * Sum of every glyph's advance on this line, target px — the raw pen
   * extent, Godot's `sd->width` / `TextServer::shaped_text_get_width`. A
   * widget that wants the SIZE the engine reports for this line
   * (`shaped_text_get_size`, a different accessor) must put it through
   * `shapedTextSizeWidthPx`.
   */
  widthPx: number;
}

/**
 * `TextServerAdvanced::_shaped_text_get_size`
 * (`modules/text_server_adv/text_server_adv.cpp:7524-7537`): the size a
 * shaped line reports back is `Size2(sd->width, ascent + descent).ceil()` —
 * a WHOLE number of pixels, even though the pen advance it is derived from
 * is fractional. Godot exposes both quantities and they are NOT
 * interchangeable: `shaped_text_get_width` returns the raw `sd->width` (what
 * `shaped_text_fit_to_width` justifies against), while every widget that
 * floors a minimum size or aligns a line reads the ceiled
 * `shaped_text_get_size`. `TextLineLayout.widthPx` and
 * `TextLayoutResult.widthPx` are the RAW one, so this is the conversion at
 * that seam rather than a rounding baked into shaping.
 *
 * `Math.ceil`, matching `Vector2::ceil()`'s own `Math::ceil` per component:
 * toward POSITIVE infinity, so a degenerate negative extent rounds toward
 * zero rather than away from it.
 *
 * The ceil is not a rounding nicety — it is load-bearing at the container
 * seam. `GridContainer` folds each child's minimum into `Size2i col_minw`
 * (`grid_container.cpp:290`), truncating it; a minimum left a fraction below
 * the whole pixel therefore truncates a whole pixel DOWN, and every column
 * past it opens one pixel early.
 */
export function shapedTextSizeWidthPx(widthPx: number): number {
  return Math.ceil(widthPx);
}

export interface TextLayoutResult {
  lines: TextLineLayout[];
  /** `getFontLinePitchPx(fontMetrics, fontSizePx, lineSpacingPx)` — every line uses the same pitch. */
  linePitchPx: number;
  /** The widest line's `widthPx`. */
  widthPx: number;
  /** `lines.length * linePitchPx`. */
  heightPx: number;
  /**
   * `getFontAscentPx(fontMetrics, fontSizePx)` — where a line's own baseline
   * sits, measured down from that line's top (`fontMetrics.ts`'s own doc:
   * the SAME rounded value every other baseline-relative pixel quantity,
   * e.g. the italic-shear pivot, is measured from). BOTH painters anchor a
   * line here (`TextRun.tsx`'s `buildGlyphQuadArrays`, `canvasTextPainter.ts`'s
   * `paintSceneFontCanvas`), so it is required rather than optional: a caller
   * that hand-builds a `TextLayoutResult` by slicing one line back out of an
   * already-shaped result must state which baseline that line is anchored at,
   * and a default silently substituted for it is a whole-ascent vertical miss
   * on the canvas path and a bake-anchor-sized one on the atlas path.
   */
  baselineOffsetPx: number;
  /**
   * The `FontMetrics` this layout was shaped against — `options.fontMetrics`
   * echoed back, defaulting to `OPEN_SANS_FONT_METRICS` exactly like shaping
   * itself. `TextRun.tsx` reads `.kind` off this to dispatch between the MSDF
   * atlas painter and the canvas-rasterisation painter, so an omitted value
   * would silently force a scene-font layout onto the atlas path (whose
   * bitmaps that font has none of); required for that reason.
   */
  fontMetrics: FontMetrics;
}

/**
 * One line of an already-shaped result, re-wrapped as its own one-line
 * `TextLayoutResult`. `TextRun` computes `lineIndex * linePitchPx` internally,
 * which is 0 for a solo line, so it draws relative to y=0 with no cumulative
 * pitch of its own; the caller supplies the real cumulative Y via the wrapping
 * `<group>`'s position.
 *
 * It lives beside `TextLayoutResult` rather than in any one slice because it is
 * the ONE construction path that bypasses `shapeText`, and so the one place
 * `baselineOffsetPx` and `fontMetrics` can be dropped despite both being
 * required: `TextRun` dispatches MSDF-atlas vs. canvas-rasterised painting off
 * `fontMetrics.kind`, and anchors every glyph at `baselineOffsetPx`. Echoing
 * the parent's values is therefore the default, and a caller overrides
 * `baselineOffsetPx` only when the line genuinely sits at a different baseline
 * from the paragraph — a RichTextLabel run shaped at its own `[b]`/`[i]` theme
 * font size, where inheriting the paragraph's ascent is a whole ascent-delta
 * vertical miss.
 */
export function soloLineLayout(
  line: TextLineLayout,
  parent: TextLayoutResult,
  baselineOffsetPx: number = parent.baselineOffsetPx
): TextLayoutResult {
  return {
    lines: [line],
    linePitchPx: parent.linePitchPx,
    widthPx: line.widthPx,
    heightPx: parent.linePitchPx,
    baselineOffsetPx,
    fontMetrics: parent.fontMetrics,
  };
}

/**
 * A runtime shape check for `NativeControlComponentProps.meta` — a text
 * painter (Button, Label) reading back a `MinimumSizeFn`'s cached
 * `TextLayoutResult` (ITEM C: avoiding a second `shapeText` call for text
 * the solve already shaped) casts `unknown` at that boundary exactly like
 * every other painter already casts `solveNode.node.properties`, but this
 * ONE check is cheap and the failure mode of skipping it — rendering
 * whatever `.lines`/`.widthPx` happen to be on an unrelated object — is a
 * silent wrong picture rather than a thrown error, so it is worth the five
 * property reads. Duck-typed, not `instanceof`: a `TextLayoutResult` is
 * plain data with no prototype of its own.
 *
 * `fontMetrics` is checked by PRESENCE rather than shape — it is the field
 * that decides which painter draws the result, so an object carrying the
 * four numeric/array fields but no metrics is exactly the "plausible but
 * unrelated" case this guard exists to reject.
 */
export function isTextLayoutResult(value: unknown): value is TextLayoutResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<TextLayoutResult>;
  return (
    Array.isArray(v.lines) &&
    typeof v.linePitchPx === 'number' &&
    typeof v.widthPx === 'number' &&
    typeof v.heightPx === 'number' &&
    'fontMetrics' in v
  );
}

interface BreakFlags {
  /** BREAK_WORD_BOUND — a space glyph is a safe break point. */
  wordBound: boolean;
  /** BREAK_GRAPHEME_BOUND — every glyph position is a safe break point. */
  graphemeBound: boolean;
  /** BREAK_ADAPTIVE — mid-word fallback break, live only while `wordCount === 0`. */
  adaptive: boolean;
}

function breakFlagsForAutowrap(mode: AutowrapMode): BreakFlags {
  switch (mode) {
    case AutowrapMode.ARBITRARY:
      return { wordBound: false, graphemeBound: true, adaptive: false };
    case AutowrapMode.WORD:
      return { wordBound: true, graphemeBound: false, adaptive: false };
    case AutowrapMode.WORD_SMART:
      return { wordBound: true, graphemeBound: false, adaptive: true };
    case AutowrapMode.OFF:
    default:
      return { wordBound: false, graphemeBound: false, adaptive: false };
  }
}

// core/string/char_utils.h :: is_whitespace() / is_linebreak().
function isWhitespace(cp: number): boolean {
  return (
    cp === 0x20 ||
    cp === 0x00a0 ||
    cp === 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200b) ||
    cp === 0x202f ||
    cp === 0x205f ||
    cp === 0x3000 ||
    cp === 0x2028 ||
    cp === 0x2029 ||
    (cp >= 0x0009 && cp <= 0x000d) ||
    cp === 0x0085
  );
}
function isLinebreak(cp: number): boolean {
  return (cp >= 0x000a && cp <= 0x000d) || cp === 0x0085 || cp === 0x2028 || cp === 0x2029;
}

interface BreakGlyph {
  start: number;
  end: number;
  advance: number;
  isSpace: boolean;
  isHardBreak: boolean;
}

/**
 * `metrics.getGlyphAdvanceUnits` (the font's own `hmtx`-style advance, design
 * units) put through `fontMetrics.ts`'s shared `getFontGlyphAdvancePx` —
 * FreeType's and HarfBuzz's own fixed-point chain to a whole number of 1/64
 * px, that function's own doc has the citations. Deliberately NOT
 * `openSansAtlas.ts`'s own `xadvance`, which is a different quantization
 * entirely: msdf-bmfont-xml rounds its OWN glyph table to whole pixels at
 * the atlas's bake size (42) before this repo's bake script ever reads it
 * back, so the error it carries is fixed in ATLAS pixels and does not shrink
 * when a caller scales down to a UI size.
 *
 * A character outside `metrics`'s own charset draws no ink (there is no
 * atlas bitmap to place — `OPEN_SANS_ATLAS_GLYPHS`'s own doc lists what IS
 * baked and why) but still occupies roughly its own width via
 * `metrics.averageAdvanceUnits`, rather than 0: a silent zero-width advance
 * is what makes an unshapeable character collapse the whole line around it
 * instead of leaving a gap where its own ink would have been.
 */
function glyphAdvancePx(ch: string, fontSizePx: number, metrics: FontMetrics): number {
  return getFontGlyphAdvancePx(metrics, ch, fontSizePx);
}

/**
 * Unicode general category Zs (SPACE SEPARATOR) — ICU's `u_isblank()` is
 * exactly "Zs, or U+0009 CHARACTER TABULATION", and that is half of
 * `text_server_adv.cpp:7057`'s advance-remainder reset predicate.
 *
 * Deliberately NOT `isWhitespace()` above, which is Godot's own
 * `is_whitespace()` and a WIDER set: it also carries U+200B ZERO WIDTH SPACE
 * (category Cf, a format character with no width to reset around) and the
 * U+2028/U+2029 line/paragraph separators (Zl/Zp, which reach the reset
 * through `is_linebreak()` instead).
 */
function isSpaceSeparator(cp: number): boolean {
  return (
    cp === 0x0020 ||
    cp === 0x00a0 ||
    cp === 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200a) ||
    cp === 0x202f ||
    cp === 0x205f ||
    cp === 0x3000
  );
}

/** `Math::round` (`core/math/math_funcs.h`) — half away from zero, unlike JS's `Math.round`, which breaks ties toward positive infinity. */
function godotRound(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** `metrics.getKerningAdjustmentUnits`, design units, scaled to `fontSizePx` via `fontMetrics.ts`'s shared `getFontKerningAdjustmentPx`. */
function kerningAdjustmentPx(a: string, b: string, fontSizePx: number, metrics: FontMetrics): number {
  return getFontKerningAdjustmentPx(metrics, a, b, fontSizePx);
}

/**
 * One glyph per character plus the paragraph terminator Label always appends
 * (`label.cpp:164`, a zero-advance whitespace glyph — itself a trailing break
 * candidate, though it never changes visible layout since it carries no ink
 * and no advance).
 *
 * `fontSizePxAt`, when given, resolves EACH character's own size (RichTextLabel's
 * per-style-run sizing — see `ShapeTextOptions`'s own doc); absent, every
 * character uses the flat `fontSizePx`, identical to before this option existed.
 */
function toBreakGlyphs(
  text: string,
  fontSizePx: number,
  metrics: FontMetrics,
  fontSizePxAt?: (charIndex: number) => number
): BreakGlyph[] {
  const sizeAt = (i: number): number => fontSizePxAt?.(i) ?? fontSizePx;
  const glyphs: BreakGlyph[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const cp = ch.codePointAt(0)!;
    const hardBreak = isLinebreak(cp);
    glyphs.push({
      start: i,
      end: i + 1,
      // A break grapheme and U+200B carry no advance in Godot; the baked charset
      // has no entry for either, so the metrics fallback would give them an
      // average-width one that the overflow test then spends on a spurious wrap.
      advance: hardBreak || cp === 0x200b ? 0 : glyphAdvancePx(ch, sizeAt(i), metrics),
      isSpace: isWhitespace(cp),
      isHardBreak: hardBreak,
    });
  }
  // Kerning narrows/widens the gap BETWEEN a pair; folding it into the
  // leading glyph's own advance keeps one cumulative sum for both the
  // line-break width check and the placement pass below. Skipped across a
  // size boundary (see this function's own doc) — moot for the vendored
  // Open Sans charset today (no `kern` feature, `openSansMetrics.ts`'s own
  // doc), kept for whichever font/kerning table lands next.
  //
  // Folded in BEFORE the whole-pixel round below, because Godot never sees
  // the two separately: a GPOS pair adjustment is already inside HarfBuzz's
  // `x_advance` by the time `text_server_adv.cpp:7077` reads it. Where inside
  // HarfBuzz's own fixed-point the pair adjustment gets quantized is not
  // pinned here — the vendored font has no `kern` feature and no legacy
  // `kern` table, so there is no pair to measure it against.
  for (let i = 0; i + 1 < text.length; i++) {
    const sizeI = sizeAt(i);
    if (sizeI !== sizeAt(i + 1)) continue;
    glyphs[i]!.advance += kerningAdjustmentPx(text[i]!, text[i + 1]!, sizeI, metrics);
  }
  roundAdvancesToWholePixels(glyphs, text, sizeAt);
  glyphs.push({ start: text.length, end: text.length + 1, advance: 0, isSpace: true, isHardBreak: false });
  return glyphs;
}

/**
 * `text_server_adv.cpp:7079-7084` — above `fontUsesSubpixelPositioning`'s
 * threshold Godot does NOT place glyphs subpixel-precisely: every advance is
 * `Math::round`ed to a whole pixel, and the rounding remainder is carried
 * into the next glyph (`fd->keep_rounding_remainders`, whose default is true
 * — `text_server_adv.h:344,618` — and which no `FontFile` in this repo's
 * scenes turns off). The carry is what keeps a long line from drifting: each
 * glyph's own advance is off by up to half a pixel, but every PREFIX sum is
 * within half a pixel of the unrounded one, so the line's total width is the
 * unrounded total rounded once.
 *
 * The carry is reset, per `:7057`, on a tab, an ICU `u_isblank()` character
 * (`isSpaceSeparator`), or a line break — so a word's rounding error never
 * leaks across the space that follows it. It is also reset at a font-size
 * change, because `adv_rem` is a local of `_shape_run` (`:7011`): a
 * RichTextLabel `[b]`/`[i]` span is its own shaped run, with its own `subpos`
 * decision and its own remainder starting at zero.
 *
 * Mutates `glyphs` in place, after kerning has been folded in — see the
 * caller's own comment for why the two cannot be rounded separately.
 */
function roundAdvancesToWholePixels(
  glyphs: BreakGlyph[],
  text: string,
  sizeAt: (charIndex: number) => number
): void {
  let advanceRemainder = 0;
  for (let i = 0; i < text.length; i++) {
    const sizePx = sizeAt(i);
    if (i > 0 && sizePx !== sizeAt(i - 1)) advanceRemainder = 0;
    if (fontUsesSubpixelPositioning(sizePx)) continue;
    const cp = text[i]!.codePointAt(0)!;
    if (cp === 0x0009 || isSpaceSeparator(cp) || isLinebreak(cp)) advanceRemainder = 0;
    const fullAdvance = advanceRemainder + glyphs[i]!.advance;
    const rounded = godotRound(fullAdvance);
    glyphs[i]!.advance = rounded;
    advanceRemainder = fullAdvance - rounded;
  }
}

/**
 * Port of `TextServer::shaped_text_get_line_breaks` (the scalar-width
 * overload). Returns `[start, end)` character ranges, one pair per line, with
 * Label's default edge-space trim already applied to the emitted range (the
 * width check above still counted the trimmed space's advance — trimming
 * only narrows what gets EMITTED, never what decided the break).
 */
function shapedTextGetLineBreaks(glyphs: BreakGlyph[], width: number, flags: BreakFlags): Array<[number, number]> {
  const lSize = glyphs.length;
  const rangeEnd = lSize > 0 ? glyphs[lSize - 1]!.end : 0;

  const lines: Array<[number, number]> = [];
  let width_ = 0;
  let lineStart = 0;
  let lastEnd = lineStart;
  let prevSafeBreak = 0;
  let lastSafeBreak = -1;
  let wordCount = 0;
  let trimNext = false;

  const isSpaceOrBreak = (idx: number): boolean => glyphs[idx]!.isSpace || glyphs[idx]!.isHardBreak;

  for (let i = 0; i < lSize; i++) {
    const g = glyphs[i]!;
    const adv = g.advance;

    // Overflow check: would adding this glyph exceed the line width, with a
    // recorded safe break to fall back to? `width <= 0` disables this whole
    // branch (AUTOWRAP_OFF's unconstrained width), leaving only hard breaks.
    if (width > 0 && width_ + adv > width && lastSafeBreak >= 0) {
      const curSafeBrk = lastSafeBreak;

      // BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES (Label's
      // always-on default) — walk start/end back off edge spaces.
      let startPos = prevSafeBreak;
      let endPos = lastSafeBreak;
      while (trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        lastEnd = glyphs[endPos]!.end;
      }
      trimNext = true;

      lineStart = glyphs[curSafeBrk]!.end;
      prevSafeBreak = curSafeBrk + 1;
      while (prevSafeBreak < lSize && glyphs[prevSafeBreak]!.end === lineStart) prevSafeBreak++;
      i = curSafeBrk;
      lastSafeBreak = -1;
      width_ = 0;
      wordCount = 0;
      continue;
    }

    // BREAK_MANDATORY — always on, independent of autowrap mode (Label
    // paragraph-splits on a hard break regardless of wrap setting).
    if (g.isHardBreak) {
      const curSafeBrk = i;
      let startPos = prevSafeBreak;
      let endPos = i;
      while (trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        lastEnd = glyphs[i]!.end;
      }
      trimNext = true;
      lineStart = glyphs[curSafeBrk]!.end;
      prevSafeBreak = curSafeBrk + 1;
      while (prevSafeBreak < lSize && glyphs[prevSafeBreak]!.end === lineStart) prevSafeBreak++;
      lastSafeBreak = -1;
      width_ = 0;
      wordCount = 0;
      continue;
    }

    if (flags.wordBound && g.isSpace) {
      lastSafeBreak = i;
      wordCount++;
    }
    if (flags.graphemeBound) {
      lastSafeBreak = i;
    }
    if (flags.adaptive && wordCount === 0) {
      lastSafeBreak = i;
    }

    width_ += adv;
  }

  // Tail: whatever remains after the last break becomes the final line.
  if (lSize > 0) {
    const last = lines.length ? lines[lines.length - 1]! : null;
    if (!last || (last[1] < rangeEnd && prevSafeBreak < lSize)) {
      const startPos0 = prevSafeBreak < lSize ? prevSafeBreak : lSize - 1;
      let finalStart: number;
      if (lastEnd <= glyphs[startPos0]!.start) {
        let startPos = startPos0;
        const endPos = lSize - 1;
        while (trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
        finalStart = glyphs[startPos]!.start;
      } else {
        finalStart = lastEnd;
      }
      lines.push([finalStart, rangeEnd]);
    }
  } else {
    lines.push([0, 0]);
  }

  return lines;
}

/** Shapes `text` into lines and per-glyph placements at `options.fontSizePx`, against `options.fontMetrics` (default `OPEN_SANS_FONT_METRICS`). */
/** `String::chr(0x200B)`, the per-paragraph terminator `Label::_shape` appends (`label.cpp:164`). */
const PARAGRAPH_TERMINATOR = '\u200b';

interface ShapedParagraph {
  text: string;
  /** Index of this paragraph's first character in the whole (post-uppercase) text. */
  offset: number;
  terminated: boolean;
}

/**
 * `txt.split(ps)` (`label.cpp:159`) — empty entries KEPT, which is the whole
 * point: a run of separators is a run of blank lines. With no separator the
 * text is one unterminated paragraph, exactly what the single-pass callers get.
 */
function splitParagraphs(text: string, separator: string | undefined): ShapedParagraph[] {
  if (separator === undefined || separator === '') {
    return [{ text, offset: 0, terminated: false }];
  }
  const out: ShapedParagraph[] = [];
  let offset = 0;
  for (const part of text.split(separator)) {
    out.push({ text: part, offset, terminated: true });
    offset += part.length + separator.length;
  }
  return out;
}

export function shapeText(text: string, options: ShapeTextOptions): TextLayoutResult {
  const {
    fontSizePx,
    boxWidthPx,
    autowrapMode,
    uppercase = false,
    lineSpacingPx,
    fontSizePxAt,
    fontMetrics = OPEN_SANS_FONT_METRICS,
    paragraphSeparator,
  } = options;
  const transformed = uppercase ? text.toUpperCase() : text;
  const flags = breakFlagsForAutowrap(autowrapMode);
  // AUTOWRAP_OFF never soft-wraps: force an unconstrained width regardless of
  // what the caller passed, so only the always-on hard-break branch can
  // start a new line (mirrors Label::_shape() never OR-ing a wrap flag in).
  const effectiveWidth = autowrapMode === AutowrapMode.OFF ? 0 : boxWidthPx;

  // `uppercase` transforms the string BEFORE indices are assigned, so
  // `fontSizePxAt` (keyed by a caller who built it off the SAME transformed
  // text — RichTextLabel has no `uppercase` support today, but this keeps the
  // contract honest for whichever text control adds it next) still lines up.
  const linePitchPx = getFontLinePitchPx(fontMetrics, fontSizePx, lineSpacingPx);

  // Atlas bitmaps only exist for the ONE font `openSansAtlas.ts` bakes —
  // looking them up for a DIFFERENT `FontMetrics` (a scene font) would
  // return Open Sans ink for that font's own advances/kerning. See this
  // module's own doc for the full reasoning.
  const isAtlasFont = fontMetrics.kind === 'atlas';

  const lines: TextLineLayout[] = [];
  for (const para of splitParagraphs(transformed, paragraphSeparator)) {
    // The terminator rides the shaped text but not the source string, so
    // `fontSizePxAt` — keyed by index into the WHOLE text — is offset back to
    // it, and the one index past the paragraph's end resolves to its last size.
    const sizeAt = fontSizePxAt
      ? (i: number): number => fontSizePxAt(para.offset + Math.min(i, para.text.length - 1))
      : undefined;
    const paraText = para.terminated ? para.text + PARAGRAPH_TERMINATOR : para.text;
    const breakGlyphs = toBreakGlyphs(paraText, fontSizePx, fontMetrics, sizeAt);
    for (const [start, end] of shapedTextGetLineBreaks(breakGlyphs, effectiveWidth, flags)) {
      const clampedEnd = Math.min(end, paraText.length);
      let penX = 0;
      const glyphs: GlyphPlacement[] = [];
      for (let idx = start; idx < clampedEnd; idx++) {
        const ch = paraText[idx]!;
        const bg = breakGlyphs[idx]!;
        glyphs.push({
          char: ch,
          x: penX,
          advance: bg.advance,
          glyph: isAtlasFont ? (OPEN_SANS_ATLAS_GLYPHS[ch] ?? null) : null,
        });
        penX += bg.advance;
      }
      lines.push({ text: paraText.slice(start, clampedEnd), glyphs, widthPx: penX });
    }
  }

  const widthPx = lines.reduce((max, l) => Math.max(max, l.widthPx), 0);
  const heightPx = lines.length * linePitchPx;
  const baselineOffsetPx = getFontAscentPx(fontMetrics, fontSizePx);

  return { lines, linePitchPx, widthPx, heightPx, baselineOffsetPx, fontMetrics };
}
