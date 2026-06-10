/**
 * Parity: when a primitive mesh omits a detail property, the parser must fall
 * back to Godot 4.4's documented default (not an arbitrary three.js value).
 * Wrong defaults render the mesh more faceted (or, for PrismMesh, 8× too big)
 * than Godot whenever the .tscn leaves the property out.
 */
import { describe, it, expect } from 'vitest';
import { parseSphereMesh } from './spheremesh/parser';
import { parseCylinderMesh } from './cylindermesh/parser';
import { parseTorusMesh } from './torusmesh/parser';
import { parsePrismMesh } from './prismmesh/parser';

describe('primitive mesh Godot default parity', () => {
  it('SphereMesh defaults: radial_segments=64, rings=32', () => {
    const p = parseSphereMesh({});
    expect(p.radial_segments).toBe(64);
    expect(p.rings).toBe(32);
  });

  it('CylinderMesh defaults: radial_segments=64, rings=4', () => {
    const p = parseCylinderMesh({});
    expect(p.radial_segments).toBe(64);
    expect(p.rings).toBe(4);
  });

  it('TorusMesh defaults: rings=64, ring_segments=32', () => {
    const p = parseTorusMesh({});
    expect(p.rings).toBe(64);
    expect(p.ringSegments).toBe(32);
  });

  it('PrismMesh default size is 1×1×1 (not 2×2×2)', () => {
    const p = parsePrismMesh({});
    expect(p.size).toEqual({ x: 1, y: 1, z: 1 });
  });
});
