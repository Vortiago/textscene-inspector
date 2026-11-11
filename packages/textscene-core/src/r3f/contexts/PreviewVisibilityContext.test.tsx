/**
 * The host says whether the preview shows, and the canvases stop rendering while it does not.
 * A scene that still loads keeps the loop on, since the tiled texture upload advances only in a frame.
 */
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { textureWork } from '../../resources/textures/textureWork';
import { PreviewVisibilityProvider, usePreviewFrameloop } from './PreviewVisibilityContext';

/** Renders the hook under a host whose visibility `setVisible` changes. */
function renderUnderHost(initiallyVisible: boolean) {
  let isVisible = initiallyVisible;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PreviewVisibilityProvider isVisible={isVisible}>{children}</PreviewVisibilityProvider>
  );
  const { result, rerender } = renderHook(() => usePreviewFrameloop(), { wrapper });
  return {
    result,
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

  it('keeps the loop on while a hidden preview still uploads a texture, and stops it once that ends (edge case)', () => {
    const endWork = textureWork.begin();
    const { result } = renderUnderHost(false);
    expect(result.current).toBe('always');

    act(() => endWork());

    expect(result.current).toBe('never');
  });
});
