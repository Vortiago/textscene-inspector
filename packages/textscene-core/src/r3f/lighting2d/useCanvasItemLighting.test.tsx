/**
 * What this hook returns is compile-time state, so it never changes for a
 * mounted item, and a re-parse hands a `light_mode` edit to the same element
 * without a remount (`NodeDispatcher`). A shaded program kept after an Unshaded
 * edit paints a 0.5 albedo under a 0.2 CanvasModulate 255, where Godot draws 128.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
  CanvasItemBlendMode,
} from '../../resources/materials/canvasitemmaterial/types';
import { useCanvasItemLighting } from './useCanvasItemLighting';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
  type CanvasLightList,
} from './lightPassContext';
import { placementId } from './itemLightList';

/** A lighting context publishing `list` at the default placement, with a spied item registrar. */
function lighting(list: CanvasLightList) {
  const registerItem = vi.fn(() => () => {});
  const value: CanvasLighting2D = {
    ...INERT_CANVAS_LIGHTING,
    lists: new Map([[placementId({ lightMask: 1, z: 0, layer: 0 }), list]]),
    registerItem,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>
  );
  return { wrapper, registerItem };
}

function list(): CanvasLightList {
  return {
    buffer: new THREE.Texture(),
    lightOnlyBuffer: new THREE.Texture(),
    shadowTintBuffer: new THREE.Texture(),
  };
}

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
  it("returns the SAME props object when an item's light_mode changes", () => {
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

describe('useCanvasItemLighting reads its light list', () => {
  it('declares its placement and light mode to the pass', () => {
    const { wrapper, registerItem } = lighting(list());
    renderHook(() => useCanvasItemLighting(material(CanvasItemLightMode.LIGHT_ONLY), 1), { wrapper });
    expect(registerItem).toHaveBeenCalledWith({ lightMask: 1, z: 0, layer: 0 }, true);
  });

  it('binds the buffer of the list at its placement, and is lit', () => {
    const published = list();
    const { wrapper } = lighting(published);
    const { result } = renderHook(() => useCanvasItemLighting(null, 1), { wrapper });
    const bound = boundUniforms(result.current);
    expect(bound.uLightList!.value).toBe(published.buffer);
    expect(bound.uShadowTint!.value).toBe(published.shadowTintBuffer);
    expect(bound.uLit!.value).toBe(1);
  });

  it('binds the unmodulated buffer for a Light Only item', () => {
    const published = list();
    const { wrapper } = lighting(published);
    const { result } = renderHook(() => useCanvasItemLighting(material(CanvasItemLightMode.LIGHT_ONLY), 1), {
      wrapper,
    });
    expect(boundUniforms(result.current).uLightList!.value).toBe(published.lightOnlyBuffer);
  });

  it('stays unlit at a placement no light reaches', () => {
    const published = list();
    const { wrapper } = lighting(published);
    const { result } = renderHook(() => useCanvasItemLighting(null, 2), { wrapper });
    const bound = boundUniforms(result.current);
    expect(bound.uLit!.value).toBe(0);
    expect(bound.uLightList!.value).not.toBe(published.buffer);
  });
});
