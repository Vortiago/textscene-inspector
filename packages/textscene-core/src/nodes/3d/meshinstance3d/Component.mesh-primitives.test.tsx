/** The primitive mesh types and their key parameters, as the box and the vertices they draw. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { COARSE_TUBE, curveEndingAt } from '../../../resources/meshes/primitivemesh/surface.testkit';
import { subResource } from '../../../testing/subResource';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const MeshInstance3D = registeredComponent('MeshInstance3D');

function makeNode(meshSubResId: string): TscnNode {
  const props: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'M',
    surfaceMaterialOverrides: new Map(),
    mesh: `SubResource("${meshSubResId}")`,
  };
  return { rawProperties: {}, name: 'M', type: 'MeshInstance3D', children: [], properties: props };
}

async function renderGeometry(
  meshSubResource: TscnInternalResource,
  ...named: TscnInternalResource[]
): Promise<THREE.BufferGeometry> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[meshSubResource, ...named]}>
      <MeshInstance3D node={makeNode(meshSubResource.id)} />
    </SceneResourcesProvider>
  );
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
}

function boxSize(geometry: THREE.BufferGeometry): number[] {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getSize(new THREE.Vector3()).toArray();
}

function expectSize(geometry: THREE.BufferGeometry, expected: number[]): void {
  boxSize(geometry).forEach((side, i) => expect(side).toBeCloseTo(expected[i]!, 5));
}

describe('Mesh primitives (assertions 48–59)', () => {
  it('#48 BoxMesh.size fills a box of that size', async () => {
    expectSize(await renderGeometry(subResource('BoxMesh', 'B', { size: 'Vector3(2, 3, 4)' })), [2, 3, 4]);
  });

  it('#49 SphereMesh.radius sets the width and leaves the height to SphereMesh.height', async () => {
    // One ring puts a row on the equator, where the sphere is widest.
    const geom = await renderGeometry(subResource('SphereMesh', 'S', { radius: '1.5', rings: '1' }));
    expectSize(geom, [3, 1, 3]);
  });

  it('#50 SphereMesh.rings adds rows of vertices between the poles', async () => {
    const geom = await renderGeometry(subResource('SphereMesh', 'S', { radius: '1', rings: '24' }));
    // (24 + 2) rows of (64 + 1) vertices.
    expect(geom.getAttribute('position').count).toBe(1690);
  });

  it('#51 SphereMesh.radial_segments adds columns of vertices round the axis', async () => {
    const geom = await renderGeometry(subResource('SphereMesh', 'S', { radius: '1', radial_segments: '48' }));
    // (32 + 2) rows of (48 + 1) vertices.
    expect(geom.getAttribute('position').count).toBe(1666);
  });

  it('#52 PlaneMesh.size spans X and Z of the default FACE_Y plane', async () => {
    expectSize(await renderGeometry(subResource('PlaneMesh', 'P', { size: 'Vector2(5, 7)' })), [5, 0, 7]);
  });

  it('#53 PlaneMesh.center_offset → geometry translated', async () => {
    // center_offset shifts the plane's bounding box centre.
    const geom = await renderGeometry(
      subResource('PlaneMesh', 'P', { size: 'Vector2(2, 2)', center_offset: 'Vector3(1, 0, 0)' })
    );
    geom.computeBoundingBox();
    const center = new THREE.Vector3();
    geom.boundingBox!.getCenter(center);
    expect(center.x).toBeCloseTo(1, 3);
  });

  it('#54 PlaneMesh.orientation FACE_X/FACE_Y/FACE_Z → rotation applied', async () => {
    // FACE_Y (orientation=1) lays the plane in XZ with its normal up, so a (2,2) plane
    // has 2-unit extents in X and Z and none in Y.
    expectSize(
      await renderGeometry(subResource('PlaneMesh', 'P', { size: 'Vector2(2, 2)', orientation: '1' })),
      [2, 0, 2]
    );
  });

  it('#55 CylinderMesh.top_radius/bottom_radius/height size the box by the wider end', async () => {
    const geom = await renderGeometry(
      subResource('CylinderMesh', 'C', { top_radius: '0.5', bottom_radius: '1.0', height: '3.0' })
    );
    expectSize(geom, [2, 3, 2]);
  });

  it('#56 CapsuleMesh.radius sets the width', async () => {
    const geom = await renderGeometry(subResource('CapsuleMesh', 'C', { radius: '0.25', height: '2.0' }));
    expectSize(geom, [0.5, 2, 0.5]);
  });

  it('#57 CapsuleMesh.height spans the whole capsule, caps included', async () => {
    const geom = await renderGeometry(subResource('CapsuleMesh', 'C', { radius: '0.5', height: '3.0' }));
    expectSize(geom, [1, 3, 1]);
  });

  it('#58 TorusMesh.inner_radius/outer_radius → a flat ring as wide as the outer radius', async () => {
    const geom = await renderGeometry(
      subResource('TorusMesh', 'T', { inner_radius: '0.5', outer_radius: '1.5' })
    );
    // The tube is (1.5 - 0.5) / 2 = 0.5 thick, so the ring is 1 tall.
    expectSize(geom, [3, 1, 3]);
  });

  it('TubeTrailMesh.curve scales the radius along the tube, the Curve read from the same scene', async () => {
    const geom = await renderGeometry(
      subResource('TubeTrailMesh', 'Tube', { ...COARSE_TUBE, curve: 'SubResource("C")' }),
      subResource('Curve', 'C', curveEndingAt('3'))
    );
    // 2 tall, and as wide as the bottom row: three times the radius of 0.5, twice.
    expectSize(geom, [3, 2, 3]);
  });

  it('#59 PrismMesh.size → a triangular prism filling that box', async () => {
    const geom = await renderGeometry(subResource('PrismMesh', 'Pr', { size: 'Vector3(2, 2, 2)' }));

    // Godot's prism: 8 triangles for two caps, two slanted sides and one base.
    expect(geom.getIndex()!.count).toBe(24);
    expectSize(geom, [2, 2, 2]);
  });
});
