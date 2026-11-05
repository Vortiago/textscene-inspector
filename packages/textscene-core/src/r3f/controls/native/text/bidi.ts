/**
 * The Unicode bidirectional algorithm (Unicode Standard Annex 9) for one text paragraph, as Godot's advanced text
 * server runs ICU's `ubidi` over it: the paragraph direction (`text_server_adv.cpp:7231-7256`),
 * one bidi pass per override range (`:7258-7300`), and the reorder of each line on its own
 * (`_shape_substr`, `:5350-5420`). `bidi-js` supplies the levels, the reorder and the mirror.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import bidiFactory, { type EmbeddingLevels } from 'bidi-js';
import { TextDirection } from '../../../../godot/text/textServerEnums';
import { isLocaleRightToLeft } from '../../../../godot/text/textServer';
import type { StructuredTextRange } from '../../../../godot/text/structuredText';

const bidi = bidiFactory();

export interface ParagraphBidiOptions {
  /** `TextDirection`. AUTO by default, Godot's default for every Control, Label3D and TextMesh. */
  direction?: number;
  /** Absent or empty runs the whole paragraph as one INHERITED range (`text_server_adv.cpp:7258-7262`). */
  overrides?: readonly StructuredTextRange[];
  /** The language of the text, else the locale: it sets the direction of a text with no strong character. */
  language?: string;
}

export interface ParagraphBidi {
  /** `shaped_text_get_inferred_direction() == DIRECTION_RTL`: the paragraph direction the text server resolved. */
  readonly isRtl: boolean;
  /** The embedding level of each character. An odd level is right-to-left. */
  readonly levels: Uint8Array;
  /** Whether every character is at level 0, so the visual order is the logical one and no glyph mirrors. */
  readonly isLeftToRight: boolean;
  /** The indices of `[start, end)` in visual order, left to right: each range reordered on its own, the ranges in logical order. */
  visualOrder(start: number, end: number): number[];
  /** The override range of each character, which shapes as its own runs. -1 for a character no range covers, which has no glyph. */
  readonly rangeIds: Int32Array;
  /** The character the glyph at `index` draws: its mirrored pair at an odd level, as HarfBuzz draws an RTL run. */
  glyphChar(index: number): string;
}

/** One override range with the levels of its own bidi pass, indexed from the range start. */
interface ResolvedRange {
  start: number;
  end: number;
  text: string;
  embedding: EmbeddingLevels;
}

type BaseDirection = 'ltr' | 'rtl';

/**
 * A right-to-left letter (Hebrew, Arabic, Syriac, Thaana, NKo and their presentation forms, and the
 * astral right-to-left blocks) or an explicit embedding, override or isolate control. Text without one
 * at an LTR paragraph direction resolves to level 0 everywhere, so it skips the bidi pass.
 */
const RAISES_LEVEL =
  /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u200F\u202A-\u202E\u2066-\u2069\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;

/**
 * `ubidi_getBaseDirection`: the direction of the first strong character, L or R or AL, else null.
 * It reads no isolate or embedding control, as ICU's does not.
 */
function firstStrongDirection(text: string): BaseDirection | null {
  for (const char of text) {
    const type = bidi.getBidiCharTypeName(char);
    if (type === 'L') return 'ltr';
    if (type === 'R' || type === 'AL') return 'rtl';
  }
  return null;
}

/** The direction LTR and RTL fix, else null for AUTO and INHERITED, which the text decides. */
function explicitDirection(direction: number): BaseDirection | null {
  if (direction === TextDirection.TEXT_DIRECTION_LTR) return 'ltr';
  if (direction === TextDirection.TEXT_DIRECTION_RTL) return 'rtl';
  return null;
}

/**
 * `sd->para_direction` (`text_server_adv.cpp:7231-7256`). AUTO and INHERITED take the first strong
 * character, else the language: Label passes its `language`, else the locale (`label.cpp:139`).
 */
function paragraphDirection(text: string, direction: number, language: string): BaseDirection {
  return (
    explicitDirection(direction) ??
    firstStrongDirection(text) ??
    (isLocaleRightToLeft(language) ? 'rtl' : 'ltr')
  );
}

/**
 * The base direction of one override range's `ubidi_setPara` (`text_server_adv.cpp:7275-7292`).
 * INHERITED takes `base_para_direction`, which is the paragraph direction: a neutral paragraph's
 * `UBIDI_DEFAULT_*` finds no strong character in any part of it.
 */
function rangeDirection(text: string, direction: number, paragraph: BaseDirection): BaseDirection {
  if (direction === TextDirection.TEXT_DIRECTION_INHERITED) return paragraph;
  return explicitDirection(direction) ?? firstStrongDirection(text) ?? paragraph;
}

/**
 * The override ranges clipped to the text, or one INHERITED range over all of it when there is none
 * (`text_server_adv.cpp:7258-7262`). A character outside every range is not shaped, so it has no
 * glyph: Godot's LIST parser leaves its first part out this way (`text_server.cpp:2194-2205`).
 */
function shapedRanges(length: number, overrides: readonly StructuredTextRange[]): StructuredTextRange[] {
  if (overrides.length === 0)
    return [{ start: 0, end: length, direction: TextDirection.TEXT_DIRECTION_INHERITED }];
  const ranges: StructuredTextRange[] = [];
  let shapedEnd = 0;
  for (const range of overrides) {
    const start = Math.max(range.start, shapedEnd);
    const end = Math.min(range.end, length);
    if (start >= end) continue;
    ranges.push({ start, end, direction: range.direction });
    shapedEnd = end;
  }
  return ranges;
}

/** `[start, end)` in logical order. */
function logicalOrder(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_v, k) => start + k);
}

/** A paragraph at level 0 throughout: one range, logical order, no mirror. */
function leftToRightParagraph(text: string): ParagraphBidi {
  return {
    isRtl: false,
    isLeftToRight: true,
    levels: new Uint8Array(text.length),
    rangeIds: new Int32Array(text.length),
    visualOrder: logicalOrder,
    glyphChar: (index) => text[index]!,
  };
}

/** Reverses `values[first..last]`, both ends included. */
function reverseInPlace(values: number[], first: number, last: number): void {
  for (let low = first, high = last; low < high; low++, high--) {
    [values[low], values[high]] = [values[high]!, values[low]!];
  }
}

/**
 * `[from, to)` of one range in visual order, offset to paragraph indices. `ubidi_setLine` (`:5359`):
 * rule L1 resets the line's own trailing whitespace, then L2 reverses each segment in turn.
 */
function rangeVisualOrder(range: ResolvedRange, from: number, to: number): number[] {
  const order = logicalOrder(range.start + from, range.start + to);
  for (const [first, last] of bidi.getReorderSegments(range.text, range.embedding, from, to - 1)) {
    reverseInPlace(order, first! - from, last! - from);
  }
  return order;
}

/** Resolves the levels of `text`, one bidi pass per override range, and answers its visual order. */
export function resolveParagraphBidi(text: string, options: ParagraphBidiOptions = {}): ParagraphBidi {
  const { direction = TextDirection.TEXT_DIRECTION_AUTO, overrides = [], language = '' } = options;
  const paragraph = paragraphDirection(text, direction, language);
  if (paragraph === 'ltr' && overrides.length === 0 && !RAISES_LEVEL.test(text))
    return leftToRightParagraph(text);

  const levels = new Uint8Array(text.length);
  const rangeIds = new Int32Array(text.length).fill(-1);
  const ranges: ResolvedRange[] = shapedRanges(text.length, overrides).map(
    ({ start, end, direction }, rangeId) => {
      const rangeText = text.slice(start, end);
      const embedding = bidi.getEmbeddingLevels(rangeText, rangeDirection(rangeText, direction, paragraph));
      levels.set(embedding.levels, start);
      rangeIds.fill(rangeId, start, end);
      return { start, end, text: rangeText, embedding };
    }
  );

  const visualOrder = (start: number, end: number): number[] =>
    ranges.flatMap((range) => {
      const from = Math.max(start, range.start) - range.start;
      const to = Math.min(end, range.end) - range.start;
      return from < to ? rangeVisualOrder(range, from, to) : [];
    });

  const glyphChar = (index: number): string => {
    const char = text[index]!;
    return levels[index]! % 2 === 1 ? (bidi.getMirroredCharacter(char) ?? char) : char;
  };

  return { isRtl: paragraph === 'rtl', isLeftToRight: false, levels, rangeIds, visualOrder, glyphChar };
}
