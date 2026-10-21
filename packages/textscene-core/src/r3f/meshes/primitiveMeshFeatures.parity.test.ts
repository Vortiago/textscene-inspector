/**
 * Primitive-mesh feature parity: subdivisions, the CylinderMesh cap flags and the SphereMesh
 * hemisphere, read from the decoders and the geometry `primitiveMeshGeometry` builds. Each builder's own
 * test checks its arrays against Godot's.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { decodeBoxMesh } from '../../resources/meshes/boxmesh/decode';
import { decodeSphereMesh } from '../../resources/meshes/spheremesh/decode';
import { decodeCylinderMesh } from '../../resources/meshes/cylindermesh/decode';
import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE } from '../../godot/scene/primitiveMesh';
import { primitiveMeshGeometry } from './primitiveMeshGeometry';
import type { TscnInternalResource } from '../../parser/types';

function geomFor(resource: TscnInternalResource): THREE.BufferGeometry {
  return primitiveMeshGeometry(resource, DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE)!;
}

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
  it('PlaneMesh subdivide_width=1 → a third column of vertices', () => {
    const g = geomFor({
      id: 'P',
      type: 'PlaneMesh',
      data: { size: 'Vector2(4, 4)', subdivide_width: '1' },
    });
    // (1 + 2) columns by (0 + 2) rows.
    expect(g.getAttribute('position').count).toBe(6);
  });

  it('SphereMesh is_hemisphere=true → a dome on a flat base at y = 0', () => {
    const g = geomFor({ id: 'S', type: 'SphereMesh', data: { radius: '0.5', is_hemisphere: 'true' } });
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBe(0);
  });

  it('PrismMesh subdivide_height=2 → two extra vertex rows (Godot num_points)', () => {
    const g = geomFor({
      id: 'Pr',
      type: 'PrismMesh',
      data: { size: 'Vector3(1, 1, 1)', subdivide_height: '2' },
    });
    // (2+2)(0+2)·2 + (2+2)(0+2)·2 + (0+2)(0+2) = 36.
    expect(g.getAttribute('position').count).toBe(36);
  });

  it('PrismMesh subdivide_height default 0 → the bare 20-vertex prism', () => {
    const g = geomFor({ id: 'Pr0', type: 'PrismMesh', data: { size: 'Vector3(1, 1, 1)' } });
    expect(g.getAttribute('position').count).toBe(20);
  });
});
