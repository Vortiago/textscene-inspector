/**
 * Pins the adaptation of a Control's `modulate` and `self_modulate` onto the 2D
 * CanvasItem tint chain, and the split: one hook sees only `modulate`, the other
 * only `self_modulate`. `canvasItemModulate.test.ts` covers the chain's math.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { Modulate2DContext } from '../../canvasItemModulate';
import { useControlOwnTint, useInheritedModulate } from './controlTint';
import type { SolveNode } from './solveTree';
import { solveNode } from './testing/solveNode';

function control(properties: Record<string, unknown>): SolveNode {
  const node: TscnNode = { name: 'C', type: 'Control', children: [], properties };
  return { ...solveNode(), path: 'C', node };
}

function ambient(value: { r: number; g: number; b: number; a: number }) {
  return ({ children }: { children: ReactNode }) => (
    <Modulate2DContext.Provider value={value}>{children}</Modulate2DContext.Provider>
  );
}

describe('useInheritedModulate', () => {
  it('defaults to opaque white when modulate is unset', () => {
    const { result } = renderHook(() => useInheritedModulate(undefined, undefined));
    expect(result.current).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("multiplies the ancestor's inherited value by this node's own modulate", () => {
    const { result } = renderHook(() => useInheritedModulate({ r: 1, g: 1, b: 1, a: 0.5 }, undefined), {
      wrapper: ambient({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 }),
    });
    expect(result.current.r).toBeCloseTo(0.5, 5);
    expect(result.current.a).toBeCloseTo(0.25, 5);
  });

  it("folds the skipped Node2D ancestors' modulate BETWEEN the ambient and this node's own", () => {
    // Three distinct halves, so a fold that drops one or squares another
    // cannot land on the same number: 0.5 × 0.5 × 0.5.
    const { result } = renderHook(
      () => useInheritedModulate({ r: 0.5, g: 1, b: 1, a: 1 }, { r: 0.5, g: 1, b: 1, a: 1 }),
      { wrapper: ambient({ r: 0.5, g: 1, b: 1, a: 1 }) }
    );
    expect(result.current.r).toBeCloseTo(0.125, 5);
  });
});

describe('useControlOwnTint', () => {
  const OPAQUE_WHITE = { r: 1, g: 1, b: 1, a: 1 };

  it('defaults to opaque white when self_modulate is unset', () => {
    const { result } = renderHook(() => useControlOwnTint(OPAQUE_WHITE, control({})));
    expect(result.current.own).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(result.current.opacity).toBe(1);
  });

  it('multiplies the inherited value it is GIVEN by self_modulate — never squaring the node’s own modulate', () => {
    const node = control({
      modulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
      selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
    });
    // The argument stands for `useInheritedModulate`'s result, which already
    // carries this node's `modulate`; reading it a second time would give 0.125.
    const { result } = renderHook(() =>
      useControlOwnTint({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 }, node)
    );
    expect(result.current.own.r).toBeCloseTo(0.25, 5);
    expect(result.current.opacity).toBeCloseTo(0.25, 5);
  });

  it('ignores the ambient context entirely — the walker states the inherited value', () => {
    const node = control({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } });
    const { result } = renderHook(() => useControlOwnTint(OPAQUE_WHITE, node), {
      wrapper: ambient({ r: 0.5, g: 0.5, b: 0.5, a: 1 }),
    });
    expect(result.current.own.r).toBeCloseTo(0.5, 5);
  });

  it('converts the sRGB product to linear exactly once', () => {
    const node = control({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } });
    const { result } = renderHook(() => useControlOwnTint(OPAQUE_WHITE, node));
    const expected = new THREE.Color().setRGB(0.5, 0.5, 0.5, THREE.SRGBColorSpace);
    expect(result.current.color.r).toBeCloseTo(expected.r, 6);
  });
});
