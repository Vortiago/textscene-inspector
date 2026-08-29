/**
 * The pipe-table grammar, in the one shape that broke it.
 *
 * `maskedBitField` joins its constant names with ` | `, and fourteen committed
 * rows across ten sheets ended their cell at the first of them: GFM dropped
 * the tail, so `size_flags_horizontal` printed `SIZE_EXPAND (2)` where the
 * severity belongs and lost the last two bits. Neither guard beside it could
 * see it — `docs:lint-sections --check` re-runs the generator and diffs it
 * against its own output, and `sheets.test.mjs` never counted cells.
 */

import { describe, expect, it } from 'vitest';
import { escapeCell, isDivider, splitRow, tableLines } from './markdownTable.mjs';

const MASK = 'bit mask of SIZE_FILL (1) | SIZE_EXPAND (2) | SIZE_SHRINK_END (8)';

describe('the pipe-table grammar', () => {
  it('keeps a value carrying pipes inside one cell', () => {
    const [, , row] = tableLines(
      ['Property', 'Accepts', 'Out of range'],
      [['`size_flags_horizontal`', MASK, 'error']]
    );
    const cells = splitRow(row);
    expect(cells).toHaveLength(3);
    // The tier is what the unescaped row lost: the reader was shown a mask
    // label in the column that says whether a value stops a build.
    expect(cells[2]).toBe('error');
    expect(cells[1]).toBe(MASK);
  });

  it('reads a hand-written escaped pipe as one cell too', () => {
    // navigationagent2d's `\`7\` (Types\\|RIDs\\|Owners)` row predates the
    // generated column and states the same convention by hand.
    expect(splitRow('| `path_metadata_flags` | `7` (Types\\|RIDs\\|Owners) | none |')).toEqual([
      '`path_metadata_flags`',
      '`7` (Types|RIDs|Owners)',
      'none',
    ]);
  });

  it('refuses a row that would render into the wrong number of columns', () => {
    // The escape is what prevents this, so the throw only fires for a caller
    // that hands over the wrong number of cells — the other half of the arity
    // contract, and the one a count of the inputs can see.
    expect(() => tableLines(['A', 'B'], [['one', 'two', 'three']])).toThrow(
      /renders 3 cell\(s\) into a 2-column table/
    );
  });

  it('renders the header and divider the sheets are written with', () => {
    expect(tableLines(['Rule', 'Reports'], [])).toEqual(['| Rule | Reports |', '| --- | --- |']);
  });

  it('escapes only pipes, and tells a divider from content', () => {
    expect(escapeCell('a|b')).toBe('a\\|b');
    expect(escapeCell('`code` **bold**')).toBe('`code` **bold**');
    expect(isDivider('| --- | :-: |')).toBe(true);
    expect(isDivider('| `x` | y |')).toBe(false);
  });

  it('keeps an empty leading cell, which the rules table spans rows with', () => {
    const [, , row] = tableLines(['Rule', 'Reports', 'Severity'], [['', '`orphan-node`', 'warning']]);
    expect(splitRow(row)).toEqual(['', '`orphan-node`', 'warning']);
  });
});
