import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { decalAtlasRect, updateDecalAtlas } from '../../nodes/3d/decal/decalAtlas';
import type { CanvasLightView } from '../canvasShader/canvasFrameLights';
import type { DirectionalLightTerm, LightTerm, PointLightTerm } from './CanvasLight2D';
import { useLightRowSource, type OwnedLightRow } from './lightRows';

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

function ownedRow(term: LightTerm): OwnedLightRow {
  return renderHook(() => useLightRowSource(term)).result.current;
}

function mountedRow(term: LightTerm, at = new THREE.Vector3()): OwnedLightRow {
  const source = ownedRow(term);
  const origin = new THREE.Object3D();
  origin.position.copy(at);
  origin.updateMatrixWorld();
  source.setOrigin(origin);
  return source;
}

describe('the row of a light term', () => {
  it('lists no row before its origin mounts', () => {
    expect(ownedRow(directionalTerm()).listedRow(VIEW)).toBeNull();
  });

  it("lists the light's row once its origin mounts", () => {
    expect(mountedRow(directionalTerm(3)).listedRow(VIEW)?.color.a).toBe(3);
  });

  it('hands the same row while nothing it reads moved', () => {
    const source = mountedRow(pointTerm());
    expect(source.listedRow(VIEW)).toBe(source.listedRow(VIEW));
  });

  it('builds the row again from a new term', () => {
    const source = mountedRow(directionalTerm(2));
    source.listedRow(VIEW);
    source.term = directionalTerm(3);
    expect(source.listedRow(VIEW)?.color.a).toBe(3);
  });

  it('builds the row again once the light moves', () => {
    const origin = new THREE.Object3D();
    const source = ownedRow(pointTerm());
    source.setOrigin(origin);
    const first = source.listedRow(VIEW);
    origin.position.x = 4;
    origin.updateMatrixWorld();
    expect(source.listedRow(VIEW)).not.toBe(first);
  });

  it('lists no row for a point light whose texture rect misses the viewport, as Godot culls it', () => {
    expect(mountedRow(pointTerm(), new THREE.Vector3(1000, 0, 0)).listedRow(VIEW)).toBeNull();
  });

  it('lists a directional light wherever its node is', () => {
    expect(mountedRow(directionalTerm(), new THREE.Vector3(1000, 0, 0)).listedRow(VIEW)).not.toBeNull();
  });
});

describe('useLightRowSource', () => {
  it('keeps one source for the light, holding the last term', () => {
    const { result, rerender } = renderHook(({ term }) => useLightRowSource(term), {
      initialProps: { term: directionalTerm(2) },
    });
    const first = result.current;
    const next = directionalTerm(3);
    rerender({ term: next });
    expect([result.current === first, result.current.term]).toEqual([true, next]);
  });

  it("holds a point light's texture in the light atlas while it lights", () => {
    const texture = cookie();
    const { unmount } = renderHook(() => useLightRowSource(pointTerm(texture)));
    updateDecalAtlas(16384);
    const held = decalAtlasRect(texture) !== undefined;
    unmount();
    expect([held, decalAtlasRect(texture)]).toEqual([true, undefined]);
  });
});
