import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { viewWrapper } from '../../../../../resources/testing/pendingProbe';
import { useGlyphDrawWork } from './useGlyphDrawWork';

function heldDraw() {
  let land = () => {};
  let fail = () => {};
  const draw = new Promise<void>((resolve, reject) => {
    land = resolve;
    fail = () => reject(new Error('expected a glyph bitmap, got a failed draw'));
  });
  return { draw, land, fail };
}

function renderInView(draws: ReadonlySet<Promise<void>>) {
  const { wrapper, work } = viewWrapper();
  const { unmount } = renderHook(() => useGlyphDrawWork(draws), { wrapper });
  return { fonts: () => work().fonts, unmount };
}

describe('useGlyphDrawWork', () => {
  it('counts each draw as font work of the view until it lands', async () => {
    const first = heldDraw();
    const second = heldDraw();
    const { fonts } = renderInView(new Set([first.draw, second.draw]));
    expect(fonts().pending()).toBe(2);

    await act(async () => first.land());

    expect(fonts().pending()).toBe(1);
  });

  it('stops counting a draw still in flight once the run unmounts', () => {
    const { fonts, unmount } = renderInView(new Set([heldDraw().draw]));

    unmount();

    expect(fonts().pending()).toBe(0);
  });

  it('stops counting a draw that fails', async () => {
    const failing = heldDraw();
    const { fonts } = renderInView(new Set([failing.draw]));

    await act(async () => {
      failing.fail();
      await failing.draw.catch(() => {});
    });

    expect(fonts().pending()).toBe(0);
  });

  it('counts nothing outside a view', () => {
    const draws = new Set([heldDraw().draw]);

    expect(() => renderHook(() => useGlyphDrawWork(draws))).not.toThrow();
  });
});
