/** `useStableVector2`: one object while the numbers stay, a new one when either changes. */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableVector2 } from './useStableVector2';

describe('useStableVector2', () => {
  it('keeps the same object for equal numbers', () => {
    const { result, rerender } = renderHook(({ v }) => useStableVector2(v), {
      initialProps: { v: { x: 2, y: 3 } },
    });
    const first = result.current;
    rerender({ v: { x: 2, y: 3 } });
    expect(result.current).toBe(first);
  });

  it('gives a new object when a number changes', () => {
    const { result, rerender } = renderHook(({ v }) => useStableVector2(v), {
      initialProps: { v: { x: 2, y: 3 } },
    });
    const first = result.current;
    rerender({ v: { x: 2, y: 4 } });
    expect(result.current).not.toBe(first);
    expect(result.current).toEqual({ x: 2, y: 4 });
  });
});
