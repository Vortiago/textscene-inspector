/**
 * `useControlTint` adapts a Control's `modulate`/`self_modulate`
 * (`ControlColor`, plain 0..1 channels) onto the existing 2D CanvasItem tint
 * chain (`useCanvasItemTint`/`Modulate2DContext`), the same one Sprite2D and
 * every other CanvasItem already uses — composing in sRGB and converting to
 * linear ONCE, per that module's own rule. These tests pin the adaptation
 * (absent color defaults to opaque white; a parent's inherited tint composes
 * in), not the underlying chain's math (already covered by
 * `canvasItemModulate.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Modulate2DContext } from '../../canvasItemModulate';
import { useControlTint } from './useControlTint';

describe('useControlTint', () => {
  it('defaults to opaque white when neither modulate nor selfModulate is set', () => {
    const { result } = renderHook(() => useControlTint(undefined, undefined));
    expect(result.current.opacity).toBe(1);
    expect(result.current.inherited).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('multiplies modulate and selfModulate alpha into opacity', () => {
    const { result } = renderHook(() =>
      useControlTint({ r: 1, g: 1, b: 1, a: 0.5 }, { r: 1, g: 1, b: 1, a: 0.5 })
    );
    expect(result.current.opacity).toBeCloseTo(0.25);
  });

  it('composes with an inherited parent tint from Modulate2DContext (edge: nested Controls)', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Modulate2DContext.Provider value={{ r: 1, g: 1, b: 1, a: 0.5 }}>{children}</Modulate2DContext.Provider>
    );
    const { result } = renderHook(() => useControlTint(undefined, undefined), { wrapper });
    expect(result.current.inherited.a).toBeCloseTo(0.5);
  });
});
