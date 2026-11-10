/** The draw order of a window that holds an inert clipping owner. */
import { describe, expect, it } from 'vitest';
import { drawOrderOf } from './groupWindow';

describe('drawOrderOf', () => {
  it('adds no empty step when an inert owner starts at the span start', () => {
    const owner = { window: { own: 10, from: 10, to: 20 }, behind: [{ from: 12, to: 13 }] };

    const steps = drawOrderOf(() => true, 10, 30, [owner]);

    expect(steps.map(({ from, to }) => [from, to])).toEqual([
      [12, 13],
      [10, 30],
    ]);
  });
});
