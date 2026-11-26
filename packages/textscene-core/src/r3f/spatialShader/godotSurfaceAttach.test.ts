import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MaterialAttach } from '../materials/swappedMaterials';
import { godotSurfaceAttach, type GodotSurfaceHost, type SurfaceModule } from './godotSurfaceAttach';

const scene = new THREE.Scene();
const material = new THREE.MeshBasicMaterial();

function pointsModule(): SurfaceModule & { drawPoints: ReturnType<typeof vi.fn> } {
  return { withGodotSurface: vi.fn(), drawPoints: vi.fn(() => () => {}) } as never;
}

function twoSurfaceHost(): GodotSurfaceHost {
  return new THREE.Mesh(new THREE.BufferGeometry(), [material, material]) as GodotSurfaceHost;
}

describe('godotSurfaceAttach', () => {
  it('draws the points of the draw group its attach key names', () => {
    const module = pointsModule();
    const host = twoSurfaceHost();
    godotSurfaceAttach({ attach: 'material-1' }, module, 'native', scene)(host, material);

    expect(module.drawPoints).toHaveBeenCalledWith(host, 1, material, 'native', scene);
  });

  it("draws the points of the surface's own draw group under a fade's swap", () => {
    const module = pointsModule();
    const swap: MaterialAttach = () => () => {};
    const host = twoSurfaceHost();
    godotSurfaceAttach({ attach: 'material-1', swap }, module, 'native', scene)(host, material);

    expect(module.drawPoints).toHaveBeenCalledWith(host, 1, material, 'native', scene);
  });

  it('places the material through the swap when the surface fades', () => {
    const swap = vi.fn<MaterialAttach>(() => () => {});
    const host = twoSurfaceHost();
    godotSurfaceAttach({ attach: 'material-1', swap }, pointsModule(), null, scene)(host, material);

    expect(swap).toHaveBeenCalledWith(host, material);
  });
});
