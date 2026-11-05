/**
 * The `visible_characters` and `visible_ratio` pair that Label and RichTextLabel share: two setters
 * that derive each other from the text's character count (`label.cpp:1285-1327`,
 * `rich_text_label.cpp:7401-7430,7892-7948`).
 */

import { VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type { GlyphPlacement, TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';

interface VisibleCharsState {
  visibleChars: number;
  visibleRatio: number;
  /** The setter that ran last: the other field is derived from it and the text length. Absent for the defaults. */
  lastSetter?: 'characters' | 'ratio';
}

/** Godot's construction defaults for both classes (label.h:75-76, rich_text_label.h:553). */
const DEFAULT_VISIBLE_CHARS_STATE: VisibleCharsState = { visibleChars: -1, visibleRatio: 1 };

/** `Label::set_visible_characters` (label.cpp:1285-1299): a no-op when `p_amount` matches the current field, else re-derives both fields from the current text length. */
function applySetVisibleCharacters(
  state: VisibleCharsState,
  amount: number,
  totalChars: number,
  emptyTextKeepsRatio: boolean
): VisibleCharsState {
  if (state.visibleChars === amount) return state;
  // Label resets the ratio on empty text (label.cpp:1288); RichTextLabel leaves it (:7898-7900).
  const emptyTextRatio = emptyTextKeepsRatio ? state.visibleRatio : 1;
  const visibleRatio = amount === -1 ? 1 : totalChars === 0 ? emptyTextRatio : amount / totalChars;
  return { visibleChars: amount, visibleRatio, lastSetter: 'characters' };
}

/**
 * `count * ratio` as an `int`, in single precision as Godot's `int * float` is: 44 times 30/44 is
 * 29.999999999999996 in double precision, which truncates to 29, and 30 in float.
 */
export function truncatedShare(count: number, ratio: number): number {
  return Math.trunc(Math.fround(count * Math.fround(ratio)));
}

/** `Label::set_visible_ratio` (label.cpp:1305-1323): a no-op when `p_ratio` matches the current field. */
function applySetVisibleRatio(
  state: VisibleCharsState,
  ratio: number,
  totalChars: number
): VisibleCharsState {
  if (state.visibleRatio === ratio) return state;
  if (ratio >= 1) return { visibleChars: -1, visibleRatio: 1, lastSetter: 'ratio' };
  if (ratio < 0) return { visibleChars: 0, visibleRatio: 0, lastSetter: 'ratio' };
  return { visibleChars: truncatedShare(totalChars, ratio), visibleRatio: ratio, lastSetter: 'ratio' };
}

/**
 * `visible_characters` and `visible_ratio` derive each other, and each setter runs only when its own
 * field changes (label.cpp:1286,1306), so the last one written wins. Godot applies `_set` in file order
 * (packed_scene.cpp:492), which the raw property bag keeps. `text` counts as applied first, as every
 * Godot save writes it first (`ADD_PROPERTY`, label.cpp:1431), even in a hand-edited file.
 */
function resolveVisibleChars(
  properties: Record<string, string>,
  textLength: () => number,
  emptyTextKeepsRatio: boolean
): VisibleCharsState | undefined {
  const rawChars = properties.visible_characters;
  const rawRatio = properties.visible_ratio;
  if (rawChars === undefined && rawRatio === undefined) return undefined;

  const totalChars = textLength();
  let state = DEFAULT_VISIBLE_CHARS_STATE;
  for (const key of Object.keys(properties)) {
    if (key === 'visible_characters') {
      const amount = parseOptionalInt(rawChars);
      if (amount !== undefined)
        state = applySetVisibleCharacters(state, amount, totalChars, emptyTextKeepsRatio);
    } else if (key === 'visible_ratio') {
      const ratio = parseOptionalFloat(rawRatio);
      if (ratio !== undefined) state = applySetVisibleRatio(state, ratio, totalChars);
    }
  }
  return state;
}

/** Label's pair: empty text resets the ratio (`label.cpp:1288`). */
export function resolveLabelVisibleChars(
  properties: Record<string, string>,
  textLength: () => number
): VisibleCharsState | undefined {
  return resolveVisibleChars(properties, textLength, false);
}

/** RichTextLabel's pair: empty text keeps the ratio (`rich_text_label.cpp:7898-7900`). */
export function resolveRichTextVisibleChars(
  properties: Record<string, string>,
  textLength: () => number
): VisibleCharsState | undefined {
  return resolveVisibleChars(properties, textLength, true);
}

interface VisibleCharsBudget {
  behavior: number;
  /** Final resolved `visible_chars`, the budget of CHARS_AFTER_SHAPING. */
  visibleChars: number | undefined;
  /** Final resolved `visible_ratio`, the budget of the GLYPHS_* behaviours. */
  visibleRatio: number | undefined;
  /** The characters of the text when the lines hold fewer: RichTextLabel counts each paragraph's characters, trimmed edge spaces included (`rich_text_label.cpp:8017-8033`). Each ligature still counts one glyph. */
  totalCharacters?: number;
  /** `is_layout_rtl()` (`SolveNode.rtl`), which picks the end GLYPHS_AUTO trims from (`label.cpp:779-780`). Defaults `false`. */
  rtl?: boolean;
}

/**
 * `draw_text`'s per-glyph `skip` (`label.cpp:778-780,label.h:197-240`) over lines already shaped
 * and windowed to `label.cpp`'s `start`/`end` (`:548-559`). CHARS_AFTER_SHAPING hides each glyph whose
 * source character is at or past the budget (`p_glyphs[j].end + p_para_start > p_visible_chars`). The
 * GLYPHS behaviours count glyphs in visual order: GLYPHS_LTR from the front, GLYPHS_RTL from the back
 * (`label.cpp:780`), and GLYPHS_AUTO picks by `rtl_layout` (`:779-780`).
 */
export function applyVisibleCharsReveal(
  lines: readonly TextLineLayout[],
  budget: VisibleCharsBudget
): TextLineLayout[] {
  if (budget.behavior === VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING) return [...lines];
  if (budget.behavior === VisibleCharactersBehavior.VC_CHARS_AFTER_SHAPING) {
    return revealCharacters(lines, budget.visibleChars);
  }
  return revealGlyphs(lines, budget);
}

/**
 * CHARS_AFTER_SHAPING. An ellipsis glyph has no source character: its `end` is -1 (`text_server.h:628`),
 * so it hides where `paragraphStart - 1 > visibleChars`.
 */
function revealCharacters(
  lines: readonly TextLineLayout[],
  visibleChars: number | undefined
): TextLineLayout[] {
  if (visibleChars === undefined || visibleChars < 0) return [...lines];
  return lines.map((line) => {
    const isEllipsisShown = (line.paragraphStart ?? 0) - 1 <= visibleChars;
    const { tails, lastIndexOf } = ligatureClusters(line.glyphs);
    let isLigatureShown = false;
    return {
      ...line,
      glyphs: line.glyphs.filter((glyph) => {
        if (tails.has(glyph)) return isLigatureShown;
        if (glyph.sourceIndex === undefined) return isEllipsisShown;
        // A ligature's `end` is its last character's, so it shows whole or not at all.
        isLigatureShown = (lastIndexOf.get(glyph) ?? glyph.sourceIndex) < visibleChars;
        return isLigatureShown;
      }),
    };
  });
}

/**
 * The default font draws these sequences as one glyph, which `shaped_text_get_glyph_count` counts once
 * (measured with `pnpm ref:godot`; `ft`, `tt`, `fj`, `fb`, `fh`, `fk` and `Th` stay two). Longest first.
 */
const LIGATURES = ['ffi', 'ffl', 'ff', 'fi', 'fl'];

interface LigatureClusters {
  /** The glyphs that only continue the ligature before them: the layout has one glyph per character, Godot one for the sequence. */
  tails: Set<GlyphPlacement>;
  /** For each ligature's first glyph, the source index of its last character, where the cluster ends. */
  lastIndexOf: Map<GlyphPlacement, number>;
}

/** The ligatures in a line of glyphs. Only the default font's glyphs form one here. */
function ligatureClusters(glyphs: readonly GlyphPlacement[]): LigatureClusters {
  const clusters: LigatureClusters = { tails: new Set(), lastIndexOf: new Map() };
  for (let start = 0; start < glyphs.length; start++) {
    if (glyphs[start]!.char !== LIGATURE_START) continue;
    const length = ligatureLengthAt(glyphs, start);
    if (length === 0) continue;
    for (let offset = 1; offset < length; offset++) clusters.tails.add(glyphs[start + offset]!);
    clusters.lastIndexOf.set(glyphs[start]!, glyphs[start + length - 1]!.sourceIndex!);
    start += length - 1;
  }
  return clusters;
}

/** `f` starts every ligature, so a line without one skips the search. */
const LIGATURE_START = 'f';

/** A ligature joins glyphs of one face at one size: a style or size change inside the sequence splits it. */
function ligatureLengthAt(glyphs: readonly GlyphPlacement[], start: number): number {
  const first = glyphs[start]!;
  return (
    LIGATURES.find((ligature) =>
      [...ligature].every((char, offset) => {
        const glyph = glyphs[start + offset];
        return (
          glyph?.char === char &&
          glyph.glyph !== null &&
          glyph.sourceIndex === first.sourceIndex! + offset &&
          glyph.fontMetrics === first.fontMetrics &&
          glyph.fontSizePx === first.fontSizePx
        );
      })
    )?.length ?? 0
  );
}

/** The GLYPHS behaviours: `visible_ratio * total_glyphs` glyphs, counted in visual order across lines. */
function revealGlyphs(lines: readonly TextLineLayout[], budget: VisibleCharsBudget): TextLineLayout[] {
  if (budget.visibleRatio === undefined || budget.visibleRatio >= 1) return [...lines];
  const tailsByLine = lines.map((line) => ligatureClusters(line.glyphs).tails);
  const tailCount = tailsByLine.reduce((sum, tails) => sum + tails.size, 0);
  const totalGlyphs =
    (budget.totalCharacters ?? lines.reduce((sum, l) => sum + l.glyphs.length, 0)) - tailCount;
  const limit = truncatedShare(totalGlyphs, Math.max(0, budget.visibleRatio));
  const fromEnd =
    budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_RTL ||
    (budget.behavior === VisibleCharactersBehavior.VC_GLYPHS_AUTO && budget.rtl === true);
  const hideBefore = fromEnd ? totalGlyphs - limit : 0;
  let seen = 0;
  let isShown = false;
  return lines.map((line, lineIndex) => {
    const glyphs = line.glyphs.filter((glyph) => {
      if (tailsByLine[lineIndex]!.has(glyph)) return isShown;
      isShown = fromEnd ? seen >= hideBefore : seen < limit;
      seen++;
      return isShown;
    });
    return glyphs.length === line.glyphs.length ? line : { ...line, glyphs };
  });
}
