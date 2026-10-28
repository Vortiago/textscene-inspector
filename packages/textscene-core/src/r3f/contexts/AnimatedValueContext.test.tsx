/**
 * The AnimatedValue push registry (ADR-0016, ADR-0017) keys by node path and property. The store
 * itself is tested in `pushStore.test.tsx`, and the driver tests cover the end-to-end push.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AnimatedValueProvider, animatedValueKey, useAnimatedValueRegistry } from './AnimatedValueContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AnimatedValueProvider>{children}</AnimatedValueProvider>
);

describe('AnimatedValueContext', () => {
  it('is a no-op outside a provider (push reaches no one, never throws)', () => {
    const { result } = renderHook(useAnimatedValueRegistry);

    expect(() => result.current.set(animatedValueKey('Path', 'frame'), [1])).not.toThrow();
  });

  it('keys by path AND property: one node animating two properties is independent', () => {
    const { result } = renderHook(useAnimatedValueRegistry, { wrapper });
    const modulate = vi.fn();
    const size = vi.fn();
    result.current.subscribe(animatedValueKey('Decal', 'modulate'), modulate);
    result.current.subscribe(animatedValueKey('Decal', 'size'), size);

    result.current.set(animatedValueKey('Decal', 'modulate'), [1, 0, 0, 0.5]);

    expect(modulate).toHaveBeenCalledWith([1, 0, 0, 0.5]);
    expect(size).not.toHaveBeenCalled();
  });

  it('does not cross-talk between different node paths', () => {
    const { result } = renderHook(useAnimatedValueRegistry, { wrapper });
    const a = vi.fn();
    const b = vi.fn();
    result.current.subscribe(animatedValueKey('A', 'frame'), a);
    result.current.subscribe(animatedValueKey('B', 'frame'), b);

    result.current.set(animatedValueKey('A', 'frame'), [7]);

    expect(a).toHaveBeenCalledWith([7]);
    expect(b).not.toHaveBeenCalled();
  });
});
