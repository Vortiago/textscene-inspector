/**
 * A primitive mesh that omits a detail property falls back to Godot's documented
 * default, not a three.js one. A wrong default renders the mesh more faceted
 * (or, for PrismMesh, 8× too big) than Godot.
 */
import { describe, it, expect } from 'vitest';
import { decodeSphereMesh } from './spheremesh/decode';
import { decodeCylinderMesh } from './cylindermesh/decode';
import { decodeTorusMesh } from './torusmesh/decode';
import { decodePrismMesh } from './prismmesh/decode';

describe('primitive mesh Godot default parity', () => {
  it('SphereMesh defaults: radial_segments=64, rings=32', () => {
    const p = decodeSphereMesh({});
    expect(p.radial_segments).toBe(64);
    expect(p.rings).toBe(32);
  });

  it('CylinderMesh defaults: radial_segments=64, rings=4', () => {
    const p = decodeCylinderMesh({});
    expect(p.radial_segments).toBe(64);
    expect(p.rings).toBe(4);
  });

  it('TorusMesh defaults: rings=64, ring_segments=32', () => {
    const p = decodeTorusMesh({});
    expect(p.rings).toBe(64);
    expect(p.ringSegments).toBe(32);
  });

  it('PrismMesh default size is 1×1×1 (not 2×2×2)', () => {
    const p = decodePrismMesh({});
    expect(p.size).toEqual({ x: 1, y: 1, z: 1 });
  });
});
