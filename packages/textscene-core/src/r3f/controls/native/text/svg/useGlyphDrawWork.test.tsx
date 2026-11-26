import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ResourceLoader } from '../../../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../../../resources/ResourceLoaderContext';
import { createPendingProbe } from '../../../../../resources/testing/pendingProbe';
import { useGlyphDrawWork } from './useGlyphDrawWork';

function heldDraw() {
  let land = () => {};
  const draw = new Promise<void>((resolve) => (land = resolve));
  return { draw, land };
}

function renderInView(draws: ReadonlySet<Promise<void>>) {
  const { Probe, work } = createPendingProbe();
  const loader = new ResourceLoader();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>
      <Probe />
      {children}
    </ResourceLoaderProvider>
  );
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
});
