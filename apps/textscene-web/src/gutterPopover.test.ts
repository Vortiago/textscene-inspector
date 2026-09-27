/**
 * The pure placement of a gutter row's popover: which way it opens, and its height cap. The
 * component measures the row and the gutter, since happy-dom has no layout to read.
 */
import { describe, expect, it } from 'vitest';
import { POPOVER_EDGE_MARGIN, placeGutterPopover } from './gutterPopover';

const ROW = 18;
const VIEWPORT = 400;

/** The placement of the row whose top edge sits `rowTop` pixels below the gutter's top. */
function placeRowAt(rowTop: number, viewportHeight = VIEWPORT) {
  return placeGutterPopover({ rowTop, rowBottom: rowTop + ROW, viewportHeight });
}

describe('placeGutterPopover', () => {
  it('opens downward from a row in the upper half, capped at the room below it', () => {
    expect(placeRowAt(40)).toEqual({ opensUp: false, maxHeight: VIEWPORT - 40 - POPOVER_EDGE_MARGIN });
  });

  it('opens upward from a row in the lower half, capped at the room above its bottom edge', () => {
    // Two rows from the bottom: the reported case, where a downward list ran past the pane.
    const rowTop = VIEWPORT - 2 * ROW;
    expect(placeRowAt(rowTop)).toEqual({ opensUp: true, maxHeight: rowTop + ROW - POPOVER_EDGE_MARGIN });
  });

  it('keeps a row centred exactly on the half line opening downward', () => {
    expect(placeRowAt(VIEWPORT / 2 - ROW / 2)?.opensUp).toBe(false);
    expect(placeRowAt(VIEWPORT / 2 - ROW / 2 + 1)?.opensUp).toBe(true);
  });

  it('reads a row scrolled partly above the gutter as the upper half', () => {
    expect(placeRowAt(-10)).toEqual({ opensUp: false, maxHeight: VIEWPORT + 10 - POPOVER_EDGE_MARGIN });
  });

  it('never caps below the row itself, however short the gutter', () => {
    expect(placeRowAt(0, 20)).toEqual({ opensUp: false, maxHeight: ROW });
  });

  it('returns null where the gutter has no height to place against', () => {
    expect(placeRowAt(40, 0)).toBeNull();
    expect(placeRowAt(40, Number.NaN)).toBeNull();
  });
});
