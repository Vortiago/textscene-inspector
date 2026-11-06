/**
 * Framework-free line breaking and glyph placement for the native (WebGL) Control text engine: a
 * port of Godot's Label shaping against a `FontMetrics`, whose px quantisation is `fontMetrics.ts`.
 * Only an `'atlas'` font gets atlas bitmaps. A `'canvas'` scene font gets `glyph: null` for
 * `TextRunMesh.tsx` to rasterise, since an atlas lookup would give its advances Open Sans ink.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { OPEN_SANS_ATLAS_GLYPHS, type OpenSansGlyph } from './openSansAtlas';
import { round as godotRound } from '../../../../godot/math/math';
import { hexCodeBoxAdvanceSize } from './hexCodeBox';
import { isBitmapFontMetrics } from './bitmapFontMetrics';
import {
  fontUsesSubpixelPositioning,
  getFontAscentPx,
  getFontDescentPx,
  getFontEmboldenGrowthPx,
  getFontExtraAdvancePx,
  getFontKerningAdjustmentPx,
  getFontLinePitchPx,
  getFontRunGlyphAdvancePx,
  fallbackChainOf,
  type FontMetrics,
  type KernGlyph,
} from './fontMetrics';
import type { SizedClusterOffsets } from './fallbackMarkPositioning';
import { getFontRunShaping, type RunCluster } from './glyphRun';
import { atlasGlyphOfIndex } from './openSansAtlasGlyphs';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { tabAlignAdvances } from './textTabStops';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { localeLanguage } from '../../../../godot/text/textServer';
import type { EnumValue } from '../../../../godot/classdb/enumNames.js';
import { resolveParagraphBidi } from './bidi';
import type { StructuredTextRange } from '../../../../godot/text/structuredText';

/**
 * Narrows a parsed `autowrap_mode` to the enum, else returns `fallback`, as leniently as
 * `parseOptionalInt`. The fallback is the caller's: `Label` uses `AUTOWRAP_OFF`, `RichTextLabel` uses
 * `AUTOWRAP_WORD_SMART` (`rich_text_label.h:557`).
 */
export function clampAutowrapMode(
  mode: number | undefined,
  fallback: EnumValue<typeof AutowrapMode>
): EnumValue<typeof AutowrapMode> {
  switch (mode) {
    case AutowrapMode.AUTOWRAP_OFF:
    case AutowrapMode.AUTOWRAP_ARBITRARY:
    case AutowrapMode.AUTOWRAP_WORD:
    case AutowrapMode.AUTOWRAP_WORD_SMART:
      return mode;
    default:
      return fallback;
  }
}

export interface ShapeTextOptions {
  /** Target render font size, px, for every character when `fontSizePxAt` is absent. Atlas bitmaps, baked at 42 px, scale by `fontSizePx / 42`. */
  fontSizePx: number;
  /** Wrap width, px. `<= 0` means unconstrained: no soft wrap, only hard breaks. */
  boxWidthPx: number;
  /**
   * `BREAK_TRIM_INDENT` (`servers/text/text_server.cpp:1048-1062`): measures the leading tabs and
   * spaces once, caps the run at `0.6 * boxWidthPx`, and breaks each later row at
   * `boxWidthPx - indent`. Only `TextEdit.indent_wrapped_lines` sets it (`text_edit.cpp:285-287`).
   */
  trimIndent?: boolean;
  autowrapMode: EnumValue<typeof AutowrapMode>;
  /** `Label.uppercase`: shapes the text upper-cased by the rules of `language` (`label.cpp:153`). */
  uppercase?: boolean;
  /**
   * The paragraph direction, a `TextDirection`. AUTO by default, Godot's default for every Control,
   * Label3D and TextMesh: each paragraph takes its first strong character, else `language`.
   */
  direction?: number;
  /**
   * The override ranges of one paragraph's text, its terminator included, as Label passes
   * `structured_text_parser(...)` per paragraph (`label.cpp:195`). Each range runs the bidi algorithm on its own.
   */
  bidiOverride?: (paragraph: string) => readonly StructuredTextRange[];
  /**
   * The language of the text, else the locale, as Label passes `language` or `_get_locale()`
   * (`label.cpp:139`): it upper-cases and sets the direction of a text with no strong character.
   */
  language?: string;
  /**
   * The direction, language and override of each paragraph, keyed by the source index it starts at:
   * a RichTextLabel line reads them from its first item (`rich_text_label.cpp:3507-3558`). A field it
   * leaves out takes `direction`, `language` or `bidiOverride`.
   */
  paragraphBidiAt?: (
    paragraphStart: number
  ) => Partial<Pick<ShapeTextOptions, 'direction' | 'language' | 'bidiOverride'>>;
  /**
   * The left inset of each paragraph, px, keyed by the source index it starts at: RichTextLabel's
   * margin and list marker (`l.indent`, `rich_text_label.cpp:472`). A paragraph wraps at `boxWidthPx` less its inset
   * (`:474`), and its lines carry it as `indentPx`. Undefined or 0 insets nothing.
   */
  paragraphIndentPx?: (paragraphStart: number) => number;
  /**
   * The theme `line_spacing`, px. Required, because it is a per-control constant: Label 3
   * (`labelEffectiveTextTheme`), Button-family and LineEdit 0, RichTextLabel `line_separation` 0
   * (`default_theme.cpp:1217`), Label3D its authored `line_spacing`. A miss is a 1-3 px shift.
   */
  lineSpacingPx: number;
  /**
   * Per-character font size, keyed by index into the post-uppercase text: RichTextLabel `[b]`/`[i]`
   * spans shape at their own `*_font_size` key, never `normal_font_size` (`rich_text_label.cpp:3244-3290`).
   * Kerning is skipped between characters of different sizes, as HarfBuzz shapes each Item apart.
   */
  fontSizePxAt?: (charIndex: number) => number;
  /**
   * Per-character face, keyed like `fontSizePxAt`: RichTextLabel `[b]`/`[i]` spans shape in their own
   * `bold_font`/`italics_font` (`rich_text_label.cpp:3226-3296`). A character takes its advance, its
   * kerning, its atlas bitmap and its embolden (`FontMetrics.embolden`) from its face. Each face is
   * its own shaped run, so kerning and the rounding remainder stop at a change. Undefined shapes every
   * character in `fontMetrics`, which also sets the line pitch and the baseline.
   */
  fontMetricsAt?: (charIndex: number) => FontMetrics;
  /**
   * Per-character span, keyed like `fontSizePxAt`: Godot shapes each span of a RichTextLabel apart
   * (`text_server_adv.cpp:7401`), so no ligature or kerning pair joins two. Undefined is one span.
   */
  spanAt?: (charIndex: number) => number;
  /** The `FontMetrics` to shape against, by default `OPEN_SANS_FONT_METRICS`. Only an `'atlas'` font gets `GlyphPlacement.glyph`. */
  fontMetrics?: FontMetrics;
  /**
   * `Label.paragraph_separator`, which callers pass as the engine default `'\n'`. The text splits on
   * it first, and each paragraph ends with a ZERO WIDTH SPACE (`label.cpp:158-166`). The break loop
   * drops an empty range (`text_server.cpp:948`), so the terminator gives a blank paragraph its line.
   */
  paragraphSeparator?: string;
  /**
   * Whether the paragraph after the last separator also ends with the ZERO WIDTH SPACE. Default
   * true, as Label does. RichTextLabel adds one only for a `\n` item (`rich_text_label.cpp:626-644`),
   * so its last paragraph has none.
   */
  terminateLastParagraph?: boolean;
  /**
   * `Label.tab_stops` and `TextParagraph.tab_stops`, px, applied twice as `Label::_shape` does
   * (`label.cpp:196-198,228-230`): over the paragraph before line breaking, so the aligned advance
   * decides the wrap, then per line from its own pen origin. Undefined or empty is a no-op.
   */
  tabStopsPx?: number[];
  /**
   * The tab stops of each paragraph, keyed by the source index it starts at: a RichTextLabel line
   * reads them from its first item (`_find_tab_stops`, `rich_text_label.cpp:3477`). Takes the place
   * of `tabStopsPx`, so a paragraph with none has no tab alignment.
   */
  tabStopsPxAt?: (paragraphStart: number) => readonly number[];
  /**
   * `Label.autowrap_trim_flags`. Only `BREAK_TRIM_START_EDGE_SPACES` (64) and
   * `BREAK_TRIM_END_EDGE_SPACES` (128) are read, not `BREAK_TRIM_INDENT` (32). Undefined turns both
   * trims on (`label.h:45`).
   */
  autowrapTrimFlags?: number;
  /**
   * `TextServer::shaped_text_set_preserve_control`: keeps a control character as a hex-code box glyph
   * (`text/hexCodeBox.ts`) instead of dropping it at zero width. Only the `draw_control_chars` property
   * of `LineEdit` and `TextEdit` sets it.
   */
  preserveControl?: boolean;
}

/** `TextServer::LineBreakFlag` subset this module reads (`servers/text/text_server.h:113-120`). */
const BREAK_TRIM_START_EDGE_SPACES = 1 << 6;
const BREAK_TRIM_END_EDGE_SPACES = 1 << 7;

/** One glyph's placement within its line, in target-font-size px. */
export interface GlyphPlacement {
  /**
   * The characters of the glyph's cluster (post-uppercase-transform, if requested): one character,
   * or a base and its marks, or the characters of a ligature. They run from `sourceIndex`.
   */
  char: string;
  /** Pen-origin x within the line: the left edge of the glyph's advance box, not its ink. */
  x: number;
  /**
   * The advance to the next glyph's pen x, target px. It includes the kerning against the following
   * glyph, so one running sum serves the line-break width check and placement.
   */
  advance: number;
  /** Index of the character this glyph shapes in the text `shapeText` took. A paragraph terminator takes its separator's index. Absent on an ellipsis glyph. */
  sourceIndex?: number;
  /** Atlas bitmap metadata, or `null` outside the baked charset or for a non-`'atlas'` `FontMetrics`. */
  glyph: OpenSansGlyph | null;
  /** The control character this glyph draws as a hex-code box (`draw_hex_code_box`), set only when `preserveControl` kept it. */
  controlCodepoint?: number;
  /** The font glyph the run shaping gives this glyph. Absent for a face whose glyphs this previewer cannot read. */
  glyphIndex?: number;
  /**
   * The source text of the cluster this glyph draws a part of, where the cluster draws more than one
   * glyph or another character. Absent where `char` is the source text.
   */
  cluster?: string;
  /**
   * `x_off`: how far the glyph's origin sits right of the pen `x`, px. Absent for 0. A glyph after an
   * exact half-pixel remainder has one. A mark of a cluster has one, as HarfBuzz places it: zero
   * advance, and the `sourceIndex` of its cluster.
   */
  xOffset?: number;
  /** `y_off`: how far the glyph's origin sits below the baseline, px. Absent for 0. */
  yOffset?: number;
  /** How far the embolden grows this glyph's outline at its own size, px. Absent for a glyph with none. */
  emboldenGrowthPx?: number;
  /** This glyph's own size, px, `gl.font_size` in Godot: it scales the space-shrink floor of `fitLineToWidth` (`text_server_adv.cpp:5659`) and the measured ink. */
  fontSizePx: number;
  /** The face of the **Fallback chain** this glyph draws in. */
  fontMetrics: FontMetrics;
}

export interface TextLineLayout {
  /** The source text of this line in logical order, edge-space-trimmed per Label's default, and untrimmed by an overrun as Godot keeps the shaped text. `glyphs` hold the visual order. */
  text: string;
  glyphs: GlyphPlacement[];
  /**
   * The sum of the line's advances, target px: Godot's raw pen extent `sd->width`. The size the
   * engine reports (`shaped_text_get_size`) goes through `shapedTextSizeWidthPx`.
   */
  widthPx: number;
  /**
   * Which paragraph of the source text this line belongs to, counted from 0. A line that autowrap
   * breaks inside a paragraph shares its index, so Label adds `paragraph_spacing` where it changes.
   */
  paragraphIndex: number;
  /**
   * The source index where this line's paragraph starts: Label's `para.start`. `shapeText` sets it.
   * Label hides an ellipsis by it, as the ellipsis glyph has no source character of its own.
   */
  paragraphStart?: number;
  /** The paragraph's left inset, px, from `paragraphIndentPx`. Absent for none. */
  indentPx?: number;
  /**
   * Whether this line's paragraph resolved right-to-left: `shaped_text_get_inferred_direction() ==
   * DIRECTION_RTL`. `shapeText` sets it. A painter's line rebuilt from part of one leaves it out.
   */
  isRtl?: boolean;
  /**
   * The glyphs `shaped_text_draw_outline` draws where they differ from `glyphs`: a trimmed AUTO
   * line whose paragraph resolved right-to-left. The outline reads the inferred direction, the
   * fill the set one (`text_server.cpp:1744,1840`). `trimTextBufferLineToWidth` sets it, and
   * `widthPx` stays the width of the one trimmed buffer both draws place by (`width_trimmed`).
   */
  outlineGlyphs?: GlyphPlacement[];
}

/** Whether `lines[index]` is the first shown line of its paragraph, where `paragraphIndex` changes. */
export function startsParagraph(lines: readonly TextLineLayout[], index: number): boolean {
  return index === 0 || lines[index]!.paragraphIndex !== lines[index - 1]!.paragraphIndex;
}

/**
 * `_shaped_text_get_size` reports `Size2(sd->width, ascent + descent).ceil()`
 * (`modules/text_server_adv/text_server_adv.cpp:7524-7537`), and `shaped_text_get_width` ceils the
 * same width (`:7561-7570`). The ceil runs toward positive infinity, as `Vector2::ceil()` does.
 */
export function shapedTextSizeWidthPx(widthPx: number): number {
  // `GridContainer` truncates each minimum into `Size2i col_minw` (`grid_container.cpp:290`), so a
  // minimum a fraction below the pixel opens every later column one pixel early.
  return Math.ceil(widthPx);
}

export interface TextLayoutResult {
  /** The text the lines were shaped from, after `uppercase`. A glyph's `sourceIndex` is a UTF-16 offset into it. */
  shapedText: string;
  lines: TextLineLayout[];
  /** `getFontLinePitchPx(fontMetrics, fontSizePx, lineSpacingPx)`, one pitch for every line. */
  linePitchPx: number;
  /** The widest line's `widthPx`. */
  widthPx: number;
  /** `lines.length * linePitchPx`, plus the `paragraph_spacing` of each paragraph where Label windows the lines (`windowLabelLines`). */
  heightPx: number;
  /**
   * `getFontAscentPx(fontMetrics, fontSizePx)`: the baseline, measured down from the line top. Both
   * painters anchor a line here, so a hand-built result must state it: a wrong default misses by a
   * whole ascent on the canvas path and by the bake anchor on the atlas path.
   */
  baselineOffsetPx: number;
  /**
   * The `FontMetrics` the layout was shaped against. `TextRunMesh.tsx` dispatches on `.kind` between the
   * MSDF atlas and canvas painters, so an omitted value would put a scene font on the atlas path.
   */
  fontMetrics: FontMetrics;
}

/** Whether the first line of `layout` infers RTL, as a one-paragraph control's text reads it. False for no layout. */
export function infersRtl(layout: TextLayoutResult | null): boolean {
  return layout?.lines[0]?.isRtl === true;
}

/**
 * Re-wraps one shaped line as a one-line result drawn from y = 0; the caller's `<group>` supplies
 * the cumulative Y. It bypasses `shapeText`, so it echoes the parent's `fontMetrics` and baseline.
 * Override `baselineOffsetPx` and `fontMetrics` for a RichTextLabel `[b]`/`[i]` run shaped at its own
 * size, in its own face. Override `heightPx` where the line is taller than the parent's pitch, so a
 * canvas raster holds the line's ascent. `linePitchPx` stays the parent's.
 */
export function soloLineLayout(
  line: TextLineLayout,
  parent: TextLayoutResult,
  baselineOffsetPx: number = parent.baselineOffsetPx,
  fontMetrics: FontMetrics = parent.fontMetrics,
  heightPx: number = parent.linePitchPx
): TextLayoutResult {
  return {
    shapedText: parent.shapedText,
    lines: [line],
    linePitchPx: parent.linePitchPx,
    widthPx: line.widthPx,
    heightPx,
    baselineOffsetPx,
    fontMetrics,
  };
}

/**
 * The soft-break flags `_shaped_text_update_breaks` reads (`text_server_adv.cpp` ~6258-6420). For
 * space-separated text, UAX#14 soft breaks reduce to the space glyph.
 */
interface BreakFlags {
  /** BREAK_WORD_BOUND: a space glyph is a safe break point. */
  wordBound: boolean;
  /** BREAK_GRAPHEME_BOUND: every glyph position is a safe break point. */
  graphemeBound: boolean;
  /**
   * BREAK_ADAPTIVE: a mid-word fallback break, live only while `wordCount === 0`
   * (`text_server.cpp:1174-1176`). Under WORD_SMART a word wider than its box wraps, where plain
   * WORD overflows.
   */
  adaptive: boolean;
}

/**
 * `Label::_shape()`'s mode-to-flags map (`scene/gui/label.cpp` ~209-225), each mode with
 * `BREAK_MANDATORY` too. OFF sets no soft flag, so only hard breaks start a line.
 */
function breakFlagsForAutowrap(mode: EnumValue<typeof AutowrapMode>): BreakFlags {
  switch (mode) {
    case AutowrapMode.AUTOWRAP_ARBITRARY:
      return { wordBound: false, graphemeBound: true, adaptive: false };
    case AutowrapMode.AUTOWRAP_WORD:
      return { wordBound: true, graphemeBound: false, adaptive: false };
    case AutowrapMode.AUTOWRAP_WORD_SMART:
      return { wordBound: true, graphemeBound: false, adaptive: true };
    case AutowrapMode.AUTOWRAP_OFF:
    default:
      return { wordBound: false, graphemeBound: false, adaptive: false };
  }
}

// core/string/char_utils.h :: is_whitespace() / is_linebreak().
/** Shared with `textOverrun.ts` and `textJustify.ts`, which need the line breaker's edge-space predicate. */
export function isWhitespace(cp: number): boolean {
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

/** `GRAPHEME_IS_TAB`: tab (U+0009) or vertical tab (U+000B) (`text_server_adv.cpp:6369-6371`). */
export function isTabChar(ch: string): boolean {
  return ch === '\t' || ch === '';
}

/** `core/string/char_utils.h::is_control`: C0 controls and DEL through the C1 range, tab and linebreaks included. */
export function isControlChar(cp: number): boolean {
  return cp <= 0x001f || (cp >= 0x007f && cp <= 0x009f);
}

interface BreakGlyph {
  start: number;
  end: number;
  advance: number;
  isSpace: boolean;
  isHardBreak: boolean;
  /** `GRAPHEME_IS_TAB`, a flag apart from `GRAPHEME_IS_SPACE`. `BREAK_TRIM_INDENT` reads both (`text_server.cpp:1051`). */
  isTab: boolean;
  /** The codepoint this glyph draws as a hex-code box, set only when `preserveControl` kept a control character. */
  controlCodepoint?: number;
  /** The outline growth of the embolden that widened `advance`, px. 0 for none. */
  emboldenGrowthPx: number;
  /** The glyphs a shaped cluster draws, in order. Absent for a break, a control, a tab and a hex-code box. */
  glyphs?: ClusterGlyph[];
  /** `GlyphPlacement.xOffset` of a glyph with no `glyphs`. */
  xOffset?: number;
  /** Whether the first character of the cluster draws this one: `start` and `end` are the cluster's. */
  isClusterTail?: true;
}

/** A glyph of a shaped cluster, as the run shaping gives it and the layout places it. */
interface ClusterGlyph {
  /** The character it shapes, after normalisation. */
  readonly char: string;
  readonly glyphIndex?: number;
  /** Whether its face places it over the glyph before it, with no advance. */
  readonly isMark: boolean;
  /** Its advance, px, kerning included, rounded with its run where the run rounds. */
  advance: number;
  /** `GlyphPlacement.xOffset`: a mark's from the pen at it, set by `placeMarks`. */
  xOffset: number;
  /** `GlyphPlacement.yOffset`, a whole px. */
  yOffset: number;
}

/**
 * What starts a new shaped run: Godot shapes each font and size as its own run, with its own
 * kerning and rounding remainder (`_shape_run`, `text_server_adv.cpp:7011`).
 */
interface RunStyle {
  sizes: readonly number[];
  /** The face each character draws in: its span's face, or a face of that face's **Fallback chain**. */
  faces: readonly FontMetrics[];
  /** The face each character's span asks for, whose run Godot shapes first (`text_server_adv.cpp:7011`). */
  spanFaces: readonly FontMetrics[];
  /** The bidi embedding level of each character: each level run is its own HarfBuzz run (`text_server_adv.cpp:7293-7330`). */
  levels: Uint8Array;
  /** The bidi override range of each character, -1 for none: each range runs its own bidi pass and runs (`:7266`). */
  rangeIds: Int32Array;
  /** The span of each character (`ShapeTextOptions.spanAt`), or null for one span. */
  spans: Int32Array | null;
  /**
   * Whether a character has no glyph in its face, once the chain is searched. False lets
   * `toBreakGlyphs` skip the per-character glyph test: the paragraph pass already ran it.
   */
  hasUndrawnGlyph: boolean;
}

/** Whether character `i`, past the first, starts a run: its size, face, bidi level or override range differs from the character before it. */
function startsNewRun(style: RunStyle, i: number): boolean {
  return style.faces[i] !== style.faces[i - 1] || startsNewSpanRun(style, i);
}

/** Whether character `i`, past the first, starts a run of its span's face, which a glyph from the **Fallback chain** does not break. */
function startsNewSpanRun(style: RunStyle, i: number): boolean {
  return (
    style.sizes[i] !== style.sizes[i - 1] ||
    style.spanFaces[i] !== style.spanFaces[i - 1] ||
    style.levels[i] !== style.levels[i - 1] ||
    style.rangeIds[i] !== style.rangeIds[i - 1] ||
    (style.spans !== null && style.spans[i] !== style.spans[i - 1])
  );
}

/** Whether character `i` is in a right-to-left run, whose glyphs HarfBuzz returns in reverse logical order. */
function isRtlRun(style: RunStyle, i: number): boolean {
  return style.levels[i]! % 2 === 1;
}

/** The `[start, end)` of each run over `length` characters, in logical order, where `startsRun` tells each run's first character. */
function rangesOf(length: number, startsRun: (i: number) => boolean): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let start = 0;
  for (let i = 1; i <= length; i++) {
    if (i === length || startsRun(i)) {
      ranges.push([start, i]);
      start = i;
    }
  }
  return ranges;
}

/** The `[start, end)` of each run of its span's face over `length` characters, in logical order. */
function spanRunRanges(style: RunStyle, length: number): Array<[number, number]> {
  return rangesOf(length, (i) => startsNewSpanRun(style, i));
}

/** The `[start, end)` of each run Godot shapes apart, over `length` characters, in logical order. */
function runRanges(style: RunStyle, length: number): Array<[number, number]> {
  return rangesOf(length, (i) => startsNewRun(style, i));
}

/**
 * Unicode category Zs, which with U+0009 is ICU's `u_isblank()`, half of the remainder reset at
 * `text_server_adv.cpp:7057`. Not `isWhitespace()`, which adds U+200B (Cf, no width) and U+2028 and
 * U+2029, which reach the reset through `is_linebreak()`.
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

/**
 * A character HarfBuzz never leaves invalid without a glyph: a space, a control, a break, a
 * surrogate, an unassigned code point (`!u_isgraph`) or a default ignorable it hides
 * (`text_server_adv.cpp:7116`).
 */
const KEEPS_ITS_FACE = /^[\p{Cc}\p{Cn}\p{Cs}\p{Zl}\p{Zp}\p{Zs}\p{Default_Ignorable_Code_Point}]/u;

/**
 * Written only by `glyphFaces`, on the first paragraph that needs a **Fallback chain**: most scenes
 * have none. Never cleared.
 */
let graphemes: Intl.Segmenter | undefined;

/**
 * The face each character of a paragraph draws in. Godot marks a grapheme cluster valid only when
 * every glyph of it is, and shapes each run of invalid clusters again in the next font
 * (`text_server_adv.cpp:7119-7170`). So a cluster draws whole in the first face of its span's
 * **Fallback chain** that has all of it, and stays in the span's face where none has.
 */
function glyphFaces(
  text: string,
  spanFaces: readonly FontMetrics[],
  chars: ArrayLike<string>
): readonly FontMetrics[] {
  const faces: FontMetrics[] = [];
  graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const { index, segment } of graphemes.segment(text)) {
    const end = index + segment.length;
    // A span boundary splits a cluster, as Godot shapes each span on its own.
    for (let start = index, stop = index; start < end; start = stop) {
      while (++stop < end && spanFaces[stop] === spanFaces[start]);
      const face = clusterFace(spanFaces[start]!, chars, start, stop);
      for (let i = start; i < stop; i++) faces.push(face);
    }
  }
  return faces;
}

function clusterFace(face: FontMetrics, chars: ArrayLike<string>, start: number, end: number): FontMetrics {
  return fallbackChainOf(face).find((entry) => drawsCluster(entry, chars, start, end)) ?? face;
}

/** Whether `face` has a glyph for every character of `chars[start, end)` that needs one (`KEEPS_ITS_FACE`). */
function drawsCluster(face: FontMetrics, chars: ArrayLike<string>, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    const ch = chars[i]!;
    if (ch !== '' && lacksNeededGlyph(face, ch)) return false;
  }
  return true;
}

/**
 * Whether no font of the chain has a glyph for `ch`: Godot then draws `ch` as a hex-code box
 * (`text_server_adv.cpp:6835-6890`). The previewer has no host fonts, so `allow_system_fallback`
 * finds nothing past the last fallback (`_find_sys_font_for_text`, `:6820-6833`). The caller takes a tab first.
 */
function lacksGlyph(face: FontMetrics, ch: string, hasUndrawnGlyph: boolean): boolean {
  if (isBitmapFontMetrics(face)) return !face.glyphOf(ch);
  return hasUndrawnGlyph && lacksNeededGlyph(face, ch);
}

/**
 * Whether `face` lacks a glyph `ch` needs: a character in `KEEPS_ITS_FACE` needs none.
 * `hasGlyph` first: most characters are in the face, and the property test costs more.
 */
function lacksNeededGlyph(face: FontMetrics, ch: string): boolean {
  return !face.hasGlyph(ch) && !KEEPS_ITS_FACE.test(ch);
}

/**
 * A unit with no glyph of its own: a character outside every bidi override range, which Godot does
 * not shape, or the second unit of a surrogate pair. It has no width and no break.
 */
function unshapedGlyph(index: number): BreakGlyph {
  return {
    start: index,
    end: index + 1,
    advance: 0,
    isSpace: false,
    isHardBreak: false,
    isTab: false,
    emboldenGrowthPx: 0,
  };
}

/** The text of the cluster that runs from `start` to `end`. */
function clusterText(chars: ArrayLike<string>, start: number, end: number): string {
  return end <= start + 1 ? chars[start]! : Array.prototype.slice.call(chars, start, end).join('');
}

/** A character after the first of its cluster, which the first one draws: no width and no break of its own. */
function clusterTail(start: number, end: number): BreakGlyph {
  return { ...unshapedGlyph(start), end, isClusterTail: true };
}

/**
 * The glyph of character `i` where it takes no shaping: a break, a control, a tab or a hex-code box.
 * Undefined for a character its face shapes.
 */
function specialGlyph(
  chars: ArrayLike<string>,
  i: number,
  style: RunStyle,
  preserveControl: boolean
): BreakGlyph | undefined {
  const ch = chars[i]!;
  const cp = ch.codePointAt(0)!;
  const hardBreak = isLinebreak(cp);
  const isTab = isTabChar(ch);
  const glyph: BreakGlyph = {
    start: i,
    end: i + 1,
    advance: 0,
    isSpace: isWhitespace(cp),
    isHardBreak: hardBreak,
    isTab,
    emboldenGrowthPx: 0,
  };
  // A break grapheme, U+200B and a tab take no advance whatever the face holds: the baked charset has
  // no entry for the first two, and a tab no stop aligns is as wide as the font's glyph for it, which
  // is none (measured in Godot 4.6.3: `a<TAB>b` with `tab_size` 0 sets `b` against `a`).
  if (hardBreak || cp === 0x200b || isTab) return glyph;
  // Only the "no font has a glyph" case is left (`text_server_adv.cpp:6842-6907`).
  if (isControlChar(cp)) {
    // Without `preserve_invalid` or `preserve_control`, a control pushes no `Glyph` (`:6844`).
    return preserveControl ? hexCodeBox(glyph, style.sizes[i]!, cp) : glyph;
  }
  if (!lacksGlyph(style.faces[i]!, ch, style.hasUndrawnGlyph)) return undefined;
  return hexCodeBox(glyph, style.sizes[i]!, cp);
}

function hexCodeBox(glyph: BreakGlyph, size: number, cp: number): BreakGlyph {
  glyph.advance = hexCodeBoxAdvanceSize(size, cp).x;
  glyph.controlCodepoint = cp;
  return glyph;
}

/** The glyph of character `i` that breaks a shaped stretch, or undefined where its face shapes it. */
function specialGlyphAt(
  chars: ArrayLike<string>,
  i: number,
  style: RunStyle,
  preserveControl: boolean
): BreakGlyph | undefined {
  if (style.rangeIds[i]! < 0) return unshapedGlyph(i);
  if (chars[i] === '') return undefined;
  return specialGlyph(chars, i, style, preserveControl);
}

/**
 * The glyph a shaped cluster of `chars` breaks as, its first character drawing its glyphs: each with
 * its advance, and a mark with none where its face places it over the base.
 */
function clusterGlyph(
  cluster: RunCluster,
  offset: number,
  chars: ArrayLike<string>,
  style: RunStyle
): BreakGlyph {
  const start = offset + cluster.start;
  const face = style.faces[start]!;
  const size = style.sizes[start]!;
  const embolden = face.embolden ?? 0;
  const extraPx = getFontExtraAdvancePx(embolden, size);
  const placesMarks = !!face.markOffsets;
  const glyphs = cluster.glyphs.map((glyph): ClusterGlyph => {
    const isPlacedMark = glyph.isMark && placesMarks;
    // HarfBuzz zeroes a placed mark's advance, and Godot adds the embolden to every glyph (`:7076-7078`).
    const fontAdvancePx = isPlacedMark ? 0 : getFontRunGlyphAdvancePx(face, glyph, size);
    return {
      char: glyph.char,
      glyphIndex: glyph.glyph,
      isMark: isPlacedMark,
      advance: fontAdvancePx + extraPx,
      xOffset: 0,
      yOffset: 0,
    };
  });
  return {
    start,
    end: offset + cluster.end,
    advance: glyphs.reduce((sum, glyph) => sum + glyph.advance, 0),
    isSpace: isWhitespace(chars[start]!.codePointAt(0)!),
    isHardBreak: false,
    isTab: false,
    emboldenGrowthPx: getFontEmboldenGrowthPx(embolden, size),
    glyphs,
  };
}

/**
 * Pushes onto `glyphs` the glyphs of `chars[start, end)`, which draw in one run: each cluster that
 * its face shapes from `characters`, the characters of the stretch, and a tail for each character
 * after a cluster's first. An empty string stands for a character the stretch does not hold.
 */
function pushShapedStretch(
  glyphs: BreakGlyph[],
  chars: ArrayLike<string>,
  start: number,
  characters: readonly string[],
  style: RunStyle
): void {
  if (characters.length === 0) return;
  for (const cluster of getFontRunShaping(style.faces[start]!, characters)) {
    const glyph = clusterGlyph(cluster, start, chars, style);
    while (glyphs.length < glyph.start) glyphs.push(unshapedGlyph(glyphs.length));
    glyphs.push(glyph);
    for (let tail = glyph.start + 1; tail < glyph.end; tail++)
      glyphs.push(clusterTail(glyph.start, glyph.end));
  }
  while (glyphs.length < start + characters.length) glyphs.push(unshapedGlyph(glyphs.length));
}

/**
 * The glyphs of the run `chars[start, end)`: each stretch of characters its face shapes, as HarfBuzz
 * shapes the run whole (`_shape_run`, `text_server_adv.cpp:7011`), and a glyph of its own for each
 * break, control, tab and hex-code box between them. Pushed onto `glyphs`.
 */
function pushRunGlyphs(
  glyphs: BreakGlyph[],
  chars: ArrayLike<string>,
  [start, end]: [number, number],
  style: RunStyle,
  preserveControl: boolean
): void {
  let stretchStart = start;
  let stretch: string[] = [];
  for (let i = start; i < end; i++) {
    const special = specialGlyphAt(chars, i, style, preserveControl);
    if (!special) {
      stretch.push(chars[i]!);
      continue;
    }
    pushShapedStretch(glyphs, chars, stretchStart, stretch, style);
    glyphs.push(special);
    stretchStart = i + 1;
    stretch = [];
  }
  pushShapedStretch(glyphs, chars, stretchStart, stretch, style);
}

/**
 * One glyph per character, a cluster's first character drawing the whole cluster, plus the
 * zero-advance whitespace terminator Label appends (`label.cpp:164`). `chars` are the characters
 * the glyphs draw, mirrored where the level is odd, and `style` sets the size, face and level of each.
 */
function toBreakGlyphs(chars: ArrayLike<string>, style: RunStyle, preserveControl = false): BreakGlyph[] {
  const glyphs: BreakGlyph[] = [];
  for (const range of runRanges(style, chars.length))
    pushRunGlyphs(glyphs, chars, range, style, preserveControl);
  kernGlyphs(glyphs, chars, style);
  placeMarks(glyphs, style);
  roundAdvancesToWholePixels(glyphs, chars, style);
  glyphs.push({
    start: chars.length,
    end: chars.length + 1,
    advance: 0,
    isSpace: true,
    isHardBreak: false,
    isTab: false,
    emboldenGrowthPx: 0,
  });
  return glyphs;
}

/** The last glyph of a cluster that is no mark: a kerning lookup skips marks, so it pairs with the next cluster. */
function lastBaseGlyph(glyphs: readonly ClusterGlyph[] | undefined): ClusterGlyph | undefined {
  if (!glyphs) return undefined;
  for (let k = glyphs.length - 1; k >= 0; k--) if (!glyphs[k]!.isMark) return glyphs[k];
  return undefined;
}

/** The glyph a kerning pair reads for `glyph`, or for `char` where it draws no cluster. */
function kernGlyphOf(glyph: ClusterGlyph | undefined, char: string): KernGlyph {
  return glyph ? { char: glyph.char, glyph: glyph.glyphIndex } : { char };
}

/** Adds `px` to the advance of `glyph`, on its last glyph that is no mark, which the pair kerns. */
function addKerning(glyph: BreakGlyph, px: number): void {
  glyph.advance += px;
  const kerned = lastBaseGlyph(glyph.glyphs);
  if (kerned) kerned.advance += px;
}

/**
 * Folds kerning into the visually left advance, skipped across a run boundary, before the
 * whole-pixel round: a GPOS pair is already inside HarfBuzz's `x_advance` when
 * `text_server_adv.cpp:7077` reads it. The pair stays logical, as the font defines it, and pairs
 * the glyphs on each side of two clusters. Mutates `glyphs`.
 */
function kernGlyphs(glyphs: BreakGlyph[], chars: ArrayLike<string>, style: RunStyle): void {
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '' || style.rangeIds[i]! < 0 || glyphs[i]!.isClusterTail) continue;
    kernClusterGlyphs(glyphs[i]!, style);
    // A surrogate pair's glyph char holds both units, so its length steps over the second.
    const next = Math.max(i + chars[i]!.length, glyphs[i]!.end);
    if (next >= chars.length || startsNewRun(style, next)) continue;
    const kerningPx = getFontKerningAdjustmentPx(
      style.faces[i]!,
      kernGlyphOf(lastBaseGlyph(glyphs[i]!.glyphs), chars[i]!),
      kernGlyphOf(glyphs[next]!.glyphs?.[0], chars[next]!),
      style.sizes[i]!
    );
    if (kerningPx !== 0) addKerning(glyphs[isRtlRun(style, i) ? next : i]!, kerningPx);
  }
}

/**
 * Kerns each pair of glyphs of one cluster that are no marks, such as the glyphs of a multiple
 * substitution: a kerning lookup reads glyphs, whatever their clusters. Mutates `glyph`.
 */
function kernClusterGlyphs(glyph: BreakGlyph, style: RunStyle): void {
  const clusterGlyphs = glyph.glyphs;
  if (!clusterGlyphs || clusterGlyphs.length < 2) return;
  const face = style.faces[glyph.start]!;
  const size = style.sizes[glyph.start]!;
  let left: ClusterGlyph | undefined;
  for (const right of clusterGlyphs) {
    if (right.isMark) continue;
    if (left) {
      const kerningPx = getFontKerningAdjustmentPx(
        face,
        kernGlyphOf(left, left.char),
        kernGlyphOf(right, right.char),
        size
      );
      left.advance += kerningPx;
      glyph.advance += kerningPx;
    }
    left = right;
  }
}

/**
 * Sets the offsets of the marks of each cluster its face places. HarfBuzz attaches a mark to the
 * first glyph of a multiple substitution (`MarkBasePos`), so each mark sits against the cluster's
 * first glyph that is no mark, offset from the pen at the mark: the advances since that glyph, their
 * kerning included. Godot rounds the y offset to a whole pixel at any size
 * (`text_server_adv.cpp:7062-7068`), and `roundGlyphAdvance` rounds the x with the run.
 */
function placeMarks(glyphs: BreakGlyph[], style: RunStyle): void {
  for (const glyph of glyphs) {
    const clusterGlyphs = glyph.glyphs;
    if (!clusterGlyphs?.some((g) => g.isMark)) continue;
    const face = style.faces[glyph.start]!;
    const size = style.sizes[glyph.start]!;
    placeClusterMarks(
      clusterGlyphs,
      face.markOffsets!,
      size,
      getFontExtraAdvancePx(face.embolden ?? 0, size)
    );
  }
}

/**
 * Sets the offsets of the marks of `clusterGlyphs` at `fontSizePx`. HarfBuzz offsets a mark from
 * advances without the embolden `extraPx`, which Godot adds after.
 */
function placeClusterMarks(
  clusterGlyphs: readonly ClusterGlyph[],
  offsetsOf: SizedClusterOffsets,
  fontSizePx: number,
  extraPx: number
): void {
  const baseIndex = clusterGlyphs.findIndex((g) => !g.isMark);
  if (baseIndex < 0 || clusterGlyphs.some((g) => g.glyphIndex === undefined)) return;
  const attached = [clusterGlyphs[baseIndex]!, ...clusterGlyphs.slice(baseIndex + 1).filter((g) => g.isMark)];
  const offsets = offsetsOf(
    attached.map((g) => ({ glyph: g.glyphIndex!, codePoint: g.char.codePointAt(0)! })),
    fontSizePx
  );
  let penFromBase = 0;
  let mark = 1;
  for (const g of clusterGlyphs.slice(baseIndex)) {
    if (g.isMark) {
      const offset = offsets[mark++]!;
      g.xOffset = offset.x - penFromBase;
      g.yOffset = -godotRound(offset.y);
    }
    penFromBase += g.advance - extraPx;
  }
}

/**
 * Above the subpixel threshold Godot rounds each advance to a whole pixel and carries the remainder
 * (`text_server_adv.cpp:7079-7084`; `keep_rounding_remainders` defaults to true,
 * `text_server_adv.h:344,618`), so each prefix sum stays within half a pixel. It walks a run in
 * HarfBuzz's glyph order, which is reverse logical order for a right-to-left run. Mutates `glyphs`.
 */
function roundAdvancesToWholePixels(glyphs: BreakGlyph[], chars: ArrayLike<string>, style: RunStyle): void {
  for (const [start, end] of spanRunRanges(style, chars.length)) {
    const chain = fallbackChainOf(style.spanFaces[start]!);
    // A one-face run under subpixel positioning rounds nothing, so it builds no index list.
    if (chain.length === 1 && fontUsesSubpixelPositioning(style.sizes[start]!, chain[0]!)) continue;
    const isRtl = isRtlRun(style, start);
    if (chain.length === 1) {
      roundOneFaceRun(glyphs, chars, start, end, isRtl);
      continue;
    }
    const indices = Array.from({ length: end - start }, (_v, k) => start + k);
    if (isRtl) indices.reverse();
    roundFaceRun(glyphs, chars, style, indices, chain, 0);
  }
}

/** `roundFaceRun` for a run whose face has no fallback: every glyph of `[start, end)` draws in it. */
function roundOneFaceRun(
  glyphs: BreakGlyph[],
  chars: ArrayLike<string>,
  start: number,
  end: number,
  isRtl: boolean
): void {
  let advanceRemainder = 0;
  if (isRtl)
    for (let i = end - 1; i >= start; i--)
      advanceRemainder = roundGlyphAdvance(glyphs, chars, i, advanceRemainder);
  else
    for (let i = start; i < end; i++)
      advanceRemainder = roundGlyphAdvance(glyphs, chars, i, advanceRemainder);
}

/**
 * Rounds the advance of glyph `i` with the remainder its run carries, and answers the new remainder.
 * `adv_rem` is local to `_shape_run` (`:7011`), so each run starts it at zero.
 */
function roundGlyphAdvance(
  glyphs: BreakGlyph[],
  chars: ArrayLike<string>,
  i: number,
  remainder: number
): number {
  const glyph = glyphs[i]!;
  // The second unit of a surrogate pair and the tail of a cluster have no glyph to round: rounding
  // their 0 advance would move the remainder of a whole half pixel into them.
  if (chars[i] === '' || glyph.isClusterTail) return remainder;
  const cp = chars[i]!.codePointAt(0)!;
  // Resets on a tab, a `u_isblank()` character or a break (`:7057`), so a word's error stays in it.
  const resets = cp === 0x0009 || isSpaceSeparator(cp) || isLinebreak(cp);
  if (!glyph.glyphs) {
    const rounded = roundedGlyph(glyph.advance, 0, resets ? 0 : remainder);
    glyph.advance = rounded.advance;
    if (rounded.xOffset !== 0) glyph.xOffset = rounded.xOffset;
    return rounded.remainder;
  }
  let advance = 0;
  for (const clusterGlyph of glyph.glyphs) {
    const rounded = roundedGlyph(clusterGlyph.advance, clusterGlyph.xOffset, resets ? 0 : remainder);
    clusterGlyph.advance = rounded.advance;
    clusterGlyph.xOffset = rounded.xOffset;
    advance += rounded.advance;
    remainder = rounded.remainder;
  }
  glyph.advance = advance;
  return remainder;
}

/**
 * A glyph's advance and `x_offset` rounded with the remainder `carried` before it, and the remainder
 * after it. `x_off` rounds with the remainder too (`:7062-7064`): a glyph after an exact half pixel
 * draws a pixel off its pen.
 */
function roundedGlyph(
  advancePx: number,
  xOffsetPx: number,
  carried: number
): { advance: number; xOffset: number; remainder: number } {
  const fullAdvance = carried + advancePx;
  const advance = godotRound(fullAdvance);
  return { advance, xOffset: godotRound(carried + xOffsetPx), remainder: fullAdvance - advance };
}

/**
 * Rounds the glyphs of `indices` that draw in `chain[depth]`, with one remainder. Each stretch of
 * glyphs that draw in a later face is a run of its own one level down, as Godot shapes a failed
 * stretch again in the next font, and leaves this remainder as it was (`text_server_adv.cpp:7058,7132`).
 */
function roundFaceRun(
  glyphs: BreakGlyph[],
  chars: ArrayLike<string>,
  style: RunStyle,
  indices: readonly number[],
  chain: readonly FontMetrics[],
  depth: number
): void {
  const face = chain[depth]!;
  const isLastFace = depth === chain.length - 1;
  const usesSubpixel = fontUsesSubpixelPositioning(style.sizes[indices[0]!]!, face);
  // The last face has no later stretch to hand on, so subpixel positioning leaves nothing to do.
  if (isLastFace && usesSubpixel) return;
  let advanceRemainder = 0;
  let stretch: number[] = [];
  const flushStretch = () => {
    if (stretch.length === 0) return;
    roundFaceRun(glyphs, chars, style, stretch, chain, depth + 1);
    stretch = [];
  };
  for (const i of indices) {
    if (!isLastFace && style.faces[i] !== face) {
      stretch.push(i);
      continue;
    }
    flushStretch();
    if (!usesSubpixel) advanceRemainder = roundGlyphAdvance(glyphs, chars, i, advanceRemainder);
  }
  flushStretch();
}

/**
 * Port of `TextServer::shaped_text_get_line_breaks` (`servers/text/text_server.cpp` ~1024-1209),
 * the scalar-width overload Label calls. Returns `[start, end)` ranges, one per line, trimmed of
 * edge spaces. The trim narrows only the emitted range: the width check still counts the trimmed
 * space. A `width <= 0` disables the overflow check.
 */
function shapedTextGetLineBreaks(
  glyphs: BreakGlyph[],
  width: number,
  flags: BreakFlags,
  trim: { start: boolean; end: boolean },
  trimIndent = false
): Array<[number, number]> {
  const lSize = glyphs.length;
  const rangeEnd = lSize > 0 ? glyphs[lSize - 1]!.end : 0;

  // BREAK_TRIM_INDENT (`text_server.cpp:1048-1062`): the leading tab/space run,
  // restarted whenever it alone would overrun the box, then capped at 0.6 of it.
  let indent = 0;
  let indentEnd = 0;
  if (trimIndent) {
    for (let i = 0; i < lSize; i++) {
      const g = glyphs[i]!;
      if (!g.isTab && !g.isSpace) break;
      if (indent + g.advance > width) indent = 0;
      indent += g.advance;
      indentEnd = g.end;
    }
    indent = Math.min(indent, 0.6 * width);
  }
  // `l_width` (`:1064`): `width` until a row past the indent starts, then the narrowed width. Each
  // emitted line re-evaluates it.
  let lWidth = width;
  const narrowAfterBreak = (i: number): void => {
    if (width > indent && i > indentEnd) lWidth = width - indent;
  };

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
    if (lWidth > 0 && width_ + adv > lWidth && lastSafeBreak >= 0) {
      const curSafeBrk = lastSafeBreak;

      // BREAK_TRIM_START_EDGE_SPACES and BREAK_TRIM_END_EDGE_SPACES walk start and end off edge spaces.
      let startPos = prevSafeBreak;
      let endPos = lastSafeBreak;
      while (trim.start && trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (trim.end && startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        narrowAfterBreak(i);
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

    // BREAK_MANDATORY is always on, whatever the autowrap mode.
    if (g.isHardBreak) {
      const curSafeBrk = i;
      let startPos = prevSafeBreak;
      let endPos = i;
      while (trim.start && trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
      while (trim.end && startPos <= endPos && endPos > 0 && isSpaceOrBreak(endPos)) endPos -= 1;
      if (lastEnd <= glyphs[startPos]!.start && glyphs[startPos]!.start !== glyphs[endPos]!.end) {
        lines.push([glyphs[startPos]!.start, glyphs[endPos]!.end]);
        narrowAfterBreak(i);
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

    // `i >= indent_end` (`text_server.cpp:1169`): a soft break inside the
    // leading indent is not a candidate, so the indent never becomes a row.
    if (flags.wordBound && g.isSpace && i >= indentEnd) {
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
        while (trim.start && trimNext && startPos < endPos && isSpaceOrBreak(startPos)) startPos += 1;
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

/** `String::chr(0x200B)`, the per-paragraph terminator `Label::_shape` appends (`label.cpp:164`). */
const PARAGRAPH_TERMINATOR = '\u200b';

interface ShapedParagraph {
  text: string;
  /** Index of this paragraph's first character in the whole (post-uppercase) text. */
  offset: number;
  terminated: boolean;
}

/**
 * `txt.split(ps)` (`label.cpp:159`) keeps empty entries, so a run of separators is a run of blank
 * lines. With no separator the text is one unterminated paragraph, as Label3D
 * (`label_3d.cpp:485,530`) and `TextParagraph` shape it, where a blank line collapses.
 */
function splitParagraphs(
  text: string,
  separator: string | undefined,
  terminateLastParagraph: boolean
): ShapedParagraph[] {
  if (separator === undefined || separator === '') {
    return [{ text, offset: 0, terminated: false }];
  }
  const out: ShapedParagraph[] = [];
  let offset = 0;
  const parts = text.split(separator);
  parts.forEach((part, i) => {
    out.push({ text: part, offset, terminated: terminateLastParagraph || i < parts.length - 1 });
    offset += part.length + separator.length;
  });
  return out;
}

/**
 * `TS->string_to_upper(text, lang)` (`label.cpp:153`): ICU's casing for the language subtag of a
 * Godot locale (`tr_TR` casts as `tr`). An empty or unknown language takes the root rules.
 */
function upperCaseFor(text: string, language: string): string {
  const subtag = localeLanguage(language);
  if (subtag === '') return text.toUpperCase();
  try {
    return text.toLocaleUpperCase(subtag);
  } catch {
    // A subtag that is no BCP 47 language: ICU falls back to the root locale for it.
    return text.toUpperCase();
  }
}

/** Shapes `text` into lines and per-glyph placements at `options.fontSizePx`, against `options.fontMetrics` (default `OPEN_SANS_FONT_METRICS`). */
export function shapeText(text: string, options: ShapeTextOptions): TextLayoutResult {
  const {
    fontSizePx,
    boxWidthPx,
    autowrapMode,
    uppercase = false,
    direction,
    bidiOverride,
    language = '',
    paragraphBidiAt,
    paragraphIndentPx,
    lineSpacingPx,
    fontSizePxAt,
    fontMetricsAt,
    spanAt,
    fontMetrics = OPEN_SANS_FONT_METRICS,
    paragraphSeparator,
    terminateLastParagraph = true,
    tabStopsPx,
    tabStopsPxAt,
    autowrapTrimFlags,
    trimIndent = false,
    preserveControl = false,
  } = options;
  // Uppercase before indices are assigned, so a `fontSizePxAt` keyed on the transformed text lines up.
  const transformed = uppercase ? upperCaseFor(text, language) : text;
  const flags = breakFlagsForAutowrap(autowrapMode);
  const trim = {
    start: autowrapTrimFlags === undefined ? true : (autowrapTrimFlags & BREAK_TRIM_START_EDGE_SPACES) !== 0,
    end: autowrapTrimFlags === undefined ? true : (autowrapTrimFlags & BREAK_TRIM_END_EDGE_SPACES) !== 0,
  };
  // AUTOWRAP_OFF never soft-wraps: force an unconstrained width regardless of
  // what the caller passed, so only the always-on hard-break branch can
  // start a new line (mirrors Label::_shape() never OR-ing a wrap flag in).
  const effectiveWidth = autowrapMode === AutowrapMode.AUTOWRAP_OFF ? 0 : boxWidthPx;

  const lines: TextLineLayout[] = [];
  for (const [paragraphIndex, para] of splitParagraphs(
    transformed,
    paragraphSeparator,
    terminateLastParagraph
  ).entries()) {
    // The terminator is in the shaped text but not the source, so the per-character closures, keyed
    // into the whole text, are offset back, and the index past the paragraph's end takes the last value.
    const sourceIndex = (i: number): number => para.offset + Math.max(0, Math.min(i, para.text.length - 1));
    const paraText = para.terminated ? para.text + PARAGRAPH_TERMINATOR : para.text;
    const paragraphBidi = { direction, language, bidiOverride, ...paragraphBidiAt?.(para.offset) };
    const indentPx = paragraphIndentPx?.(para.offset) ?? 0;
    // A paragraph inset past the box wraps nowhere, as a box of no width does.
    const paragraphWidth = effectiveWidth > 0 ? Math.max(0, effectiveWidth - indentPx) : effectiveWidth;
    const paragraphTabStopsPx = tabStopsPxAt ? tabStopsPxAt(para.offset) : tabStopsPx;
    const hasTabStops = !!paragraphTabStopsPx && paragraphTabStopsPx.length > 0;
    const bidi = resolveParagraphBidi(paraText, {
      direction: paragraphBidi.direction,
      overrides: paragraphBidi.bidiOverride?.(paraText),
      language: paragraphBidi.language,
    });
    const chars = bidi.glyphChars;
    const spanFaces = Array.from({ length: paraText.length }, (_v, i) =>
      fontMetricsAt ? fontMetricsAt(sourceIndex(i)) : fontMetrics
    );
    // Most paragraphs draw each character in its span face: no segmenting, which costs 21 µs per 225 characters.
    const spansDraw = spanFaces.every((face, i) => drawsCluster(face, chars, i, i + 1));
    const runStyle: RunStyle = {
      sizes: Array.from({ length: paraText.length }, (_v, i) =>
        fontSizePxAt ? fontSizePxAt(sourceIndex(i)) : fontSizePx
      ),
      faces:
        !spansDraw && spanFaces.some((face) => face.fallbacks)
          ? glyphFaces(paraText, spanFaces, chars)
          : spanFaces,
      spanFaces,
      levels: bidi.levels,
      rangeIds: bidi.rangeIds,
      spans: spanAt ? Int32Array.from({ length: paraText.length }, (_v, i) => spanAt(sourceIndex(i))) : null,
      hasUndrawnGlyph: !spansDraw,
    };
    const breakGlyphs = toBreakGlyphs(chars, runStyle, preserveControl);
    // First tab pass: the aligned advance must be in place before line breaking measures it.
    if (hasTabStops) {
      // One entry per UTF-16 unit, as `breakGlyphs` holds them: a code-point walk shifts every
      // advance after an astral character.
      const paragraphEntries = Array.from({ length: paraText.length }, (_v, i) => ({
        char: paraText[i]!,
        advance: breakGlyphs[i]!.advance,
      }));
      const aligned = tabAlignAdvances(paragraphEntries, paragraphTabStopsPx!);
      for (let i = 0; i < aligned.length; i++) breakGlyphs[i]!.advance = aligned[i]!;
    }
    for (const [start, end] of shapedTextGetLineBreaks(
      breakGlyphs,
      paragraphWidth,
      flags,
      trim,
      trimIndent
    )) {
      const clampedEnd = Math.min(end, paraText.length);
      // Second tab pass: restarts the tab-stop cycle at this line's pen origin.
      const lineAdvances = hasTabStops
        ? tabAlignAdvances(
            Array.from({ length: clampedEnd - start }, (_v, i) => ({
              char: paraText[start + i]!,
              advance: breakGlyphs[start + i]!.advance,
            })),
            paragraphTabStopsPx!
          )
        : null;
      let penX = 0;
      const glyphs = bidi
        .visualOrder(start, clampedEnd)
        .filter((idx) => chars[idx] !== '' && !breakGlyphs[idx]!.isClusterTail)
        .flatMap((idx): GlyphPlacement[] => {
          const glyph = breakGlyphs[idx]!;
          const advance = lineAdvances ? lineAdvances[idx - start]! : glyph.advance;
          const x = penX;
          penX += advance;
          const placed: GlyphPlacement = {
            char: clusterText(chars, idx, glyph.end),
            x,
            advance,
            glyph: null,
            controlCodepoint: glyph.controlCodepoint,
            emboldenGrowthPx: glyph.emboldenGrowthPx || undefined,
            xOffset: glyph.xOffset,
            sourceIndex: para.offset + idx,
            fontSizePx: runStyle.sizes[idx]!,
            fontMetrics: runStyle.faces[idx]!,
          };
          return glyph.glyphs ? clusterPlacements(placed, glyph.glyphs) : [placed];
        });
      lines.push({
        text: paraText.slice(start, clampedEnd),
        glyphs,
        widthPx: penX,
        paragraphIndex,
        paragraphStart: para.offset,
        ...(indentPx > 0 && { indentPx }),
        isRtl: bidi.isRtl,
      });
    }
  }

  const widthPx = widestLineWidthPx(lines);
  const { baselineOffsetPx, linePitchPx } = lineMetrics(lines, fontMetrics, fontSizePx, lineSpacingPx);
  const heightPx = lines.length * linePitchPx;

  return { shapedText: transformed, lines, linePitchPx, widthPx, heightPx, baselineOffsetPx, fontMetrics };
}

/** The placement of each glyph of the cluster `placed` draws, at its own pen and advance. */
function clusterPlacements(placed: GlyphPlacement, glyphs: readonly ClusterGlyph[]): GlyphPlacement[] {
  const sourceText = placed.char;
  const isAtlas = placed.fontMetrics?.kind === 'atlas';
  let pen = placed.x;
  return glyphs.map((glyph) => {
    const { char } = glyph;
    const placement: GlyphPlacement = {
      ...placed,
      char,
      x: pen,
      advance: glyph.advance,
      // Atlas bitmaps exist only for the font `openSansAtlas.ts` bakes.
      glyph: isAtlas ? atlasGlyphOf(glyph) : null,
      glyphIndex: glyph.glyphIndex,
      ...((glyphs.length > 1 || char !== sourceText) && { cluster: sourceText }),
      xOffset: glyph.xOffset !== 0 ? glyph.xOffset : undefined,
      ...(glyph.yOffset !== 0 && { yOffset: glyph.yOffset }),
    };
    pen += glyph.advance;
    return placement;
  });
}

/** The atlas bitmap of `glyph`: by its glyph where the run shaping read one, else by its character. */
function atlasGlyphOf(glyph: ClusterGlyph): OpenSansGlyph | null {
  if (glyph.glyphIndex !== undefined) return atlasGlyphOfIndex(glyph.glyphIndex);
  return OPEN_SANS_ATLAS_GLYPHS[glyph.char] ?? null;
}

/** How far the glyph offsets of `glyphs` reach above and below the baseline, px: `-y_off` and `y_off`. */
export function glyphOffsetReachPx(glyphs: Iterable<GlyphPlacement>): { abovePx: number; belowPx: number } {
  let abovePx = 0;
  let belowPx = 0;
  for (const { yOffset = 0 } of glyphs) {
    abovePx = Math.max(abovePx, -yOffset);
    belowPx = Math.max(belowPx, yOffset);
  }
  return { abovePx, belowPx };
}

/**
 * The font's ascent and pitch, each grown by a glyph offset past the font's line: Godot's line
 * ascent is `MAX(ascent, -y_off)` and its descent `MAX(descent, y_off)` (`text_server_adv.cpp:5161-5162`).
 * One pitch serves every line, so the furthest offset of any line sets it.
 */
function lineMetrics(
  lines: readonly TextLineLayout[],
  fontMetrics: FontMetrics,
  fontSizePx: number,
  lineSpacingPx: number
): { baselineOffsetPx: number; linePitchPx: number } {
  const ascentPx = getFontAscentPx(fontMetrics, fontSizePx);
  const descentPx = getFontDescentPx(fontMetrics, fontSizePx);
  let liftPx = 0;
  let dropPx = 0;
  for (const { glyphs } of lines) {
    const { abovePx, belowPx } = glyphOffsetReachPx(glyphs);
    liftPx = Math.max(liftPx, abovePx - ascentPx);
    dropPx = Math.max(dropPx, belowPx - descentPx);
  }
  return {
    baselineOffsetPx: ascentPx + liftPx,
    linePitchPx: getFontLinePitchPx(fontMetrics, fontSizePx, lineSpacingPx) + liftPx + dropPx,
  };
}

/** The width of the widest of `lines`, or 0 for none. */
export function widestLineWidthPx(lines: readonly TextLineLayout[]): number {
  return lines.reduce((max, line) => Math.max(max, line.widthPx), 0);
}
