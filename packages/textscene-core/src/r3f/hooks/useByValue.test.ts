import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useByValue } from './useByValue';

const sameSum = (a: number[], b: number[]) => a[0]! + a[1]! === b[0]! + b[1]!;

describe('useByValue', () => {
  it('keeps the value of an earlier render while `isSame` holds', () => {
    const first = [1, 2];
    const { result, rerender } = renderHook(({ value }) => useByValue(value, sameSum), {
      initialProps: { value: first },
    });

    rerender({ value: [2, 1] });

    expect(result.current).toBe(first);
  });

  it('answers the new value once `isSame` fails', () => {
    const { result, rerender } = renderHook(({ value }) => useByValue(value, sameSum), {
      initialProps: { value: [1, 2] },
    });
    const changed = [1, 5];

    rerender({ value: changed });

    expect(result.current).toBe(changed);
  });

  it('compares a value once, not again on each render that passes it', () => {
    const isSame = vi.fn(sameSum);
    const { rerender } = renderHook(({ value }) => useByValue(value, isSame), {
      initialProps: { value: [1, 2] },
    });
    const equal = [2, 1];

    rerender({ value: equal });
    rerender({ value: equal });

    expect(isSame).toHaveBeenCalledTimes(1);
  });
});
