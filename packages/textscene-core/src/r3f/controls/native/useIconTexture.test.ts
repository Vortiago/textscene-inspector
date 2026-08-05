/**
 * `useIconTexture` allocates a GPU texture, and a painter cannot put the call
 * behind its own early return — hook order is fixed. So the hook itself has to
 * accept "no icon this render", or a widget whose icon is conditionally drawn
 * decodes an image and holds a texture for a quad it never renders. The
 * SplitContainers are exactly that case: `autohide` defaults true, so their
 * grabber is invisible in the common scene.
 *
 * These pin the null path, which is the part with no visible symptom when it
 * regresses — a wasted decode looks identical on screen.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { useIconTexture, useOptionalIconTexture } from './useIconTexture';

const ICON = 'data:image/svg+xml;base64,PHN2Zy8+';

afterEach(() => vi.restoreAllMocks());

describe('useIconTexture', () => {
  it('loads nothing at all for a null url — no decode, no GPU texture', () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');

    const { result } = renderHook(() => useOptionalIconTexture(null));

    expect(result.current).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads once for a url and hands back a texture in sRGB', () => {
    const { result } = renderHook(() => useIconTexture(ICON));

    expect(result.current).not.toBeNull();
    expect(result.current!.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('memoises on the url, so a re-render with the same icon does not reload', () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');

    const { result, rerender } = renderHook(({ url }) => useOptionalIconTexture(url), {
      initialProps: { url: ICON as string | null },
    });
    const first = result.current;
    rerender({ url: ICON });

    expect(result.current).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('disposes the texture when the icon turns off, rather than leaking it', () => {
    const { result, rerender } = renderHook(({ url }) => useOptionalIconTexture(url), {
      initialProps: { url: ICON as string | null },
    });
    const texture = result.current!;
    const dispose = vi.spyOn(texture, 'dispose');

    rerender({ url: null });

    expect(result.current).toBeNull();
    expect(dispose).toHaveBeenCalled();
  });
});
