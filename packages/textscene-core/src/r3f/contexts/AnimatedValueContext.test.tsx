/**
 * The AnimatedValue push registry (ADR-0016, ADR-0017) keys by node path and
 * property, and releases with `null`. The driver tests cover the end-to-end push.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AnimatedValueProvider, useAnimatedValueRegistry } from './AnimatedValueContext';

function useRegistry() {
  return useAnimatedValueRegistry();
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AnimatedValueProvider>{children}</AnimatedValueProvider>
);

describe('AnimatedValueContext', () => {
  it('is a no-op outside a provider (push reaches no one, never throws)', () => {
    const { result } = renderHook(useRegistry);
    expect(() => result.current.set('Path', 'frame', [1])).not.toThrow();
  });

  it('pushes a value to the setter registered under the same path + property', () => {
    const { result } = renderHook(useRegistry, { wrapper });
    const setter = vi.fn();
    result.current.register('Coin/Sprite2D', 'frame', setter);
    result.current.set('Coin/Sprite2D', 'frame', [2]);
    expect(setter).toHaveBeenCalledWith([2]);
  });

  it('keys by path AND property — one node animating two properties is independent', () => {
    const { result } = renderHook(useRegistry, { wrapper });
    const modulate = vi.fn();
    const size = vi.fn();
    result.current.register('Decal', 'modulate', modulate);
    result.current.register('Decal', 'size', size);

    result.current.set('Decal', 'modulate', [1, 0, 0, 0.5]);
    expect(modulate).toHaveBeenCalledWith([1, 0, 0, 0.5]);
    expect(size).not.toHaveBeenCalled();

    result.current.set('Decal', 'size', [2, 2, 2]);
    expect(size).toHaveBeenCalledWith([2, 2, 2]);
  });

  it('does not cross-talk between different node paths', () => {
    const { result } = renderHook(useRegistry, { wrapper });
    const a = vi.fn();
    const b = vi.fn();
    result.current.register('A', 'frame', a);
    result.current.register('B', 'frame', b);
    result.current.set('A', 'frame', [7]);
    expect(a).toHaveBeenCalledWith([7]);
    expect(b).not.toHaveBeenCalled();
  });

  it('unregister stops further pushes (release via null reaches no one after)', () => {
    const { result } = renderHook(useRegistry, { wrapper });
    const setter = vi.fn();
    result.current.register('Decal', 'modulate', setter);
    result.current.unregister('Decal', 'modulate', setter);
    result.current.set('Decal', 'modulate', [1, 1, 1, 0]);
    expect(setter).not.toHaveBeenCalled();
  });

  it('a stale unregister cannot drop a successor registered under the same key', () => {
    const { result } = renderHook(useRegistry, { wrapper });
    const stale = vi.fn();
    const current = vi.fn();
    result.current.register('Decal', 'size', stale);
    result.current.register('Decal', 'size', current); // remount replaces the setter
    result.current.unregister('Decal', 'size', stale); // stale cleanup must be a no-op
    result.current.set('Decal', 'size', [1, 1, 1]);
    expect(current).toHaveBeenCalledWith([1, 1, 1]);
  });
});
