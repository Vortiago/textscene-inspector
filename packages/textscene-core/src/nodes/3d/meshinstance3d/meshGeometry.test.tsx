/**
 * Unit tests for `MeshGeometry` — the sub_resource-type → three.js geometry
 * dispatch, rendered in isolation (a bare `<mesh>` wrapper, no
 * SceneResourcesProvider). Complements `Component.mesh-primitives.test.tsx`,
 * which goes through the full MeshInstance3D component; here the focus is
 * the dispatch table itself plus the parameter math NOT covered there:
 * hemisphere theta, cylinder cap semantics, capsule height clamping, torus
 * segment mapping, and prism radius/subdivision mapping.
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

function params<T>(geometry: THREE.BufferGeometry): T {
  return (geometry as THREE.BufferGeometry & { parameters: T }).parameters;
}

describe('MeshGeometry dispatch (buildPrimitiveMeshGeometry)', () => {
  const cases: Array<[resourceType: string, geometryType: string]> = [
    ['BoxMesh', 'BoxGeometry'],
    ['SphereMesh', 'SphereGeometry'],
    ['PlaneMesh', 'PlaneGeometry'],
    ['QuadMesh', 'PlaneGeometry'],
    ['CylinderMesh', 'CylinderGeometry'],
    ['CapsuleMesh', 'CapsuleGeometry'],
    ['TorusMesh', 'TorusGeometry'],
    // PrismMesh is hand-built from Godot's own algorithm, so it has no three
    // geometry class of its own; the block below asserts its shape instead.
  ];

  for (const [resourceType, geometryType] of cases) {
    it(`${resourceType} → ${geometryType}`, async () => {
      const geometry = await renderGeometry(sub(resourceType));
      expect(geometry.type).toBe(geometryType);
    });
  }

  it('unknown mesh type renders nothing (mesh keeps its default BufferGeometry)', async () => {
    const geometry = await renderGeometry(sub('ArrayMesh'));
    expect(geometry.type).toBe('BufferGeometry');
  });
});

describe('BoxMesh subdivisions', () => {
  it('maps Godot subdivide_* (extra edge loops) to N+1 segments', async () => {
    const geometry = await renderGeometry(
      sub('BoxMesh', { subdivide_width: '2', subdivide_height: '3', subdivide_depth: '4' })
    );
    const p = params<{ widthSegments: number; heightSegments: number; depthSegments: number }>(
      geometry
    );
    expect(p.widthSegments).toBe(3);
    expect(p.heightSegments).toBe(4);
    expect(p.depthSegments).toBe(5);
  });
});

describe('QuadMesh (PlaneMesh subclass)', () => {
  it('maps the witnessed size = Vector2(200, 200) to a 200×200 plane', async () => {
    const p = params<{ width: number; height: number }>(
      await renderGeometry(sub('QuadMesh', { size: 'Vector2(200, 200)' }))
    );
    expect(p.width).toBe(200);
    expect(p.height).toBe(200);
  });

  it('defaults to a 1×1 quad facing +Z (no rotation applied)', async () => {
    const geometry = await renderGeometry(sub('QuadMesh'));
    const p = params<{ width: number; height: number }>(geometry);
    expect(p.width).toBe(1);
    expect(p.height).toBe(1);
    // FACE_Z (orientation 2) keeps the default XY plane: +Z normal, untouched.
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.z).toBe(0);
    expect(geometry.boundingBox!.max.z).toBe(0);
  });
});

describe('SphereMesh hemisphere', () => {
  it('full sphere by default: theta sweeps 0..π over the full circle', async () => {
    const p = params<{ thetaStart: number; thetaLength: number; phiLength: number }>(
      await renderGeometry(sub('SphereMesh', { radius: '1' }))
    );
    expect(p.thetaStart).toBe(0);
    expect(p.thetaLength).toBeCloseTo(Math.PI, 10);
    expect(p.phiLength).toBeCloseTo(Math.PI * 2, 10);
  });

  it('is_hemisphere=true renders only the top dome: theta sweeps 0..π/2', async () => {
    const p = params<{ thetaStart: number; thetaLength: number }>(
      await renderGeometry(sub('SphereMesh', { radius: '1', is_hemisphere: 'true' }))
    );
    expect(p.thetaStart).toBe(0);
    expect(p.thetaLength).toBeCloseTo(Math.PI / 2, 10);
  });

  it('falls back to Godot segment defaults (radial 64, rings 32)', async () => {
    const p = params<{ widthSegments: number; heightSegments: number }>(
      await renderGeometry(sub('SphereMesh'))
    );
    expect(p.widthSegments).toBe(64);
    expect(p.heightSegments).toBe(32);
  });
});

describe('CylinderMesh radii and caps', () => {
  it('maps top/bottom radius and segment counts', async () => {
    const p = params<{
      radiusTop: number;
      radiusBottom: number;
      radialSegments: number;
      heightSegments: number;
    }>(
      await renderGeometry(
        sub('CylinderMesh', {
          top_radius: '0.25',
          bottom_radius: '0.75',
          radial_segments: '12',
          rings: '3',
        })
      )
    );
    expect(p.radiusTop).toBe(0.25);
    expect(p.radiusBottom).toBe(0.75);
    expect(p.radialSegments).toBe(12);
    expect(p.heightSegments).toBe(3);
  });

  it('keeps caps by default (openEnded false)', async () => {
    const p = params<{ openEnded: boolean }>(await renderGeometry(sub('CylinderMesh')));
    expect(p.openEnded).toBe(false);
  });

  it('opens the ends only when BOTH caps are disabled', async () => {
    const p = params<{ openEnded: boolean }>(
      await renderGeometry(sub('CylinderMesh', { cap_top: 'false', cap_bottom: 'false' }))
    );
    expect(p.openEnded).toBe(true);
  });

  it('keeps caps when only one cap is disabled (single-cap removal not representable)', async () => {
    const topOnly = params<{ openEnded: boolean }>(
      await renderGeometry(sub('CylinderMesh', { cap_top: 'false' }))
    );
    const bottomOnly = params<{ openEnded: boolean }>(
      await renderGeometry(sub('CylinderMesh', { cap_bottom: 'false' }))
    );
    expect(topOnly.openEnded).toBe(false);
    expect(bottomOnly.openEnded).toBe(false);
  });
});

describe('CapsuleMesh height math', () => {
  it('subtracts both hemisphere caps from Godot height for the cylinder section', async () => {
    const p = params<{ radius: number; height: number }>(
      await renderGeometry(sub('CapsuleMesh', { radius: '0.5', height: '3' }))
    );
    expect(p.radius).toBe(0.5);
    // 3 - 2 * 0.5 = 2 cylinder section.
    expect(p.height).toBe(2);
  });

  it('clamps the cylinder section to 0.01 when height <= 2 * radius', async () => {
    const p = params<{ height: number }>(
      await renderGeometry(sub('CapsuleMesh', { radius: '0.5', height: '0.6' }))
    );
    expect(p.height).toBe(0.01);
  });

  it('maps rings → capSegments and radial_segments → radialSegments', async () => {
    const p = params<{ capSegments: number; radialSegments: number }>(
      await renderGeometry(
        sub('CapsuleMesh', { radius: '0.5', height: '2', rings: '6', radial_segments: '16' })
      )
    );
    expect(p.capSegments).toBe(6);
    expect(p.radialSegments).toBe(16);
  });
});

describe('TorusMesh radii mapping', () => {
  it('converts Godot inner/outer radii to THREE center radius + tube radius', async () => {
    const p = params<{ radius: number; tube: number }>(
      await renderGeometry(sub('TorusMesh', { inner_radius: '1', outer_radius: '3' }))
    );
    // Center radius = (3 + 1) / 2 = 2; tube = (3 - 1) / 2 = 1.
    expect(p.radius).toBe(2);
    expect(p.tube).toBe(1);
  });

  it('maps ring_segments → radialSegments and rings → tubularSegments', async () => {
    const p = params<{ radialSegments: number; tubularSegments: number }>(
      await renderGeometry(
        sub('TorusMesh', { inner_radius: '0.5', outer_radius: '1', ring_segments: '24', rings: '48' })
      )
    );
    expect(p.radialSegments).toBe(24);
    expect(p.tubularSegments).toBe(48);
  });

  it('lies flat in the XZ plane (hole facing +Y), matching Godot — not three\'s upright default', async () => {
    // inner=1, outer=3 → center radius 2, tube 1. three's unrotated TorusGeometry
    // stands upright (thin in Z, tall in Y); Godot's TorusMesh lies flat. The π/2
    // rotateX bakes that in, so the ring spans XZ (max.z ≈ radius+tube = 3) and is
    // thin along Y (max.y ≈ tube = 1). If the rotation were missing these swap.
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
  /** X of every vertex on the prism's top plane — its apex line. */
  function apexXs(geometry: THREE.BufferGeometry, topY: number): number[] {
    const position = geometry.getAttribute('position');
    const xs: number[] = [];
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getY(i) - topY) < 1e-6) xs.push(position.getX(i));
    }
    return xs;
  }

  it('builds Godot\'s triangular prism, not a three primitive', async () => {
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
    const skewed = await renderGeometry(
      sub('PrismMesh', { size: 'Vector3(2, 2, 2)', left_to_right: '0.9' })
    );

    for (const x of apexXs(centred, 1)) expect(x).toBeCloseTo(0, 6);
    // start_x = -size.x/2 + size.x * left_to_right = -1 + 1.8.
    for (const x of apexXs(skewed, 1)) expect(x).toBeCloseTo(0.8, 6);
  });
});
