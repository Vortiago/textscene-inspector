/**
 * RichTextLabel's `visible_characters`: which glyphs `_draw_line` skips
 * (`rich_text_label.cpp:943-947,1466`) and where Before Shaping cuts the text (`:668-671`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type { GlyphPlacement, TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { applyVisibleCharsReveal } from '../label/nativeSolver';
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

/** The reveal a label asks for, or undefined while every character shows (`visible_characters < 0`). */
export function richTextReveal(
  props: Pick<RichTextLabelProperties, 'visibleCharacters' | 'visibleRatio' | 'visibleCharactersBehavior'>,
  rtl: boolean
): RichTextReveal | undefined {
  const { visibleCharacters, visibleRatio = 1, visibleCharactersBehavior } = props;
  if (visibleCharacters === undefined || visibleCharacters < 0) return undefined;
  return {
    behavior: visibleCharactersBehavior ?? VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING,
    characters: visibleCharacters,
    ratio: visibleRatio,
    rtl,
  };
}

/** The runs as the text Godot counts: each run's text and the newlines a paragraph tag added to it. */
type CountedRun = Pick<StyledTextRun, 'text' | 'implicitBreaks'>;

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
 * The glyphs `_draw_line` still draws, or undefined when it skips none. Before Shaping skips none
 * here: it cuts the text before shaping (`truncateRunsToCharacters`). The budget is the glyphs of
 * the whole text, one per character, so an edge space a wrap trims still counts (`:8017-8033`)
 * though no line draws it. A paragraph terminator counts too, as `_draw_line` counts it, but the
 * one of an implicit break does not exist in Godot.
 */
export function revealedGlyphs(
  layout: TextLayoutResult,
  runs: readonly CountedRun[],
  reveal: RichTextReveal
): ReadonlySet<GlyphPlacement> | undefined {
  if (reveal.behavior === VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING) return undefined;
  const implicit = implicitBreakIndices(runs);
  const textLength = runs.reduce((total, run) => total + run.text.length, 0);
  const budget = {
    behavior: reveal.behavior,
    visibleChars: reveal.characters,
    visibleRatio: reveal.ratio,
    totalGlyphs: textLength - implicit.size,
    rtl: reveal.rtl,
  };
  if (implicit.size === 0) {
    return new Set(applyVisibleCharsReveal(layout.lines, budget).flatMap((line) => line.glyphs));
  }
  // The glyph a budget sees carries Godot's character index: the index in the text less the
  // implicit newlines before it.
  const skippedBefore = implicitBreaksBefore(textLength, implicit);
  const originals = new Map<GlyphPlacement, GlyphPlacement>();
  const countedLines = layout.lines.map((line) => ({
    ...line,
    glyphs: line.glyphs
      .filter((glyph) => !implicit.has(glyph.sourceIndex!))
      .map((glyph) => {
        const counted = { ...glyph, sourceIndex: glyph.sourceIndex! - skippedBefore[glyph.sourceIndex!]! };
        originals.set(counted, glyph);
        return counted;
      }),
  }));
  const shownLines = applyVisibleCharsReveal(countedLines, budget);
  return new Set(shownLines.flatMap((line) => line.glyphs.map((glyph) => originals.get(glyph)!)));
}

/** For each index of a text of `length` characters, how many implicit newlines lie before it. */
function implicitBreaksBefore(length: number, implicit: ReadonlySet<number>): number[] {
  const before: number[] = [];
  let skipped = 0;
  for (let index = 0; index < length; index++) {
    before.push(skipped);
    if (implicit.has(index)) skipped++;
  }
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
  let remaining = characters;
  let runStart = 0;
  for (const run of runs) {
    if (remaining <= 0) break;
    let length = 0;
    while (length < run.text.length && remaining > 0) {
      if (!implicit.has(runStart + length)) remaining--;
      length++;
    }
    kept.push(length === run.text.length ? run : cutRun(run, length));
    runStart += run.text.length;
  }
  return kept;
}

function cutRun(run: StyledTextRun, length: number): StyledTextRun {
  return {
    ...run,
    text: run.text.slice(0, length),
    implicitBreaks: run.implicitBreaks?.filter((index) => index < length),
  };
}
