import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { decalAtlasRect, updateDecalAtlas } from '../../nodes/3d/decal/decalAtlas';
import type { CanvasLightView } from '../canvasShader/canvasFrameLights';
import type { DirectionalLightTerm, LightTerm, PointLightTerm } from './CanvasLight2D';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING, type CanvasLighting2D } from './lightPassContext';
import { useLightRow, type LightRowWriter } from './lightRows';

const SHADOW = {
  enabled: false,
  itemCullMask: 1,
  color: { r: 0, g: 0, b: 0, a: 0 },
  filter: 0,
  filterSmooth: 0,
} as const;

const BASE = {
  color: { r: 1, g: 0.5, b: 0.25, a: 1 },
  energy: 2,
  blendMode: 0,
  height: 0,
  shadow: SHADOW,
} as const;

const cookie = () => new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);

const pointTerm = (texture = cookie()): PointLightTerm => ({
  ...BASE,
  kind: 'point',
  cookie: texture,
  textureScale: 1,
  offset: { x: 0, y: 0 },
  itemCullMask: 1,
  zMin: -4096,
  zMax: 4096,
  layerMin: 0,
  layerMax: 0,
});

const directionalTerm = (energy = 2): DirectionalLightTerm => ({
  ...BASE,
  energy,
  kind: 'directional',
  maxDistance: 10000,
  layerMin: 0,
  layerMax: 0,
});

const VIEW: CanvasLightView = {
  camera: new THREE.OrthographicCamera(-32, 32, 16, -16),
  size: { width: 64, height: 32 },
  viewport: undefined,
  canvasTransform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
};

function spyRows() {
  const unregister = vi.fn();
  const registerLightRow = vi.fn((_ordinal: number, _writer: LightRowWriter) => unregister);
  const value: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, registerLightRow };
  const Wrap = ({ children }: { children: ReactNode }) => (
    <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>
  );
  return { Wrap, registerLightRow, unregister };
}

function mountRow(ordinal: number | null, term: LightTerm) {
  const spies = spyRows();
  const hook = renderHook(({ term: current }) => useLightRow(ordinal, current), {
    wrapper: spies.Wrap,
    initialProps: { term },
  });
  return { ...spies, ...hook };
}

describe('useLightRow', () => {
  it('registers no row before its origin mounts', () => {
    const { registerLightRow } = mountRow(2, directionalTerm());
    expect(registerLightRow).not.toHaveBeenCalled();
  });

  it("registers the light's row under its ordinal once its origin mounts", () => {
    const { result, registerLightRow } = mountRow(2, directionalTerm());
    act(() => result.current(new THREE.Object3D()));
    expect(registerLightRow.mock.calls.map(([ordinal]) => ordinal)).toEqual([2]);
  });

  it('registers no row for a light the canvas has not declared', () => {
    const { result, registerLightRow } = mountRow(null, directionalTerm());
    act(() => result.current(new THREE.Object3D()));
    expect(registerLightRow).not.toHaveBeenCalled();
  });

  it('withdraws the row when its origin unmounts', () => {
    const { result, unregister } = mountRow(2, directionalTerm());
    act(() => result.current(new THREE.Object3D()));
    act(() => result.current(null));
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('writes the last term it was given, with no new registration', () => {
    const { result, rerender, registerLightRow } = mountRow(2, directionalTerm(2));
    act(() => result.current(new THREE.Object3D()));
    rerender({ term: directionalTerm(3) });
    const writer = registerLightRow.mock.calls[0]![1];
    expect([registerLightRow.mock.calls.length, writer(VIEW).color.a]).toEqual([1, 3]);
  });

  it("holds a point light's texture in the light atlas while it lights", () => {
    const texture = cookie();
    const { unmount } = mountRow(2, pointTerm(texture));
    updateDecalAtlas(16384);
    const held = decalAtlasRect(texture) !== undefined;
    unmount();
    expect([held, decalAtlasRect(texture)]).toEqual([true, undefined]);
  });
});
