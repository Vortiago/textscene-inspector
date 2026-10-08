/**
 * The declarations a light, an item and a light mesh make to the pass. A light rebuilds its
 * declaration object each render, and re-declaring would hand it a new ordinal, its stencil ref
 * with it, so each declaration holds while its values hold.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { render, renderHook } from '@testing-library/react';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
  type CanvasLightSlot,
} from './lightPassContext';
import { DEFAULT_LIGHT_CULL_KEY } from './lightCullKey';
import type { CanvasLightDeclaration, ItemPlacement, PassMeshRole } from './itemLightList';
import {
  useCapItemLights,
  usePassMeshRef,
  useRegisterCanvasLight2D,
  useRegisterLitItem,
} from './lightPassDeclarations';
import type { CappedItem } from './itemLightCap';
import { LIGHT_PASS_LAYER } from './lightPassLayers';

/** A lighting context whose registrars are spies. */
function spyLighting() {
  const release = vi.fn();
  const releaseItem = vi.fn();
  const releaseMesh = vi.fn();
  const slot: CanvasLightSlot = { ordinal: 3, release };
  const registerLight = vi.fn((_declaration: CanvasLightDeclaration) => slot);
  const registerItem = vi.fn((_placement: ItemPlacement, _lightOnly: boolean) => releaseItem);
  const releaseCapped = vi.fn();
  const registerCappedItem = vi.fn((_item: CappedItem) => releaseCapped);
  const registerPassMesh = vi.fn(
    (_mesh: THREE.Object3D, _ordinal: number, _role: PassMeshRole) => releaseMesh
  );
  const value: CanvasLighting2D = {
    ...INERT_CANVAS_LIGHTING,
    registerLight,
    registerItem,
    registerCappedItem,
    registerPassMesh,
  };
  const Wrap = ({ children }: { children: ReactNode }) => (
    <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>
  );
  return {
    Wrap,
    registerLight,
    release,
    registerItem,
    releaseItem,
    registerCappedItem,
    releaseCapped,
    registerPassMesh,
    releaseMesh,
  };
}

const DECLARATION: CanvasLightDeclaration = {
  reach: DEFAULT_LIGHT_CULL_KEY,
  sequence: 0,
  shadowItemCullMask: null,
  tintsShadow: false,
};

/** A light that rebuilds its declaration object each render. */
function Light({
  declaration,
  seen = [],
}: {
  declaration: CanvasLightDeclaration;
  seen?: (number | null)[];
}) {
  seen.push(useRegisterCanvasLight2D(true, { ...declaration, reach: { ...declaration.reach } }));
  return null;
}

describe('useRegisterCanvasLight2D', () => {
  it('survives a re-render that leaves every value unchanged', () => {
    const { Wrap, registerLight, release } = spyLighting();
    const { rerender } = render(<Light declaration={DECLARATION} />, { wrapper: Wrap });
    rerender(<Light declaration={{ ...DECLARATION }} />);
    expect(registerLight).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });

  it('is withdrawn and remade when its sequence changes', () => {
    const { Wrap, registerLight, release } = spyLighting();
    const { rerender } = render(<Light declaration={DECLARATION} />, { wrapper: Wrap });
    rerender(<Light declaration={{ ...DECLARATION, sequence: 4 }} />);
    expect(release).toHaveBeenCalledTimes(1);
    expect(registerLight.mock.calls[1]![0].sequence).toBe(4);
  });

  it('is withdrawn and remade when a value changes', () => {
    const { Wrap, registerLight, release } = spyLighting();
    const { rerender } = render(<Light declaration={DECLARATION} />, { wrapper: Wrap });
    const tinting = { ...DECLARATION, tintsShadow: true };
    rerender(<Light declaration={tinting} />);
    expect(release).toHaveBeenCalledTimes(1);
    expect(registerLight.mock.calls[1]![0]).toEqual(tinting);
  });

  it('gives the ordinal it was handed, and null before', () => {
    const { Wrap } = spyLighting();
    const seen: (number | null)[] = [];
    render(<Light declaration={DECLARATION} seen={seen} />, { wrapper: Wrap });
    expect([seen[0], seen.at(-1)]).toEqual([null, 3]);
  });

  it('declares nothing while disabled', () => {
    const { Wrap, registerLight } = spyLighting();
    const { result } = renderHook(() => useRegisterCanvasLight2D(false, DECLARATION), { wrapper: Wrap });
    expect(registerLight).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });
});

describe('useRegisterLitItem', () => {
  const PLACEMENT: ItemPlacement = { lightMask: 1, z: 0, layer: 0, positionalLights: null };

  it('survives a re-render at the same placement', () => {
    const { Wrap, registerItem, releaseItem } = spyLighting();
    const { rerender } = renderHook(({ placement }) => useRegisterLitItem(placement, false), {
      wrapper: Wrap,
      initialProps: { placement: PLACEMENT },
    });
    rerender({ placement: { ...PLACEMENT } });
    expect(registerItem).toHaveBeenCalledTimes(1);
    expect(releaseItem).not.toHaveBeenCalled();
  });

  it('moves when the placement changes', () => {
    const { Wrap, registerItem, releaseItem } = spyLighting();
    const { rerender } = renderHook(({ placement }) => useRegisterLitItem(placement, false), {
      wrapper: Wrap,
      initialProps: { placement: PLACEMENT },
    });
    rerender({ placement: { ...PLACEMENT, z: 2 } });
    expect(releaseItem).toHaveBeenCalledTimes(1);
    expect(registerItem.mock.calls[1]).toEqual([{ ...PLACEMENT, z: 2 }, false]);
  });

  it('moves when the cap hands it other positional lights', () => {
    const { Wrap, registerItem, releaseItem } = spyLighting();
    const { rerender } = renderHook(({ placement }) => useRegisterLitItem(placement, false), {
      wrapper: Wrap,
      initialProps: { placement: PLACEMENT },
    });
    rerender({ placement: { ...PLACEMENT, positionalLights: [0] } });
    expect(releaseItem).toHaveBeenCalledTimes(1);
    expect(registerItem.mock.calls[1]).toEqual([{ ...PLACEMENT, positionalLights: [0] }, false]);
  });
});

describe('useCapItemLights', () => {
  const PLACEMENT: ItemPlacement = { lightMask: 1, z: 0, layer: 0, positionalLights: null };
  const geometry = { current: null };
  const take = () => {};

  function mount() {
    const spies = spyLighting();
    const hook = renderHook(({ placement }) => useCapItemLights(placement, geometry, take), {
      wrapper: spies.Wrap,
      initialProps: { placement: PLACEMENT },
    });
    return { ...spies, ...hook };
  }

  it('hands the cap the uncapped placement, the geometry and the receiver', () => {
    const { registerCappedItem } = mount();
    expect(registerCappedItem).toHaveBeenCalledWith({ placement: PLACEMENT, geometry, take });
  });

  it('stays registered while the cap hands it positional lights', () => {
    const { registerCappedItem, releaseCapped, rerender } = mount();
    rerender({ placement: { ...PLACEMENT, positionalLights: [0] } });
    expect(registerCappedItem).toHaveBeenCalledTimes(1);
    expect(releaseCapped).not.toHaveBeenCalled();
  });

  it('moves when the cull placement changes', () => {
    const { registerCappedItem, releaseCapped, rerender } = mount();
    rerender({ placement: { ...PLACEMENT, z: 2 } });
    expect(releaseCapped).toHaveBeenCalledTimes(1);
    expect(registerCappedItem.mock.calls[1]![0].placement).toEqual({ ...PLACEMENT, z: 2 });
  });
});

describe('usePassMeshRef', () => {
  it('moves the mesh onto the light pass layer alone, hidden until a pass shows it', () => {
    const { Wrap } = spyLighting();
    const { result } = renderHook(() => usePassMeshRef(0, 'lit'), { wrapper: Wrap });
    const mesh = new THREE.Mesh();
    result.current(mesh);
    expect(mesh.layers.mask).toBe(1 << LIGHT_PASS_LAYER);
    expect(mesh.visible).toBe(false);
  });

  it("hands the pass the mesh with its light's ordinal and its role", () => {
    const { Wrap, registerPassMesh } = spyLighting();
    const { result } = renderHook(() => usePassMeshRef(2, 'tint'), { wrapper: Wrap });
    const mesh = new THREE.Mesh();
    result.current(mesh);
    expect(registerPassMesh).toHaveBeenCalledWith(mesh, 2, 'tint');
  });

  it('withdraws the mesh when it unmounts', () => {
    const { Wrap, releaseMesh } = spyLighting();
    const { result } = renderHook(() => usePassMeshRef(0, 'lit'), { wrapper: Wrap });
    result.current(new THREE.Mesh());
    result.current(null);
    expect(releaseMesh).toHaveBeenCalledTimes(1);
  });

  it('hands the pass nothing while the light has no ordinal', () => {
    const { Wrap, registerPassMesh } = spyLighting();
    const { result } = renderHook(() => usePassMeshRef(null, 'lit'), { wrapper: Wrap });
    const mesh = new THREE.Mesh();
    result.current(mesh);
    expect(registerPassMesh).not.toHaveBeenCalled();
    expect(mesh.visible).toBe(false);
  });

  it('passes the mesh on to its owner', () => {
    const { Wrap } = spyLighting();
    const onMesh = vi.fn();
    const { result } = renderHook(() => usePassMeshRef(0, 'lit', onMesh), { wrapper: Wrap });
    const mesh = new THREE.Mesh();
    result.current(mesh);
    expect(onMesh).toHaveBeenCalledWith(mesh);
  });
});
