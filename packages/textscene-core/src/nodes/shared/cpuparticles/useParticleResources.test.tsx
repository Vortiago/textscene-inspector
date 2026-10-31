import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useParticleResources } from './useParticleResources';

const NO_PARAMS: never[] = [];

describe('useParticleResources', () => {
  it('keeps its result across renders that build an equal scaleCurves object', () => {
    const { result, rerender } = renderHook(() =>
      useParticleResources({
        params: NO_PARAMS,
        colorRamp: undefined,
        colorInitialRamp: undefined,
        scaleCurves: { x: 'SubResource("a")', y: undefined },
      })
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
