/** The draw order of a window that holds an inert clipping owner. */
import { describe, expect, it } from 'vitest';
import { collects, drawOrderOf, isOwnKey, windowIndexAt } from './groupWindow';

describe('drawOrderOf', () => {
  it('adds no empty step when an inert owner starts at the span start', () => {
    const owner = { window: { own: 10, from: 10, to: 20 }, behind: [{ from: 12, to: 13 }] };

    const steps = drawOrderOf(() => true, 10, 30, [owner]);

    expect(steps.map(({ from, to }) => [from, to])).toEqual([
      [12, 13],
      [10, 30],
    ]);
  });

  it('draws a behind span nested in an earlier owner behind span once', () => {
    const outer = { window: { own: 10, from: 10, to: 30 }, behind: [{ from: 12, to: 20 }] };
    const inner = { window: { own: 12, from: 12, to: 20 }, behind: [{ from: 14, to: 16 }] };

    const steps = drawOrderOf(() => true, 10, 30, [inner, outer]);

    // The outer span holds the inner one, so no step of its own draws [14, 16) a second time.
    expect(steps.filter(({ from, to }) => from === 14 && to === 16)).toEqual([]);
    expect(steps.filter(({ from, to }) => from === 12 && to === 20)).toHaveLength(1);
  });
});

describe('collects', () => {
  const window = { own: 12, from: 10, to: 20 };

  it('takes the keys of the window except the owner key', () => {
    expect([9, 10, 11, 12, 13, 19, 20].map((key) => collects(window, key))).toEqual([
      false,
      true,
      true,
      false,
      true,
      true,
      false,
    ]);
    expect(isOwnKey(window, 12)).toBe(true);
    expect(isOwnKey(window, 13)).toBe(false);
  });
});

describe('windowIndexAt', () => {
  const windows = [{ window: { own: 2, from: 0, to: 5 } }, { window: { own: 12, from: 10, to: 20 } }];

  it('finds the window that holds a key, its owner key included', () => {
    expect([1, 2, 4, 12, 19].map((key) => windowIndexAt(windows, key))).toEqual([0, 0, 0, 1, 1]);
  });

  it('answers -1 between windows and past the last', () => {
    expect([-1, 5, 9, 20].map((key) => windowIndexAt(windows, key))).toEqual([-1, -1, -1, -1]);
  });
});
