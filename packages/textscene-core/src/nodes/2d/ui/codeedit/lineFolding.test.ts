/**
 * `delimiter_comments`/`delimiter_strings` vs the fold gutter
 * (`scene/gui/code_edit.cpp:1662-1735,3210-3415,3490-3508`).
 *
 * These two tables do NOT colour anything: `scene/resources/syntax_highlighter.cpp`
 * names no delimiter at all, and `CodeHighlighter` carries its own
 * `color_regions`. Their still-frame surface is `can_fold_line`, whose arrow
 * the fold gutter draws — measured against real Godot on a probe scene: three
 * CodeEdits with the SAME buffer `"# one\n# two\n# three"` and the same
 * `gutters_draw_fold_gutter`/`line_folding`, differing only in
 * `delimiter_comments`, draw an arrow beside line 0 for `PackedStringArray("#")`
 * and for a block-comment pair on a block comment, and nothing at all
 * for `PackedStringArray()`.
 */
import { describe, expect, it } from 'vitest';
import {
  buildFoldContext,
  canFoldLine,
  getIndentLevel,
  isInComment,
  isInString,
  isLineCodeRegionEnd,
  isLineCodeRegionStart,
} from './lineFolding';
import { buildDelimiters } from './delimiterRegions';

const TAB_SIZE = 4;

function ctx(text: string, comments?: string[], strings?: string[]) {
  return buildFoldContext(text.split('\n'), comments, strings, TAB_SIZE);
}

describe('buildDelimiters (code_edit.cpp:3418-3508)', () => {
  it('splits an entry on its first space into start and end keys', () => {
    expect(buildDelimiters(['/* */'], [])).toEqual([
      { type: 'comment', startKey: '/*', endKey: '*/', lineOnly: false },
    ]);
  });

  it('marks an entry with no end key line-only (:3448)', () => {
    expect(buildDelimiters(['#'], [])[0]).toMatchObject({ startKey: '#', endKey: '', lineOnly: true });
  });

  it('drops a start key that is not made of symbols (:3423-3425)', () => {
    expect(buildDelimiters(['rem'], [])).toEqual([]);
  });

  it('drops a duplicate start key (:3436)', () => {
    expect(buildDelimiters(['#', '#'], [])).toHaveLength(1);
  });

  it('orders by DESCENDING start-key length, so a longer key wins over its own prefix (:3437-3441)', () => {
    expect(buildDelimiters(['#', '#!'], []).map((d) => d.startKey)).toEqual(['#!', '#']);
  });

  it("keeps the constructor's own quote pair when delimiter_strings is unauthored (:3920-3922)", () => {
    // Reversed: `_add_delimiter` breaks out of its insertion scan the moment
    // the new key is not SHORTER than the one it is looking at (:3437-3441),
    // so an equal-length key lands in front of the ones already there.
    expect(buildDelimiters(undefined, undefined).map((d) => d.startKey)).toEqual(["'", '"']);
  });

  it('an authored delimiter_strings REPLACES them, since _set_delimiters clears the type first (:3492)', () => {
    expect(buildDelimiters(undefined, ['`']).map((d) => d.startKey)).toEqual(['`']);
  });
});

describe('isInComment / isInString (code_edit.cpp:3369-3415)', () => {
  it('reports a whole line inside a line-only comment', () => {
    const c = ctx('# one\n# two', ['#']);
    expect(isInComment(c, 0)).not.toBe(-1);
    expect(isInComment(c, 1)).not.toBe(-1);
  });

  it('reports nothing when no comment delimiter is registered', () => {
    expect(isInComment(ctx('# one\n# two', []), 0)).toBe(-1);
  });

  it('reports a line INSIDE a block comment, and the code line after it as outside', () => {
    const c = ctx('/* one\ntwo\n*/\nvar b', ['/* */']);
    expect(isInComment(c, 1)).not.toBe(-1);
    expect(isInComment(c, 3)).toBe(-1);
  });

  it('does not report a line with code before the comment key', () => {
    expect(isInComment(ctx('var b # tail', ['#']), 0)).toBe(-1);
  });

  it('reports a line inside a multi-line string region', () => {
    const c = ctx('`one\ntwo\n`\nvar b', [], ['` `']);
    expect(isInString(c, 1)).not.toBe(-1);
    expect(isInString(c, 3)).toBe(-1);
  });
});

describe('getIndentLevel (text_edit.cpp:4145-4161)', () => {
  it('counts a tab as tab_size columns', () => {
    expect(getIndentLevel('\tpass', TAB_SIZE)).toBe(4);
  });
  it('counts spaces one apiece', () => {
    expect(getIndentLevel('  pass', TAB_SIZE)).toBe(2);
  });
  it('stops one character short, so an all-tab line never counts its last', () => {
    expect(getIndentLevel('\t\t', TAB_SIZE)).toBe(4);
  });
});

describe('code region tags (code_edit.cpp:1990-2012,3186-3207)', () => {
  it('builds the tags off the single-line comment delimiter', () => {
    const c = ctx('#region a\nvar b\n#endregion', ['#']);
    expect(isLineCodeRegionStart(c, 0)).toBe(true);
    expect(isLineCodeRegionEnd(c, 2)).toBe(true);
  });

  it('has no tags at all without a single-line comment delimiter (:3201)', () => {
    const c = ctx('#region a\nvar b\n#endregion', ['/* */']);
    expect(isLineCodeRegionStart(c, 0)).toBe(false);
  });
});

describe('canFoldLine (code_edit.cpp:1662-1735)', () => {
  it('folds a line whose successor is indented further', () => {
    expect(canFoldLine(ctx('func a():\n\tpass\nvar b', ['#']), 0, true)).toBe(true);
  });

  it('folds nothing while line_folding is off (:1664)', () => {
    expect(canFoldLine(ctx('func a():\n\tpass\nvar b', ['#']), 0, false)).toBe(false);
  });

  it('never folds the last line (:1668)', () => {
    expect(canFoldLine(ctx('func a():\n\tpass', ['#']), 1, true)).toBe(false);
  });

  it('never folds a blank line (:1668)', () => {
    expect(canFoldLine(ctx('\nfunc a():\n\tpass', ['#']), 0, true)).toBe(false);
  });

  it('folds the first of a run of single-line comments (:1711-1719)', () => {
    expect(canFoldLine(ctx('# one\n# two\n# three', ['#']), 0, true)).toBe(true);
  });

  it('folds NOTHING in that same buffer once the comment table is empty — the discriminator Godot itself draws', () => {
    const c = ctx('# one\n# two\n# three', []);
    expect([0, 1, 2].map((l) => canFoldLine(c, l, true))).toEqual([false, false, false]);
  });

  it('does not fold a comment line that merely CONTINUES the run above it (:1712-1716)', () => {
    expect(canFoldLine(ctx('# one\n# two\n# three', ['#']), 1, true)).toBe(false);
  });

  it('folds the opening line of a block comment (:1721)', () => {
    expect(canFoldLine(ctx('/* one\ntwo\n*/\nvar b', ['/* */']), 0, true)).toBe(true);
  });

  it('folds a code region that has a matching end tag (:1680-1694)', () => {
    expect(canFoldLine(ctx('#region a\nvar b\n#endregion\nvar c', ['#']), 0, true)).toBe(true);
  });

  it('does not fold a region start with no end tag (:1694)', () => {
    expect(canFoldLine(ctx('#region a\nvar b\nvar c', ['#']), 0, true)).toBe(false);
  });

  it('never folds a region END line (:1677)', () => {
    expect(canFoldLine(ctx('#region a\nvar b\n#endregion\nvar c', ['#']), 2, true)).toBe(false);
  });

  it('skips a comment line when comparing indents, so a commented gap does not break the block (:1734)', () => {
    expect(canFoldLine(ctx('func a():\n# note\n\tpass\nvar b', ['#']), 0, true)).toBe(true);
  });
});
