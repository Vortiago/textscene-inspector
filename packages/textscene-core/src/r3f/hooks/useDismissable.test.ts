/**
 * The dismissable registry, tested directly: a leaked registration disables Escape-to-deselect for
 * the whole page, and nothing on screen looks wrong.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { hasOpenDismissable, useDismissable } from './useDismissable';

function mountPanel(open: boolean) {
  return renderHook(({ isOpen }) => useDismissable<HTMLDivElement>(isOpen, () => {}), {
    initialProps: { isOpen: open },
  });
}

describe('useDismissable', () => {
  it('registers only while open', () => {
    expect(hasOpenDismissable()).toBe(false);
    const panel = mountPanel(false);
    expect(hasOpenDismissable()).toBe(false);

    act(() => panel.rerender({ isOpen: true }));
    expect(hasOpenDismissable()).toBe(true);

    act(() => panel.rerender({ isOpen: false }));
    expect(hasOpenDismissable()).toBe(false);
    panel.unmount();
  });

  it('releases its claim when unmounted WHILE open', () => {
    // A panel unmounted without closing first, as a viewport-mode switch unmounts the legend,
    // must not leave Escape vetoed for ever.
    const panel = mountPanel(true);
    expect(hasOpenDismissable()).toBe(true);
    act(() => panel.unmount());
    expect(hasOpenDismissable()).toBe(false);
  });

  it('is order-independent across several panels', () => {
    // A registry, not listener ordering: the answer must not depend on which panel mounted first.
    const first = mountPanel(true);
    const second = mountPanel(true);
    expect(hasOpenDismissable()).toBe(true);

    act(() => first.unmount());
    expect(hasOpenDismissable()).toBe(true); // the second still holds it

    act(() => second.unmount());
    expect(hasOpenDismissable()).toBe(false);
  });

  it('returns a ref the caller can attach', () => {
    const panel = mountPanel(true);
    expect(panel.result.current).toHaveProperty('current');
    panel.unmount();
  });
});
