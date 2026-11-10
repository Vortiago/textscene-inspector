import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderHook } from '@testing-library/react';
import {
  foldOwnPixelTint,
  multiplyModulate,
  OwnCanvasModulateProvider,
  useItemLinearColor,
  useVertexColorTint,
  WHITE_MODULATE,
} from './canvasItemModulate';
import { canvasColorSpaceOf, CanvasColorSpaceProvider } from './canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

describe('multiplyModulate', () => {
  it('multiplies RGBA component-wise', () => {
    expect(multiplyModulate({ r: 1, g: 1, b: 1, a: 1 }, { r: 0, g: 1, b: 1, a: 1 })).toEqual({
      r: 0,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('treats white as the identity', () => {
    const c = { r: 0.5, g: 0.2, b: 0.8, a: 0.5 };
    expect(multiplyModulate(WHITE_MODULATE, c)).toEqual(c);
  });

  it('keeps a 0.9 channel on the half step 229.5 that Godot writes as 230', () => {
    expect(multiplyModulate(WHITE_MODULATE, { r: 0.9, g: 0.9, b: 0.9, a: 1 }).r).toBe(0.9);
  });

  it('composes hierarchically (a parent dims its children)', () => {
    expect(multiplyModulate({ r: 0.5, g: 0.5, b: 0.5, a: 1 }, { r: 0.5, g: 0.5, b: 0.5, a: 1 })).toEqual({
      r: 0.25,
      g: 0.25,
      b: 0.25,
      a: 1,
    });
  });

  it('multiplies alpha (transparent parent → transparent child)', () => {
    expect(multiplyModulate({ r: 1, g: 1, b: 1, a: 0.5 }, { r: 1, g: 1, b: 1, a: 0.5 }).a).toBe(0.25);
  });
});

describe('foldOwnPixelTint', () => {
  const grey = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
  const halfAlpha = { r: 0.5, g: 0.5, b: 0.5, a: 0.5 };

  it('multiplies the canvas modulate in sRGB and converts once in an sRGB canvas', () => {
    const tint = foldOwnPixelTint(grey, grey, canvasColorSpaceOf(false));
    expect(tint.own).toEqual({ r: 0.25, g: 0.25, b: 0.25, a: 1 });
    expect(tint.color.r).toBeCloseTo(0.05088, 5);
    expect(tint.canvasModulate.r).toBe(1);
  });

  it('converts the tint and the canvas modulate apart and multiplies them linear in a linear canvas', () => {
    const tint = foldOwnPixelTint(grey, grey, LINEAR_CANVAS);
    expect(tint.own).toEqual(grey);
    expect(tint.color.r).toBeCloseTo(0.04581, 5);
    expect(tint.canvasModulate.r).toBeCloseTo(0.21404, 5);
  });

  it('keeps the canvas modulate alpha in the own alpha in a linear canvas', () => {
    expect(foldOwnPixelTint(grey, halfAlpha, LINEAR_CANVAS).own.a).toBe(0.5);
  });

  it('keeps a modulate above 1 unclamped in a linear canvas (edge case)', () => {
    const hot = { r: 4, g: 4, b: 4, a: 1 };
    expect(foldOwnPixelTint(hot, WHITE_MODULATE, LINEAR_CANVAS).color.r).toBeCloseTo(25.31, 2);
  });
});

describe('useItemLinearColor', () => {
  const grey = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
  const linearGrey = foldOwnPixelTint(WHITE_MODULATE, grey, LINEAR_CANVAS).canvasModulate;

  it('converts an sRGB colour of the item to linear outside a linear canvas', () => {
    const { result } = renderHook(() => useItemLinearColor(grey));
    expect(result.current.r).toBeCloseTo(0.21404, 5);
  });

  it("multiplies the item's linear canvas modulate after the conversion", () => {
    const { result } = renderHook(() => useItemLinearColor(grey), {
      wrapper: ({ children }) => createElement(OwnCanvasModulateProvider, { value: linearGrey }, children),
    });
    expect(result.current.r).toBeCloseTo(0.04581, 5);
  });
});

describe('useVertexColorTint', () => {
  const grey = { r: 0.5, g: 0.5, b: 0.5, a: 0.5 };

  it('puts the tint into the vertex colours in an sRGB canvas, which decodes the product once', () => {
    const { result } = renderHook(() => useVertexColorTint(grey));
    expect(result.current.vertex).toEqual(grey);
    expect(result.current.color.r).toBe(1);
    expect(result.current.opacity).toBe(1);
    expect(result.current.defines).toBe(canvasColorSpaceOf(false).defines);
  });

  it('puts the converted tint on the material in a linear canvas, which decodes each vertex colour apart', () => {
    const { result } = renderHook(() => useVertexColorTint(grey), {
      wrapper: ({ children }) => createElement(CanvasColorSpaceProvider, { value: LINEAR_CANVAS }, children),
    });
    expect(result.current.vertex).toEqual(WHITE_MODULATE);
    expect(result.current.color.r).toBeCloseTo(0.21404, 5);
    expect(result.current.opacity).toBe(0.5);
    expect(result.current.defines).toBe(LINEAR_CANVAS.defines);
  });
});
