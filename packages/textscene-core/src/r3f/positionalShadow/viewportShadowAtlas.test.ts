import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  ROOT_POSITIONAL_SHADOW_ATLAS,
  viewportPositionalShadowAtlas,
} from '../../godot/positionalShadowAtlas';
import { activeShadowAtlas, renderWithShadowAtlas, ViewportShadowAtlas } from './viewportShadowAtlas';

const rootAtlas = () => new ViewportShadowAtlas(ROOT_POSITIONAL_SHADOW_ATLAS);
const subViewportAtlas = () => new ViewportShadowAtlas(viewportPositionalShadowAtlas(undefined, []));

/** A spot light whose shadow holds a map of `size`, as three leaves it after a render. */
function spotWithMap(size: number): { light: THREE.SpotLight; map: THREE.WebGLRenderTarget } {
  const light = new THREE.SpotLight();
  const map = new THREE.WebGLRenderTarget(size, size);
  light.shadow.map = map;
  return { light, map };
}

describe('ViewportShadowAtlas.allocate', () => {
  it('gives a light the slot its viewport’s atlas holds for it', () => {
    const light = new THREE.SpotLight();
    const root = rootAtlas();
    const sub = subViewportAtlas();
    root.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);
    sub.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);
    expect(root.slotSize(light)).toBe(1024);
    // A SubViewport's atlas is 2048 texels, so its largest slot is 512.
    expect(sub.slotSize(light)).toBe(512);
  });

  it('holds no slot for a light that never asked (edge case)', () => {
    expect(rootAtlas().slotSize(new THREE.PointLight())).toBeNull();
  });
});

describe('ViewportShadowAtlas.bind', () => {
  it('keeps each viewport’s map for a light that two viewports render', () => {
    const { light, map: rootMap } = spotWithMap(1024);
    const root = rootAtlas();
    const sub = subViewportAtlas();
    root.bind(light.shadow);
    sub.bind(light.shadow);
    expect(light.shadow.map).toBeNull();
    const subMap = new THREE.WebGLRenderTarget(512, 512);
    light.shadow.map = subMap;
    root.bind(light.shadow);
    expect(light.shadow.map).toBe(rootMap);
    sub.bind(light.shadow);
    expect(light.shadow.map).toBe(subMap);
  });

  it('adopts the map three allocated before any viewport bound it (edge case)', () => {
    const { light, map } = spotWithMap(512);
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
    const { light, map } = spotWithMap(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);
    root.bind(light.shadow);
    subViewportAtlas().bind(light.shadow);
    root.retain(new Set());
    expect(dispose).toHaveBeenCalledOnce();
    expect(root.slotSize(light)).toBeNull();
  });

  it('keeps everything for a light still in the scene (edge case)', () => {
    const { light, map } = spotWithMap(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.allocate([{ owner: light, isOmni: false, coverage: 1 }], 0);
    root.bind(light.shadow);
    root.retain(new Set([light]));
    expect(dispose).not.toHaveBeenCalled();
    expect(root.slotSize(light)).toBe(1024);
  });

  it('leaves a bound map with its light, which disposes it itself (error case)', () => {
    const { light, map } = spotWithMap(1024);
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
    const { light, map } = spotWithMap(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.bind(light.shadow);
    subViewportAtlas().bind(light.shadow);
    root.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('lets the next viewport adopt the map its light holds (edge case)', () => {
    const { light, map } = spotWithMap(1024);
    const root = rootAtlas();
    root.bind(light.shadow);
    root.dispose();
    subViewportAtlas().bind(light.shadow);
    expect(light.shadow.map).toBe(map);
  });

  it('disposes nothing when it parked nothing (error case)', () => {
    const { light, map } = spotWithMap(1024);
    const dispose = vi.spyOn(map, 'dispose');
    const root = rootAtlas();
    root.bind(light.shadow);
    root.dispose();
    expect(dispose).not.toHaveBeenCalled();
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
