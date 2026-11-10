/**
 * What this hook returns is compile-time state, so it never changes for a
 * mounted item, and a re-parse hands a `light_mode` edit to the same element
 * without a remount (`NodeDispatcher`). A shaded program kept after an Unshaded
 * edit paints a 0.5 albedo under a 0.2 CanvasModulate 255, where Godot draws 128.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { useLitItem, useSurfaceLighting } from './useCanvasItemLighting';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
  type CanvasLightList,
} from './lightPassContext';
import { placementId, type ItemPlacement, type LitItemRead } from './itemLightList';
import type { ApartLightBuffers } from './lightPassContext';
import type { CanvasItemSurface } from './normalMappedLighting';
import type { CappedItem } from './itemLightCap';
import { CanvasItemMaterialLightMode } from '../../godot/scene/canvasItemMaterial';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { canvasItemMaterial } from '../testing/canvasItemMaterial';
import { canvasColorSpaceOf, CanvasColorSpaceProvider, type CanvasColorSpace } from '../canvasColorSpace';
import { CanvasModulateContext } from '../canvasModulate';

type LightMode = EnumValue<typeof CanvasItemMaterialLightMode>;

const PLACEMENT: ItemPlacement = { lightMask: 1, z: 0, layer: 0, takenLights: null };

/** A lighting context publishing `list` at `placement`, with spied item registrars. */
function lighting(list: CanvasLightList, placement = PLACEMENT) {
  const registerItem = vi.fn((_placement: ItemPlacement, _read: LitItemRead) => () => {});
  const registerCappedItem = vi.fn((_item: CappedItem) => () => {});
  const value: CanvasLighting2D = {
    ...INERT_CANVAS_LIGHTING,
    lists: new Map([[placementId(placement), list]]),
    registerItem,
    registerCappedItem,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>
  );
  return { wrapper, registerItem, registerCappedItem };
}

function list(apart: ApartLightBuffers | null = null): CanvasLightList {
  return {
    buffer: new THREE.Texture(),
    lightOnlyBuffer: new THREE.Texture(),
    shadowTintBuffer: new THREE.Texture(),
    apart,
  };
}

/** Two lights kept apart, the second a MIX directional light. */
function apartLights(): ApartLightBuffers {
  return {
    buffer: new THREE.DataArrayTexture(),
    shadowTintBuffer: null,
    places: [new THREE.Vector3(10, 20, 50), new THREE.Vector3(0, 1, 0.5)],
    modes: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 1, -1)],
  };
}

function surface(overrides: Partial<CanvasItemSurface> = {}): CanvasItemSurface {
  return { normalMap: new THREE.Texture(), specularMap: null, specular: null, ...overrides };
}

/** The lighting of an item whose pixels are the one `surface`, as `LitCanvasItemPixels` takes it. */
function useCanvasItemLighting({
  surface = null,
  ...options
}: Parameters<typeof useLitItem>[0] & { surface?: CanvasItemSurface | null }) {
  const item = useLitItem(options);
  return { props: useSurfaceLighting(item, surface), geometryRef: item.geometryRef };
}

/** The uniform objects the hook bound, read back off the injection it returns. */
function boundUniforms({ props }: ReturnType<typeof useCanvasItemLighting>) {
  const shader = {
    vertexShader: 'void main() {\n#include <project_vertex>\n}',
    fragmentShader: 'void main() {\n#include <colorspace_fragment>\n}',
    uniforms: {} as Record<string, { value: unknown }>,
  };
  props.injection.onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader as never);
  return shader.uniforms;
}

describe('useCanvasItemLighting', () => {
  it("returns the SAME props object when an item's light_mode changes", () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: LightMode }) =>
        useCanvasItemLighting({ zFinal: 0, material: canvasItemMaterial(mode) }),
      { initialProps: { mode: CanvasItemMaterialLightMode.NORMAL as LightMode } }
    );

    const first = result.current.props;
    expect(first.injection.onBeforeCompile).toBeTypeOf('function');

    rerender({ mode: CanvasItemMaterialLightMode.UNSHADED });
    expect(result.current.props).toBe(first);

    rerender({ mode: CanvasItemMaterialLightMode.LIGHT_ONLY });
    expect(result.current.props).toBe(first);

    rerender({ mode: CanvasItemMaterialLightMode.NORMAL });
    expect(result.current.props).toBe(first);
  });

  it('publishes the light mode into the uniforms it already bound', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: EnumValue<typeof CanvasItemMaterialLightMode> | null }) =>
        useCanvasItemLighting({ zFinal: 0, material: mode === null ? null : canvasItemMaterial(mode) }),
      {
        initialProps: {
          mode: CanvasItemMaterialLightMode.NORMAL as EnumValue<typeof CanvasItemMaterialLightMode> | null,
        },
      }
    );

    // Bound once, at the item's only compile; the values move underneath.
    const mode = boundUniforms(result.current).uLightMode!;
    expect(mode.value).toBe(CanvasItemMaterialLightMode.NORMAL);

    rerender({ mode: CanvasItemMaterialLightMode.UNSHADED });
    expect(mode.value).toBe(CanvasItemMaterialLightMode.UNSHADED);

    rerender({ mode: CanvasItemMaterialLightMode.LIGHT_ONLY });
    expect(mode.value).toBe(CanvasItemMaterialLightMode.LIGHT_ONLY);

    // No material is Godot's default light mode, not a fourth state.
    rerender({ mode: null });
    expect(mode.value).toBe(CanvasItemMaterialLightMode.NORMAL);
  });
});

describe('useCanvasItemLighting in a linear canvas', () => {
  const NIGHT = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

  function boundIn(space: CanvasColorSpace) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasColorSpaceProvider value={space}>
        <CanvasModulateContext.Provider value={NIGHT}>{children}</CanvasModulateContext.Provider>
      </CanvasColorSpaceProvider>
    );
    const { result } = renderHook(() => useCanvasItemLighting({ zFinal: 0, material: null }), { wrapper });
    return {
      tint: (boundUniforms(result.current).uCanvasModulate!.value as THREE.Vector3).x,
      programKey: result.current.props.injection.cacheKey,
    };
  }

  it('divides the tint out in linear, and compiles the linear program variant', () => {
    const { tint, programKey } = boundIn(canvasColorSpaceOf(true));
    expect(tint).toBeCloseTo(0.214, 3);
    expect(programKey).toBe('godot-canvas-light-linear');
  });

  it('keeps the authored tint in an sRGB canvas, which decodes the fragment to compare', () => {
    const { tint, programKey } = boundIn(canvasColorSpaceOf(false));
    expect(tint).toBe(0.5);
    expect(programKey).toBe('godot-canvas-light');
  });
});

describe('useCanvasItemLighting reads its light list', () => {
  it('declares its placement and light mode to the pass', () => {
    const { wrapper, registerItem } = lighting(list());
    renderHook(
      () =>
        useCanvasItemLighting({
          zFinal: 0,
          material: canvasItemMaterial(CanvasItemMaterialLightMode.LIGHT_ONLY),
          lightMask: 1,
        }),
      { wrapper }
    );
    expect(registerItem).toHaveBeenCalledWith(PLACEMENT, 'lightOnly');
  });

  it('binds the buffer of the list at its placement, and is lit', () => {
    const published = list();
    const { wrapper } = lighting(published);
    const { result } = renderHook(() => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1 }), {
      wrapper,
    });
    const bound = boundUniforms(result.current);
    expect(bound.uLightList!.value).toBe(published.buffer);
    expect(bound.uShadowTint!.value).toBe(published.shadowTintBuffer);
    expect(bound.uLit!.value).toBe(1);
  });

  it('binds the unmodulated buffer for a Light Only item', () => {
    const published = list();
    const { wrapper } = lighting(published);
    const { result } = renderHook(
      () =>
        useCanvasItemLighting({
          zFinal: 0,
          material: canvasItemMaterial(CanvasItemMaterialLightMode.LIGHT_ONLY),
          lightMask: 1,
        }),
      {
        wrapper,
      }
    );
    expect(boundUniforms(result.current).uLightList!.value).toBe(published.lightOnlyBuffer);
  });

  it('stays unlit at a placement no light reaches', () => {
    const published = list();
    const { wrapper } = lighting(published);
    const { result } = renderHook(() => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 2 }), {
      wrapper,
    });
    const bound = boundUniforms(result.current);
    expect(bound.uLit!.value).toBe(0);
    expect(bound.uLightList!.value).not.toBe(published.buffer);
  });

  it('stays unlit while the pass draws no ordinary buffer for its list', () => {
    const { wrapper } = lighting({ ...list(), buffer: null });
    const { result } = renderHook(() => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1 }), {
      wrapper,
    });
    expect(boundUniforms(result.current).uLit!.value).toBe(0);
  });
});

describe('useCanvasItemLighting with a normal map', () => {
  it('declares a normal-mapped item, which reads each light apart', () => {
    const { wrapper, registerItem } = lighting(list());
    renderHook(() => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1, surface: surface() }), {
      wrapper,
    });
    expect(registerItem).toHaveBeenCalledWith(PLACEMENT, 'apart');
  });

  it('declares an unshaded normal-mapped item as ordinary, as it reads no light', () => {
    const { wrapper, registerItem } = lighting(list(apartLights()));
    renderHook(
      () =>
        useCanvasItemLighting({
          zFinal: 0,
          material: canvasItemMaterial(CanvasItemMaterialLightMode.UNSHADED),
          lightMask: 1,
          surface: surface(),
        }),
      { wrapper }
    );
    expect(registerItem).toHaveBeenCalledWith(PLACEMENT, 'plain');
  });

  it('shades the lights its list keeps apart, with its own maps', () => {
    const apart = apartLights();
    const maps = surface();
    const { wrapper } = lighting(list(apart));
    const { result } = renderHook(
      () => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1, surface: maps }),
      { wrapper }
    );
    const bound = boundUniforms(result.current);
    expect(bound.uLightLayers!.value).toBe(apart.buffer);
    expect(bound.uLightPlaces!.value).toBe(apart.places);
    expect(bound.uLightModes!.value).toBe(apart.modes);
    expect(bound.uNormalMap!.value).toBe(maps.normalMap);
  });

  it('keeps the ordinary program while its list keeps no light apart', () => {
    const { wrapper } = lighting(list());
    const { result } = renderHook(
      () => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1, surface: surface() }),
      { wrapper }
    );
    expect(boundUniforms(result.current).uLightList).toBeDefined();
  });

  it("samples Godot's white specular map while the CanvasTexture names none", () => {
    const { wrapper } = lighting(list(apartLights()));
    const maps = surface({ specular: { r: 1, g: 0.5, b: 0, a: 0.5 } });
    const { result } = renderHook(
      () => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1, surface: maps }),
      { wrapper }
    );
    const bound = boundUniforms(result.current);
    const white = (bound.uSpecularMap!.value as THREE.DataTexture).image.data;
    expect([...white!]).toEqual([255, 255, 255, 255]);
    expect((bound.uSpecular!.value as THREE.Vector4).toArray()).toEqual([1, 0.5, 0, 0.5]);
    expect(bound.uUsesSpecular!.value).toBe(1);
  });

  it('leaves specular off while the shininess leaves it off', () => {
    const { wrapper } = lighting(list(apartLights()));
    const { result } = renderHook(
      () => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1, surface: surface() }),
      { wrapper }
    );
    expect(boundUniforms(result.current).uUsesSpecular!.value).toBe(0);
  });
});

describe('useCanvasItemLighting under the per-item cap', () => {
  /** Mounts an item and returns the entry it handed the cap. */
  function mountCapped(published: CanvasLightList, placement: ItemPlacement) {
    const { wrapper, registerItem, registerCappedItem } = lighting(published, placement);
    const hook = renderHook(() => useCanvasItemLighting({ zFinal: 0, material: null, lightMask: 1 }), {
      wrapper,
    });
    const capped = registerCappedItem.mock.calls.at(-1)![0];
    return { ...hook, capped, registerItem };
  }

  it('hands the cap its uncapped placement and its geometry ref', () => {
    const { result, capped } = mountCapped(list(), PLACEMENT);
    expect(capped.placement).toEqual(PLACEMENT);
    expect(capped.geometry).toBe(result.current.geometryRef);
  });

  it('declares the light list the cap hands it', () => {
    const { capped, registerItem } = mountCapped(list(), PLACEMENT);
    act(() => capped.take([0, 2]));
    expect(registerItem).toHaveBeenLastCalledWith({ ...PLACEMENT, takenLights: [0, 2] }, 'plain');
  });

  it('drops the light list it was handed when its placement changes', () => {
    const { wrapper, registerItem, registerCappedItem } = lighting(list());
    const hook = renderHook(
      ({ lightMask }) => useCanvasItemLighting({ zFinal: 0, material: null, lightMask }),
      {
        wrapper,
        initialProps: { lightMask: 1 },
      }
    );
    act(() => registerCappedItem.mock.calls.at(-1)![0].take([0, 2]));
    hook.rerender({ lightMask: 2 });
    expect(registerItem).toHaveBeenLastCalledWith({ ...PLACEMENT, lightMask: 2, takenLights: null }, 'plain');
  });

  it('binds the buffer of the list its capped placement reads', () => {
    const published = list();
    const { result, capped } = mountCapped(published, { ...PLACEMENT, takenLights: [1] });
    expect(boundUniforms(result.current).uLit!.value).toBe(0);
    act(() => capped.take([1]));
    expect(boundUniforms(result.current).uLightList!.value).toBe(published.buffer);
  });
});
