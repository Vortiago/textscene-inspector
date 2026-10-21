/**
 * `MeshGeometry`'s dispatch from sub-resource type to a geometry, in a bare `<mesh>`, and the shape
 * each type draws: the vertex counts and the boxes a caller sees. Each slice's own `build.test.ts`
 * holds the parameter math.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshGeometry } from './meshGeometry';
import type { TscnInternalResource } from '../../../parser/types';

function sub(type: string, data: Record<string, string> = {}): TscnInternalResource {
  return { id: `${type}_test`, type, data };
}

async function renderGeometry(resource: TscnInternalResource): Promise<THREE.BufferGeometry> {
  const renderer = await ReactThreeTestRenderer.create(
    <mesh>
      <MeshGeometry resource={resource} />
    </mesh>
  );
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
}

function box(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

describe('MeshGeometry dispatch (buildPrimitiveMeshGeometry)', () => {
  const types = [
    'BoxMesh',
    'SphereMesh',
    'PlaneMesh',
    'QuadMesh',
    'CylinderMesh',
    'CapsuleMesh',
    'TorusMesh',
    'PrismMesh',
  ];

  it.each(types)('%s draws an indexed surface', async (type) => {
    const geometry = await renderGeometry(sub(type));

    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(geometry.getIndex()!.count).toBeGreaterThan(0);
  });

  it('unknown mesh type renders nothing (mesh keeps its default BufferGeometry)', async () => {
    const geometry = await renderGeometry(sub('ArrayMesh'));
    expect(geometry.getAttribute('position')).toBeUndefined();
  });
});

describe('SphereMesh', () => {
  it("builds Godot's (rings + 2)(radial_segments + 1) vertices at the defaults", async () => {
    // (32 + 2) rows of (64 + 1) vertices.
    expect((await renderGeometry(sub('SphereMesh'))).getAttribute('position').count).toBe(2210);
  });

  it('is_hemisphere=true draws a dome from y = 0 up to the height', async () => {
    const dome = box(
      await renderGeometry(sub('SphereMesh', { radius: '1', height: '0.5', is_hemisphere: 'true' }))
    );

    expect(dome.min.y).toBe(0);
    expect(dome.max.y).toBeCloseTo(0.5, 6);
  });
});

describe('CapsuleMesh', () => {
  it('spans its whole height, caps included', async () => {
    const capsule = box(await renderGeometry(sub('CapsuleMesh', { radius: '0.5', height: '3' })));

    expect(capsule.min.y).toBeCloseTo(-1.5, 6);
    expect(capsule.max.y).toBeCloseTo(1.5, 6);
  });

  it('lowers the radius to half a height below the diameter, as the linked setters do', async () => {
    const capsule = box(await renderGeometry(sub('CapsuleMesh', { radius: '0.5', height: '0.6' })));

    expect(capsule.max.y).toBeCloseTo(0.3, 6);
    expect(capsule.max.z).toBeCloseTo(0.3, 6);
  });

  it('builds three sections of (rings + 2)(radial_segments + 1) vertices', async () => {
    const geometry = await renderGeometry(
      sub('CapsuleMesh', { radius: '0.5', height: '2', rings: '6', radial_segments: '16' })
    );

    expect(geometry.getAttribute('position').count).toBe(3 * 8 * 17);
  });
});

describe('TorusMesh', () => {
  it('lies flat in the XZ plane, its hole facing +Y, as Godot builds it', async () => {
    // inner=1, outer=3: centre radius 2 and tube 1, so the ring reaches 3 in XZ and 1 along Y.
    const geometry = await renderGeometry(sub('TorusMesh', { inner_radius: '1', outer_radius: '3' }));
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.z).toBeCloseTo(3, 5);
    expect(box.min.z).toBeCloseTo(-3, 5);
    expect(box.max.y).toBeCloseTo(1, 5);
    expect(box.min.y).toBeCloseTo(-1, 5);
  });
});

describe('PrismMesh', () => {
  /** X of every vertex on the prism's top plane, its apex line. */
  function apexXs(geometry: THREE.BufferGeometry, topY: number): number[] {
    const position = geometry.getAttribute('position');
    const xs: number[] = [];
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getY(i) - topY) < 1e-6) xs.push(position.getX(i));
    }
    return xs;
  }

  it("builds Godot's triangular prism, not a three primitive", async () => {
    const geometry = await renderGeometry(sub('PrismMesh', { size: 'Vector3(2, 1, 2)' }));

    // 20 vertices / 8 triangles: two triangular caps, two slanted sides, one base.
    expect(geometry.getAttribute('position').count).toBe(20);
    expect(geometry.getIndex()!.count).toBe(24);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.toArray()).toEqual([1, 0.5, 1]);
    expect(geometry.boundingBox!.min.toArray()).toEqual([-1, -0.5, -1]);
  });

  it('maps subdivide_height to extra rows, per Godot num_points', async () => {
    const geometry = await renderGeometry(
      sub('PrismMesh', { size: 'Vector3(1, 1, 1)', subdivide_height: '2' })
    );

    // (2+2)(0+2)·2 + (2+2)(0+2)·2 + (0+2)(0+2) = 36.
    expect(geometry.getAttribute('position').count).toBe(36);
  });

  it('skews the apex with left_to_right', async () => {
    const centred = await renderGeometry(sub('PrismMesh', { size: 'Vector3(2, 2, 2)' }));
    const skewed = await renderGeometry(sub('PrismMesh', { size: 'Vector3(2, 2, 2)', left_to_right: '0.9' }));

    for (const x of apexXs(centred, 1)) expect(x).toBeCloseTo(0, 6);
    // start_x = -size.x/2 + size.x * left_to_right = -1 + 1.8.
    for (const x of apexXs(skewed, 1)) expect(x).toBeCloseTo(0.8, 6);
  });
});
