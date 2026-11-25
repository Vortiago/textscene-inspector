import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Polygon2DProperties } from './types';
import type { PolygonSkeletonBinding } from './skeletonBinding';
import { useSkeletonBinding } from './useSkeletonBinding';

/** What the mocked live tree selects for the polygon, set by each test. Undefined: no tree yet. */
const live = vi.hoisted(() => ({ selected: undefined as PolygonSkeletonBinding | null | undefined }));

vi.mock('../../../r3f/liveScenePass', () => ({
  useLiveScenePassSelection: (_pass: unknown, select: unknown) => (select ? live.selected : undefined),
}));

const NAMES_SKELETON = {
  skeleton: '../Skeleton',
  bones: [{ path: 'Arm', weights: [1, 1, 1] }],
  invertEnabled: false,
} as unknown as Polygon2DProperties;
const BINDING = { skeletonPath: '/Root/Skeleton', influences: [] } as unknown as PolygonSkeletonBinding;

afterEach(() => {
  live.selected = undefined;
});

describe('useSkeletonBinding', () => {
  it('counts a polygon as skinned while the live tree has not resolved its skeleton', () => {
    const { result } = renderHook(() => useSkeletonBinding(NAMES_SKELETON, '/Root/Strip'));

    expect(result.current).toEqual({ binding: undefined, isSkinned: true });
  });

  it('draws unskinned when the resolved path finds no Skeleton2D', () => {
    live.selected = null;
    const { result } = renderHook(() => useSkeletonBinding(NAMES_SKELETON, '/Root/Strip'));

    expect(result.current).toEqual({ binding: undefined, isSkinned: false });
  });

  it('draws skinned with the binding the live tree resolves', () => {
    live.selected = BINDING;
    const { result } = renderHook(() => useSkeletonBinding(NAMES_SKELETON, '/Root/Strip'));

    expect(result.current).toEqual({ binding: BINDING, isSkinned: true });
  });

  it('is unskinned for a polygon that names no skeleton', () => {
    live.selected = BINDING;
    const props = { ...NAMES_SKELETON, skeleton: undefined } as Polygon2DProperties;
    const { result } = renderHook(() => useSkeletonBinding(props, '/Root/Strip'));

    expect(result.current).toEqual({ binding: undefined, isSkinned: false });
  });
});
