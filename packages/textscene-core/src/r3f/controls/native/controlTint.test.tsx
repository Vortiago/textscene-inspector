/**
 * `controlTint.ts` adapts a Control's `modulate`/`self_modulate`
 * (`ControlColor`, plain 0..1 channels) onto the existing 2D CanvasItem tint
 * chain (`useCanvasItemTint`/`Modulate2DContext`), the same one Sprite2D and
 * every other CanvasItem already uses — composing in sRGB and converting to
 * linear ONCE, per that module's own rule. These tests pin the adaptation and
 * the SPLIT (the walker's hook sees only `modulate`, a painter's only
 * `self_modulate`), not the underlying chain's math (already covered by
 * `canvasItemModulate.test.ts`).
 */
import { describe, expect, it } from 'vitest';
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
    const { result } = renderHook(() => useInheritedModulate(undefined));
    expect(result.current).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("multiplies the ancestor's inherited value by this node's own modulate", () => {
    const { result } = renderHook(() => useInheritedModulate({ r: 1, g: 1, b: 1, a: 0.5 }), {
      wrapper: ambient({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 }),
    });
    expect(result.current.r).toBeCloseTo(0.5, 5);
    expect(result.current.a).toBeCloseTo(0.25, 5);
  });
});

describe('useControlOwnTint', () => {
  it('defaults to opaque white when self_modulate is unset', () => {
    const { result } = renderHook(() => useControlOwnTint(control({})));
    expect(result.current.own).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(result.current.opacity).toBe(1);
  });

  it('multiplies the ambient inherited tint by self_modulate — never squaring the node’s own modulate', () => {
    const node = control({
      modulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
      selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
    });
    const { result } = renderHook(() => useControlOwnTint(node), {
      wrapper: ambient({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 }),
    });
    // ambient(0.5) × self_modulate(0.5) = 0.25 — the node's own `modulate`,
    // already folded into the ambient by the walker, is NOT read here.
    expect(result.current.own.r).toBeCloseTo(0.25, 5);
    expect(result.current.opacity).toBeCloseTo(0.25, 5);
  });

  it('folds ownMultiplier in for a single-colour widget, in sRGB, before the one linear conversion', () => {
    const node = control({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } });
    const { result } = renderHook(() =>
      useControlOwnTint(node, { r: 0.5, g: 0.5, b: 0.5, a: 1 })
    );
    expect(result.current.own.r).toBeCloseTo(0.25, 5);
  });
});
