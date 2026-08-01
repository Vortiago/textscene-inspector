/**
 * Parity: primitive-mesh feature properties that were parsed/applied wrong or
 * not at all — PlaneMesh/BoxMesh subdivisions (Godot N extra loops = N+1
 * segments), CylinderMesh end-caps, SphereMesh hemisphere. Geometry-arg checks
 * render <MeshGeometry> and read the resulting THREE geometry parameters.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { decodeBoxMesh } from '../../../resources/meshes/boxmesh/decode';
import { decodeSphereMesh } from '../../../resources/meshes/spheremesh/decode';
import { decodeCylinderMesh } from '../../../resources/meshes/cylindermesh/decode';
import { MeshGeometry } from './meshGeometry';
import type { TscnInternalResource } from '../../../parser/types';

async function geomFor(resource: TscnInternalResource): Promise<THREE.BufferGeometry> {
  const renderer = await ReactThreeTestRenderer.create(
    <mesh>
      <MeshGeometry resource={resource} />
    </mesh>
  );
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
}
const params = (g: THREE.BufferGeometry) => (g as unknown as { parameters: Record<string, number> }).parameters;

describe('mesh feature parity — parsers', () => {
  it('BoxMesh parses subdivide_width/height/depth (default 0)', () => {
    expect(decodeBoxMesh({}).subdivideWidth).toBe(0);
    const p = decodeBoxMesh({ subdivide_width: '2', subdivide_height: '3', subdivide_depth: '4' });
    expect([p.subdivideWidth, p.subdivideHeight, p.subdivideDepth]).toEqual([2, 3, 4]);
  });

  it('SphereMesh parses is_hemisphere (default false)', () => {
    expect(decodeSphereMesh({}).isHemisphere).toBe(false);
    expect(decodeSphereMesh({ is_hemisphere: 'true' }).isHemisphere).toBe(true);
  });

  it('CylinderMesh parses cap_top/cap_bottom (default true)', () => {
    const d = decodeCylinderMesh({});
    expect([d.capTop, d.capBottom]).toEqual([true, true]);
    const p = decodeCylinderMesh({ cap_top: 'false', cap_bottom: 'false' });
    expect([p.capTop, p.capBottom]).toEqual([false, false]);
  });
});

describe('mesh feature parity — geometry', () => {
  it('PlaneMesh subdivide_width=1 → 2 width segments (N+1)', async () => {
    const g = await geomFor({ id: 'P', type: 'PlaneMesh', data: { size: 'Vector2(4, 4)', subdivide_width: '1' } });
    expect(params(g).widthSegments).toBe(2);
  });

  it('BoxMesh subdivide_width=2 → 3 width segments (N+1)', async () => {
    const g = await geomFor({ id: 'B', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)', subdivide_width: '2' } });
    expect(params(g).widthSegments).toBe(3);
  });

  it('SphereMesh is_hemisphere=true → thetaLength = π/2 (top dome)', async () => {
    const g = await geomFor({ id: 'S', type: 'SphereMesh', data: { radius: '0.5', is_hemisphere: 'true' } });
    expect(params(g).thetaLength).toBeCloseTo(Math.PI / 2, 5);
  });

  it('CylinderMesh cap_top=false + cap_bottom=false → openEnded', async () => {
    const g = await geomFor({ id: 'C', type: 'CylinderMesh', data: { cap_top: 'false', cap_bottom: 'false' } });
    expect(params(g).openEnded).toBe(true);
  });

  it('PrismMesh subdivide_height=2 → two extra vertex rows (Godot num_points)', async () => {
    const g = await geomFor({ id: 'Pr', type: 'PrismMesh', data: { size: 'Vector3(1, 1, 1)', subdivide_height: '2' } });
    // (2+2)(0+2)·2 + (2+2)(0+2)·2 + (0+2)(0+2) = 36.
    expect(g.getAttribute('position').count).toBe(36);
  });

  it('PrismMesh subdivide_height default 0 → the bare 20-vertex prism', async () => {
    const g = await geomFor({ id: 'Pr0', type: 'PrismMesh', data: { size: 'Vector3(1, 1, 1)' } });
    expect(g.getAttribute('position').count).toBe(20);
  });
});
