/**
 * RichTextLabel's `visible_characters`: which glyphs `_draw_line` skips
 * (`rich_text_label.cpp:943-947,1466`) and where Before Shaping cuts the text (`:668-671`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { codePointCount, utf16OffsetOf, utf16WidthAt } from '../../../../godot/string/codePoints';
import { VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type {
  GlyphPlacement,
  TextLayoutResult,
  TextLineLayout,
} from '../../../../r3f/controls/native/text/textLayout';
import { applyVisibleCharsReveal, truncatedShare } from '../shared/visibleChars';
import type { StyledTextRun } from './nativeSolver';
import type { RichTextLabelProperties } from './types';

/** The budget of a label that hides characters: `visible_characters` and its derived `visible_ratio`. */
export interface RichTextReveal {
  behavior: number;
  characters: number;
  ratio: number;
  /** `is_layout_rtl()`, which picks the end GLYPHS_AUTO hides from (`:944-945`). */
  rtl: boolean;
}

/**
 * The reveal a label asks for, or undefined while every character shows. `totalCharacters` is
 * `get_total_character_count` of the runs drawn: the field written last is the fixed one, and the
 * other follows from the total (`rich_text_label.cpp:7892-7948`).
 */
export function richTextReveal(
  props: Pick<
    RichTextLabelProperties,
    'visibleCharacters' | 'visibleRatio' | 'visibleRatioDrives' | 'visibleCharactersBehavior'
  >,
  rtl: boolean,
  totalCharacters: number
): RichTextReveal | undefined {
  const { visibleCharacters, visibleRatio = 1, visibleCharactersBehavior } = props;
  const behavior = visibleCharactersBehavior ?? VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING;
  if (props.visibleRatioDrives) {
    if (visibleRatio >= 1) return undefined;
    const characters = visibleRatio < 0 ? 0 : truncatedShare(totalCharacters, visibleRatio);
    return { behavior, characters, ratio: visibleRatio, rtl };
  }
  if (visibleCharacters === undefined || visibleCharacters < 0) return undefined;
  const ratio = totalCharacters > 0 ? Math.fround(visibleCharacters / totalCharacters) : visibleRatio;
  return { behavior, characters: visibleCharacters, ratio, rtl };
}

/** The runs as the text Godot counts: each run's text and the newlines a paragraph tag added to it. */
type CountedRun = Pick<StyledTextRun, 'text' | 'implicitBreaks'>;

const joinedText = (runs: readonly CountedRun[]): string => runs.map((run) => run.text).join('');

/** `get_total_character_count` of the runs: each code point and `[img]`, and none for the newline a paragraph tag adds. */
export function countedCharacters(runs: readonly CountedRun[]): number {
  const implicitCount = runs.reduce((total, run) => total + (run.implicitBreaks?.length ?? 0), 0);
  return codePointCount(joinedText(runs)) - implicitCount;
}

/** The indices in the runs' joined text of the newlines Godot counts no character for (`BBCodeRun.implicitBreaks`). */
function implicitBreakIndices(runs: readonly CountedRun[]): ReadonlySet<number> {
  const indices = new Set<number>();
  let runStart = 0;
  for (const run of runs) {
    for (const index of run.implicitBreaks ?? []) indices.add(runStart + index);
    runStart += run.text.length;
  }
  return indices;
}

/**
 * The glyphs `_draw_line` still draws, or undefined when it skips none (Before Shaping cuts the text
 * instead). The budget counts every character, trimmed edge spaces and paragraph terminators included
 * (`:8017-8033`), but not the newline of an implicit break, which Godot has no character for.
 */
export function revealedGlyphs(
  layout: TextLayoutResult,
  runs: readonly CountedRun[],
  reveal: RichTextReveal
): ReadonlySet<GlyphPlacement> | undefined {
  if (reveal.behavior === VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING) return undefined;
  const counted = countedLayoutOf(layout, runs);
  const shownLines = applyVisibleCharsReveal(counted.lines, {
    behavior: reveal.behavior,
    text: counted.text,
    spanStarts: counted.spanStarts,
    visibleChars: reveal.characters,
    visibleRatio: reveal.ratio,
    totalCharacters: counted.totalCharacters,
    rtl: reveal.rtl,
  });
  const { originals } = counted;
  return new Set(
    shownLines.flatMap((line) =>
      originals ? line.glyphs.map((glyph) => originals.get(glyph)!) : line.glyphs
    )
  );
}

/**
 * Whether `_draw_line` draws the prefix (a list marker) of the paragraph that `line` starts:
 * not once its character offset is past the budget, nor while the glyph budget hides its first glyph
 * (`rich_text_label.cpp:1016`). `revealed` is what `revealedGlyphs` returned for the same layout.
 */
export function isPrefixShown(
  layout: TextLayoutResult,
  runs: readonly CountedRun[],
  reveal: RichTextReveal,
  line: TextLineLayout,
  revealed: ReadonlySet<GlyphPlacement> | undefined
): boolean {
  if (reveal.behavior === VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING) return true;
  if (reveal.behavior === VisibleCharactersBehavior.VC_CHARS_AFTER_SHAPING) {
    const { skippedBefore, text } = countedLayoutOf(layout, runs);
    const paragraphStart = line.paragraphStart!;
    // Both sides are UTF-16 offsets into the counted `text`: Godot's code point comparison holds for them.
    return paragraphStart - (skippedBefore?.[paragraphStart] ?? 0) <= utf16OffsetOf(text, reveal.characters);
  }
  const firstGlyph = line.glyphs[0];
  return firstGlyph === undefined || (revealed?.has(firstGlyph) ?? true);
}

/** A layout as the budget counts it: Godot's character indices, and the glyph each counted glyph copies. */
interface CountedLayout {
  lines: readonly TextLineLayout[];
  /** The text the glyph indices count over: the runs' text less the implicit newlines. */
  text: string;
  /** Where each run after the first starts in `text`: Godot shapes each run apart. */
  spanStarts: ReadonlySet<number>;
  /** Absent when no glyph needed a copy. */
  originals?: Map<GlyphPlacement, GlyphPlacement>;
  /** For each text index and the end, the implicit newlines before it. Absent when the text has none. */
  skippedBefore?: readonly number[];
  totalCharacters: number;
}

/** Written only by `countedLayoutOf`. A layout never changes, so a reveal step reuses its entry. */
// eslint-disable-next-line no-restricted-syntax -- the build needs the runs beside its layout key, which `perObject` cannot take.
const countedLayouts = new WeakMap<TextLayoutResult, CountedLayout>();

function countedLayoutOf(layout: TextLayoutResult, runs: readonly CountedRun[]): CountedLayout {
  const cached = countedLayouts.get(layout);
  if (cached) return cached;
  const implicit = implicitBreakIndices(runs);
  const totalCharacters = countedCharacters(runs);
  const joined = joinedText(runs);
  if (implicit.size === 0) {
    const counted = { lines: layout.lines, text: joined, spanStarts: runStarts(runs), totalCharacters };
    countedLayouts.set(layout, counted);
    return counted;
  }
  // The glyph a budget sees carries Godot's character index: the index in the text less the
  // implicit newlines before it.
  const skippedBefore = implicitBreaksBefore(joined.length, implicit);
  const text = joined
    .split('')
    .filter((_, index) => !implicit.has(index))
    .join('');
  const originals = new Map<GlyphPlacement, GlyphPlacement>();
  const lines = layout.lines.map((line) => ({
    ...line,
    glyphs: line.glyphs
      .filter((glyph) => glyph.sourceIndex === undefined || !implicit.has(glyph.sourceIndex))
      .map((glyph) => {
        // A glyph past the text, or with no index, follows every implicit break.
        const index = glyph.sourceIndex;
        const counted =
          index === undefined
            ? glyph
            : { ...glyph, sourceIndex: index - (skippedBefore[index] ?? implicit.size) };
        originals.set(counted, glyph);
        return counted;
      }),
  }));
  const spanStarts = new Set([...runStarts(runs)].map((start) => start - skippedBefore[start]!));
  const counted = { lines, text, spanStarts, originals, skippedBefore, totalCharacters };
  countedLayouts.set(layout, counted);
  return counted;
}

/** The offsets in the runs' joined text where each run after the first starts. */
function runStarts(runs: readonly CountedRun[]): ReadonlySet<number> {
  const starts = new Set<number>();
  let offset = 0;
  for (const run of runs.slice(0, -1)) starts.add((offset += run.text.length));
  return starts;
}

/**
 * For each index of a text of `length` characters, and for its end, how many implicit newlines lie
 * before it. The end entry serves a paragraph that starts after a trailing newline.
 */
function implicitBreaksBefore(length: number, implicit: ReadonlySet<number>): number[] {
  const before: number[] = [];
  let skipped = 0;
  for (let index = 0; index < length; index++) {
    before.push(skipped);
    if (implicit.has(index)) skipped++;
  }
  before.push(skipped);
  return before;
}

/**
 * The runs of the first `characters` characters Godot counts: Before Shaping shapes only these for
 * drawing. An implicit newline after the last of them is left out, as it ends a line that shows nothing more.
 */
export function truncateRunsToCharacters(
  runs: readonly StyledTextRun[],
  characters: number
): StyledTextRun[] {
  const implicit = implicitBreakIndices(runs);
  const kept: StyledTextRun[] = [];
  let isCut = false;
  let remaining = characters;
  let runStart = 0;
  for (const run of runs) {
    if (remaining <= 0) break;
    let length = 0;
    while (length < run.text.length && remaining > 0) {
      if (!implicit.has(runStart + length)) remaining--;
      length += utf16WidthAt(run.text, length);
    }
    if (length < run.text.length) isCut = true;
    kept.push(length === run.text.length ? run : cutRun(run, length));
    runStart += run.text.length;
  }
  return isCut || kept.length < runs.length ? kept : (runs as StyledTextRun[]);
}

function cutRun(run: StyledTextRun, length: number): StyledTextRun {
  return {
    ...run,
    text: run.text.slice(0, length),
    implicitBreaks: run.implicitBreaks?.filter((index) => index < length),
  };
}
