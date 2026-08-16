/**
 * What this hook returns is compile-time state, so it must never change for an
 * item that stays mounted — and a `light_mode` edit is an ordinary prop update:
 * a re-parse hands the same-keyed element a fresh `properties` bag without
 * remounting it (`NodeDispatcher`).
 *
 * Measured in real WebGL: an item compiled while shaded, then edited to
 * Unshaded, kept the light program and painted a 0.5 albedo under a 0.2
 * CanvasModulate as 255,255,255 where Godot draws 128,128,128.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
  CanvasItemBlendMode,
} from '../../resources/materials/canvasitemmaterial/types';
import { useCanvasItemLighting } from './useCanvasItemLighting';

function material(lightMode: CanvasItemLightMode): CanvasItemMaterialProperties {
  return {
    blendMode: CanvasItemBlendMode.MIX,
    lightMode,
    particlesAnimation: false,
    particlesAnimHFrames: 1,
    particlesAnimVFrames: 1,
    particlesAnimLoop: false,
  };
}

/** The uniform objects the hook bound, read back off the injection it returns. */
function boundUniforms(props: ReturnType<typeof useCanvasItemLighting>) {
  const shader = {
    vertexShader: '',
    fragmentShader: 'void main() {\n#include <colorspace_fragment>\n}',
    uniforms: {} as Record<string, { value: unknown }>,
  };
  props.onBeforeCompile?.(shader as never);
  return shader.uniforms;
}

describe('useCanvasItemLighting', () => {
  it('returns the SAME props object when an item\'s light_mode changes', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: CanvasItemLightMode }) => useCanvasItemLighting(material(mode)),
      { initialProps: { mode: CanvasItemLightMode.NORMAL } }
    );

    const first = result.current;
    expect(first.onBeforeCompile).toBeTypeOf('function');

    rerender({ mode: CanvasItemLightMode.UNSHADED });
    expect(result.current).toBe(first);

    rerender({ mode: CanvasItemLightMode.LIGHT_ONLY });
    expect(result.current).toBe(first);

    rerender({ mode: CanvasItemLightMode.NORMAL });
    expect(result.current).toBe(first);
  });

  it('publishes the light mode into the uniforms it already bound', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: CanvasItemLightMode | null }) =>
        useCanvasItemLighting(mode === null ? null : material(mode)),
      { initialProps: { mode: CanvasItemLightMode.NORMAL as CanvasItemLightMode | null } }
    );

    // Bound once, at the item's only compile; the values move underneath.
    const bound = boundUniforms(result.current);
    const unshaded = bound.uUnshaded!;
    const lightOnly = bound.uLightOnly!;
    expect(unshaded.value).toBe(0);
    expect(lightOnly.value).toBe(0);

    rerender({ mode: CanvasItemLightMode.UNSHADED });
    expect(unshaded.value).toBe(1);
    expect(lightOnly.value).toBe(0);

    rerender({ mode: CanvasItemLightMode.LIGHT_ONLY });
    expect(unshaded.value).toBe(0);
    expect(lightOnly.value).toBe(1);

    // No material is Godot's default light mode, not a fourth state.
    rerender({ mode: null });
    expect(unshaded.value).toBe(0);
    expect(lightOnly.value).toBe(0);
  });
});
