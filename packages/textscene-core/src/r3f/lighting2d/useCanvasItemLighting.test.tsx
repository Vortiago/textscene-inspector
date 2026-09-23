/**
 * What this hook returns is compile-time state, so it never changes for a
 * mounted item, and a re-parse hands a `light_mode` edit to the same element
 * without a remount (`NodeDispatcher`). A shaded program kept after an Unshaded
 * edit paints a 0.5 albedo under a 0.2 CanvasModulate 255, where Godot draws 128.
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
  props.injection.onBeforeCompile(shader as never);
  return shader.uniforms;
}

describe('useCanvasItemLighting', () => {
  it('returns the SAME props object when an item\'s light_mode changes', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: CanvasItemLightMode }) => useCanvasItemLighting(material(mode)),
      { initialProps: { mode: CanvasItemLightMode.NORMAL } }
    );

    const first = result.current;
    expect(first.injection.onBeforeCompile).toBeTypeOf('function');

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
    const mode = boundUniforms(result.current).uLightMode!;
    expect(mode.value).toBe(CanvasItemLightMode.NORMAL);

    rerender({ mode: CanvasItemLightMode.UNSHADED });
    expect(mode.value).toBe(CanvasItemLightMode.UNSHADED);

    rerender({ mode: CanvasItemLightMode.LIGHT_ONLY });
    expect(mode.value).toBe(CanvasItemLightMode.LIGHT_ONLY);

    // No material is Godot's default light mode, not a fourth state.
    rerender({ mode: null });
    expect(mode.value).toBe(CanvasItemLightMode.NORMAL);
  });
});
