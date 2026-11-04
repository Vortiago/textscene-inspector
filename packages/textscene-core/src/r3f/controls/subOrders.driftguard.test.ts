/**
 * Drift guard: no 2D-UI source adds an offset to a draw-order key. A piece drawn between two keys
 * takes its key from `canvasSubOrders` (`canvasItemState.tsx`), which keeps every piece inside its
 * parent's slot, where a hand-written fraction can pass the next piece or the next item.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, offendingLines, reportOffenders, walkSources } from '../testing/sourceScan';

const UI_ROOT = join(import.meta.dirname, '../../nodes/2d/ui');

/** Arithmetic on a key: `renderOrder + 0.05`, `chromeRenderOrder - 1`, `order + (i + 1) / 100`. */
function keyOffsetLines(source: string): number[] {
  return offendingLines(source, /[Oo]rder\}?\s*[+-]\s*[\w(]/);
}

const UI_SOURCES = walkSources([UI_ROOT], isProductionSource);

describe('Control draw-order sub-keys', () => {
  it('adds no offset to a draw-order key in 2D-UI code', () => {
    const offenders = reportOffenders(UI_SOURCES, keyOffsetLines);
    expect(offenders, `take the key from canvasSubOrders instead: ${offenders.join(', ')}`).toEqual([]);
  });

  it('would catch an offset key, and passes a handed-out one', () => {
    expect(keyOffsetLines('  renderOrder={renderOrder + 0.05}')).toEqual([1]);
    expect(keyOffsetLines('  const key = subtreeChromeRenderOrder + PIECE;')).toEqual([1]);
    expect(keyOffsetLines('  renderOrder={renderOrder + (index + 1) / 100}')).toEqual([1]);
    expect(keyOffsetLines('  renderOrder={pieces.resizer.key}')).toEqual([]);
  });
});
