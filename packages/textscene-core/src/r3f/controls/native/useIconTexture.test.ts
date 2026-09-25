/**
 * Pins the null path, where a wasted decode looks identical on screen, and the sampling colour
 * space. Decode-then-filter and filter-then-decode agree on texel centres and differ only across
 * the ramp between texels, so a regression shows only on a magnified icon.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { useCanvasDecodeDefines } from '../../canvas2DTextureDecode';
import { useIconTexture, useOptionalIconTexture, useNodeIcon } from './useIconTexture';
import type { ThemedIconRef } from './solveTree';
import type { TscnInternalResource } from '../../../parser/types';

const ICON = 'data:image/svg+xml;base64,PHN2Zy8+';

afterEach(() => vi.restoreAllMocks());

describe('useIconTexture', () => {
  it('loads nothing at all for a null url — no decode, no GPU texture', () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');

    const { result } = renderHook(() => useOptionalIconTexture(null));

    expect(result.current).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads once for a url and hands back a texture the 2D canvas samples undecoded', () => {
    const { result } = renderHook(() => useIconTexture(ICON));

    expect(result.current).not.toBeNull();
    expect(result.current!.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('holds that tag against a reassignment, which a `map` gets on every commit', () => {
    const { result } = renderHook(() => useIconTexture(ICON));

    result.current!.colorSpace = THREE.SRGBColorSpace;

    expect(result.current!.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('turns on the post-filter decode every painter draws it through', () => {
    const { result } = renderHook(() => useCanvasDecodeDefines(useIconTexture(ICON)));

    expect(result.current).toEqual({ DECODE_VIDEO_TEXTURE: '' });
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

describe('useNodeIcon', () => {
  const PROCEDURAL: TscnInternalResource[] = [
    { id: 'Gradient_1', type: 'Gradient', data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' } },
    { id: 'G1', type: 'GradientTexture2D', data: { gradient: 'SubResource("Gradient_1")' } },
  ];

  it('draws the vendored default when no theme resolved this icon (`Control::get_theme_icon` — nothing anywhere)', () => {
    const { result } = renderHook(() => useNodeIcon(undefined, ICON));
    expect(result.current).not.toBeNull();
    expect(result.current!.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('draws the themed texture instead of the vendored default when a theme resolved this icon', () => {
    const themed: ThemedIconRef = {
      ref: 'SubResource("G1")',
      resources: { externalResources: [], internalResources: PROCEDURAL },
    };
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');

    const { result } = renderHook(() => useNodeIcon(themed, ICON));

    expect(result.current).not.toBeNull();
    // The vendored data-URL path was never taken.
    expect(load).not.toHaveBeenCalled();
  });

  it('falls back to the vendored default when the themed ref cannot resolve — `Control::_set`\'s NIL branch removes an invalid icon override, matching an absent one', () => {
    const themed: ThemedIconRef = { ref: 'ExtResource("nope")', resources: { externalResources: [], internalResources: [] } };
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');

    const { result } = renderHook(() => useNodeIcon(themed, ICON));

    expect(result.current).not.toBeNull();
    expect(load).toHaveBeenCalled();
  });
});
