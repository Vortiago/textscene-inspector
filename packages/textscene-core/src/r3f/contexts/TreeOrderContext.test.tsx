import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { childOrders, compareTreeOrder, TreeOrderProvider, useTreeOrder } from './TreeOrderContext';

describe('useTreeOrder', () => {
  it('returns the provided order inside a provider', () => {
    const { result } = renderHook(() => useTreeOrder(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TreeOrderProvider order={[0, 2]}>{children}</TreeOrderProvider>
      ),
    });
    expect(result.current).toEqual([0, 2]);
  });

  it('places a node outside every provider at the scene root (edge case)', () => {
    const { result } = renderHook(() => useTreeOrder());
    expect(result.current).toEqual([]);
  });
});

describe('childOrders', () => {
  it('gives each child its index below the parent', () => {
    expect(childOrders([1], 3)).toEqual([
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
  });

  it('gives a leaf no orders (edge case)', () => {
    expect(childOrders([1], 0)).toEqual([]);
  });
});

describe('compareTreeOrder', () => {
  it('puts an earlier sibling first', () => {
    expect(compareTreeOrder([0, 1, 5], [0, 2])).toBeLessThan(0);
  });

  it('puts an ancestor before its descendants', () => {
    expect(compareTreeOrder([0, 1], [0, 1, 0])).toBeLessThan(0);
  });

  it('ties one place with itself (edge case)', () => {
    expect(compareTreeOrder([0, 1], [0, 1])).toBe(0);
  });
});
