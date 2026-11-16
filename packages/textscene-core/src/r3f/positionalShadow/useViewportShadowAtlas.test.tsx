import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewportShadowAtlas } from './useViewportShadowAtlas';

const settingsOf = (size: number) => ({ size, quadrantShadows: [4, 4, 4, 8] as const });

describe('useViewportShadowAtlas', () => {
  it('keeps the atlas while a render builds the same settings again', () => {
    const { result, rerender } = renderHook(({ settings }) => useViewportShadowAtlas(settings), {
      initialProps: { settings: settingsOf(1024) },
    });
    const first = result.current;

    rerender({ settings: settingsOf(1024) });

    expect(result.current).toBe(first);
  });

  it('builds a new atlas when the settings change', () => {
    const { result, rerender } = renderHook(({ settings }) => useViewportShadowAtlas(settings), {
      initialProps: { settings: settingsOf(1024) },
    });
    const first = result.current;

    rerender({ settings: settingsOf(2048) });

    expect(result.current).not.toBe(first);
  });
});
