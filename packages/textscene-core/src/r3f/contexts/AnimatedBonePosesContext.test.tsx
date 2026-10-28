/**
 * The registry of bone poses an AnimationPlayer writes to a Skeleton3D. The meshes bound to the
 * skeleton listen by its live path, and a release is null.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AnimatedPose } from '../../nodes/3d/skeleton3d/skeletonPose';
import { AnimatedBonePosesProvider, useAnimatedBonePoses } from './AnimatedBonePosesContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AnimatedBonePosesProvider>{children}</AnimatedBonePosesProvider>
);

const POSE: AnimatedPose = new Map([['b4', { rotation: { x: 0, y: 0, z: -0.5, w: 0.866025 } }]]);

describe('AnimatedBonePosesContext', () => {
  it('is a no-op outside a provider (a push reaches no one, never throws)', () => {
    const { result } = renderHook(useAnimatedBonePoses);

    expect(() => result.current.set('Root/Skeleton3D', POSE)).not.toThrow();
    expect(result.current.get('Root/Skeleton3D')).toBeNull();
  });

  it('hands a pushed pose to every listener of that skeleton, and to no other', () => {
    const { result } = renderHook(useAnimatedBonePoses, { wrapper });
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    result.current.subscribe('Root/Skeleton3D', first);
    result.current.subscribe('Root/Skeleton3D', second);
    result.current.subscribe('Root/Other', other);

    result.current.set('Root/Skeleton3D', POSE);

    expect(first).toHaveBeenCalledWith(POSE);
    expect(second).toHaveBeenCalledWith(POSE);
    expect(other).not.toHaveBeenCalled();
  });

  it('keeps the pushed pose for a listener that subscribes later', () => {
    const { result } = renderHook(useAnimatedBonePoses, { wrapper });

    result.current.set('Root/Skeleton3D', POSE);

    expect(result.current.get('Root/Skeleton3D')).toBe(POSE);
  });

  it('releases with null, which listeners and later readers see', () => {
    const { result } = renderHook(useAnimatedBonePoses, { wrapper });
    const listener = vi.fn();
    result.current.subscribe('Root/Skeleton3D', listener);
    result.current.set('Root/Skeleton3D', POSE);

    result.current.set('Root/Skeleton3D', null);

    expect(listener).toHaveBeenLastCalledWith(null);
    expect(result.current.get('Root/Skeleton3D')).toBeNull();
  });

  it('stops pushing to a listener that unsubscribed', () => {
    const { result } = renderHook(useAnimatedBonePoses, { wrapper });
    const listener = vi.fn();
    const unsubscribe = result.current.subscribe('Root/Skeleton3D', listener);

    unsubscribe();
    result.current.set('Root/Skeleton3D', POSE);

    expect(listener).not.toHaveBeenCalled();
  });
});
