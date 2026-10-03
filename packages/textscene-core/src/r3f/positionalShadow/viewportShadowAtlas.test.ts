import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  ROOT_POSITIONAL_SHADOW_ATLAS,
  viewportPositionalShadowAtlas,
} from '../../godot/positionalShadowAtlas';
import { activeShadowAtlas, renderWithShadowAtlas, ViewportShadowAtlas } from './viewportShadowAtlas';

const rootAtlas = () => new ViewportShadowAtlas(ROOT_POSITIONAL_SHADOW_ATLAS);
const subViewportAtlas = () => new ViewportShadowAtlas(viewportPositionalShadowAtlas(undefined, []));

/** An omni light whose shadow holds a cube of `size`, as a fit leaves it. */
function omniWithCube(size: number): { light: THREE.PointLight; map: THREE.WebGLCubeRenderTarget } {
  const light = new THREE.PointLight();
  const map = new THREE.WebGLCubeRenderTarget(size);
  light.shadow.map = map;
  return { light, map };
}

/** The side of the slot `light` holds in `atlas`, or null for none. */
const slotSizeOf = (atlas: ViewportShadowAtlas, light: THREE.PointLight | THREE.SpotLight) =>
  atlas.slot(light)?.size ?? null;

describe('ViewportShadowAtlas.allocate', () => {
  it('gives a light the slot its viewport’s atlas holds for it', () => {
    const light = new THREE.SpotLight();
    const root = rootAtlas();
    const sub = subViewportAtlas();
    root.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);
    sub.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);
    expect(slotSizeOf(root, light)).toBe(1024);
    // A SubViewport's atlas is 2048 texels, so its largest slot is 512.
    expect(slotSizeOf(sub, light)).toBe(512);
  });

  it('holds no slot for a light that never asked (edge case)', () => {
    expect(slotSizeOf(rootAtlas(), new THREE.PointLight())).toBeNull();
  });
});

describe('ViewportShadowAtlas.bind', () => {
  it('keeps each viewport’s map for a light that two viewports render', () => {
    const { light, map: rootMap } = omniWithCube(1024);
    const root = rootAtlas();
    const sub = subViewportAtlas();
    root.bind(light.shadow);
    sub.bind(light.shadow);
    expect(light.shadow.map).toBeNull();
    const subMap = new THREE.WebGLCubeRenderTarget(256);
    light.shadow.map = subMap;
    root.bind(light.shadow);
    expect(light.shadow.map).toBe(rootMap);
    sub.bind(light.shadow);
    expect(light.shadow.map).toBe(subMap);
  });

  it('adopts the map three allocated before any viewport bound it (edge case)', () => {
    const { light, map } = omniWithCube(512);
    rootAtlas().bind(light.shadow);
    expect(light.shadow.map).toBe(map);
  });

  it('parks no map for a light that has none yet (error case)', () => {
    const light = new THREE.SpotLight();
    const root = rootAtlas();
    const sub = subViewportAtlas();
    root.bind(light.shadow);
    sub.bind(light.shadow);
    root.bind(light.shadow);
    expect(light.shadow.map).toBeNull();
  });
});

describe('ViewportShadowAtlas.retain', () => {
  it('disposes the parked map and frees the slot of a light that left the scene', () => {
    const { light, map } = omniWithCube(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.allocate([{ owner: light, isOmni: true, coverage: 1 }], 0);
    root.bind(light.shadow);
    subViewportAtlas().bind(light.shadow);
    root.retain(new Set());
    expect(dispose).toHaveBeenCalledOnce();
    expect(slotSizeOf(root, light)).toBeNull();
  });

  it('keeps everything for a light still in the scene (edge case)', () => {
    const { light, map } = omniWithCube(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.allocate([{ owner: light, isOmni: true, coverage: 1 }], 0);
    root.bind(light.shadow);
    root.retain(new Set([light]));
    expect(dispose).not.toHaveBeenCalled();
    expect(slotSizeOf(root, light)).toBe(1024);
  });

  it('leaves a bound map with its light, which disposes it itself (error case)', () => {
    const { light, map } = omniWithCube(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.bind(light.shadow);
    root.retain(new Set());
    expect(dispose).not.toHaveBeenCalled();
    expect(light.shadow.map).toBe(map);
  });
});

describe('ViewportShadowAtlas.dispose', () => {
  it('disposes the maps it parked', () => {
    const { light, map } = omniWithCube(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.bind(light.shadow);
    subViewportAtlas().bind(light.shadow);
    root.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('lets the next viewport adopt the map its light holds (edge case)', () => {
    const { light, map } = omniWithCube(1024);
    const root = rootAtlas();
    root.bind(light.shadow);
    root.dispose();
    subViewportAtlas().bind(light.shadow);
    expect(light.shadow.map).toBe(map);
  });

  it('disposes nothing when it parked nothing (error case)', () => {
    const { light, map } = omniWithCube(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.bind(light.shadow);
    root.dispose();
    expect(dispose).not.toHaveBeenCalled();
  });
});

describe('ViewportShadowAtlas and the shared atlas texture', () => {
  it('sizes the shared atlas to the largest viewport atlas that holds it', async () => {
    // Fresh modules, so no atlas an earlier test left holding the texture counts.
    vi.resetModules();
    const target = await import('./shadowAtlasTarget');
    const { ViewportShadowAtlas: FreshAtlas } = await import('./viewportShadowAtlas');
    const sub = new FreshAtlas(viewportPositionalShadowAtlas(undefined, []));
    expect(target.positionalShadowAtlas().width).toBe(2048);
    const root = new FreshAtlas(ROOT_POSITIONAL_SHADOW_ATLAS);
    expect(target.positionalShadowAtlas().width).toBe(4096);
    root.dispose();
    expect(target.positionalShadowAtlas().width).toBe(2048);
    sub.dispose();
  });

  it('places a slot in texels of its own viewport’s atlas', () => {
    const light = new THREE.SpotLight();
    const sub = subViewportAtlas();
    sub.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);
    // A SubViewport's 2048 atlas puts its second quadrant at x = 1024.
    expect(sub.slot(light)).toEqual({ x: 1024, y: 0, size: 512, paraboloidStep: null });
    sub.dispose();
  });
});

describe('renderWithShadowAtlas', () => {
  it('makes the atlas active for the render, and only for it', () => {
    const sub = subViewportAtlas();
    let during: ViewportShadowAtlas | null = null;
    renderWithShadowAtlas(sub, () => {
      during = activeShadowAtlas();
    });
    expect(during).toBe(sub);
    expect(activeShadowAtlas()).toBeNull();
  });

  it('restores the outer atlas after a nested pass (edge case)', () => {
    const outer = subViewportAtlas();
    const inner = subViewportAtlas();
    let afterInner: ViewportShadowAtlas | null = null;
    renderWithShadowAtlas(outer, () => {
      renderWithShadowAtlas(inner, () => {});
      afterInner = activeShadowAtlas();
    });
    expect(afterInner).toBe(outer);
  });

  it('clears the atlas when the render throws (error case)', () => {
    expect(() =>
      renderWithShadowAtlas(subViewportAtlas(), () => {
        throw new Error('lost context');
      })
    ).toThrow('lost context');
    expect(activeShadowAtlas()).toBeNull();
  });
});
