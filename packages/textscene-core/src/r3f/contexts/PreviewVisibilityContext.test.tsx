/**
 * The host says whether the preview shows, and the canvases stop rendering while it does not.
 * A scene that still loads keeps the loop on, since the tiled texture upload advances only in a frame.
 */
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { viewWrapper } from '../../resources/testing/pendingProbe';
import { PreviewVisibilityProvider, usePreviewFrameloop } from './PreviewVisibilityContext';
import { ViewStatusProvider } from '../viewStatus/ViewStatusContext';
import { createViewStatusStore } from '../viewStatus/viewStatus';

/** Renders the hook in a view, under a host whose visibility `setVisible` changes. */
function renderUnderHost(initiallyVisible: boolean) {
  let isVisible = initiallyVisible;
  const view = viewWrapper();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <view.wrapper>
      <PreviewVisibilityProvider isVisible={isVisible}>{children}</PreviewVisibilityProvider>
    </view.wrapper>
  );
  const { result, rerender } = renderHook(() => usePreviewFrameloop(), { wrapper });
  return {
    result,
    work: view.work,
    setVisible(next: boolean) {
      isVisible = next;
      rerender();
    },
  };
}

describe('usePreviewFrameloop', () => {
  it('runs the loop with no host signal, so every other embedder renders as before', () => {
    const { result } = renderHook(() => usePreviewFrameloop());

    expect(result.current).toBe('always');
  });

  it('runs the loop while the host shows the preview', () => {
    expect(renderUnderHost(true).result.current).toBe('always');
  });

  it('stops the loop while the host hides the preview', () => {
    expect(renderUnderHost(false).result.current).toBe('never');
  });

  it('runs the loop again when the preview shows', () => {
    const { result, setVisible } = renderUnderHost(false);

    setVisible(true);

    expect(result.current).toBe('always');
  });

  it('keeps the loop on while a hidden preview still uploads a texture, and stops it once that ends (edge case)', async () => {
    const { result, work } = renderUnderHost(false);
    const endWork = await act(async () => work().textures.begin());
    expect(result.current).toBe('always');

    await act(async () => endWork());

    expect(result.current).toBe('never');
  });

  it('keeps the loop on while a hidden In-game view has yet to settle, and stops it once it has', async () => {
    const status = createViewStatusStore();
    status.attach({ revision: () => 0, subscribe: () => () => {} });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewStatusProvider store={status}>
        <PreviewVisibilityProvider isVisible={false}>{children}</PreviewVisibilityProvider>
      </ViewStatusProvider>
    );
    const { result } = renderHook(() => usePreviewFrameloop(), { wrapper });
    expect(result.current).toBe('always');

    const frame = {
      revision: 0,
      isFullSize: true,
      awaitedCamera: null,
      work: { resources: 0, textures: 0, fonts: 0 },
    };
    const facts = { scriptedNodeCount: 0, hasCurrentCamera: false };
    await act(async () => {
      status.frameDrawn({ ...frame, facts });
    });

    expect(result.current).toBe('never');
  });

  it('keeps the loop on while a hidden In-game view owes a capture, and stops it once it answers', async () => {
    const status = createViewStatusStore();
    status.attach({ revision: () => 0, subscribe: () => () => {} });
    status.frameDrawn({
      revision: 0,
      isFullSize: true,
      awaitedCamera: null,
      work: { resources: 0, textures: 0, fonts: 0 },
      facts: { scriptedNodeCount: 0, hasCurrentCamera: false },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewStatusProvider store={status}>
        <PreviewVisibilityProvider isVisible={false}>{children}</PreviewVisibilityProvider>
      </ViewStatusProvider>
    );
    const { result } = renderHook(() => usePreviewFrameloop(), { wrapper });
    expect(result.current).toBe('never');

    let image!: Promise<unknown>;
    await act(async () => {
      image = status.captureImage();
    });
    expect(result.current).toBe('always');

    await act(async () => status.readWith(() => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) })));
    await image;
    expect(result.current).toBe('never');
  });
});
