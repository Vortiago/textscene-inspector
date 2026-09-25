/** The primitive mesh types and their key parameters. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

function makeNode(meshSubResId: string): TscnNode {
  const props: MeshInstance3DProperties = {
    name: 'M',
    surfaceMaterialOverrides: new Map(),
    mesh: `SubResource("${meshSubResId}")`,
  };
  return { name: 'M', type: 'MeshInstance3D', children: [], properties: props };
}

function sub(
  type: string,
  id: string,
  data: Record<string, string | undefined> = {}
): TscnInternalResource {
  return {
    id,
    type,
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

async function renderGeometry(
  meshSubResource: TscnInternalResource
): Promise<THREE.BufferGeometry> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[meshSubResource]}>
      <MeshInstance3D node={makeNode(meshSubResource.id)} />
    </SceneResourcesProvider>
  );
  return (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
}

describe('Mesh primitives (assertions 48–59)', () => {
  it('#48 BoxMesh.size x/y/z → BoxGeometry.parameters.width/height/depth', async () => {
    const geom = (await renderGeometry(
      sub('BoxMesh', 'B', { size: 'Vector3(2, 3, 4)' })
    )) as unknown as THREE.BoxGeometry & {
      parameters: { width: number; height: number; depth: number };
    };
    expect(geom.parameters.width).toBe(2);
    expect(geom.parameters.height).toBe(3);
    expect(geom.parameters.depth).toBe(4);
  });

  it('#49 SphereMesh.radius → SphereGeometry.parameters.radius', async () => {
    const geom = (await renderGeometry(
      sub('SphereMesh', 'S', { radius: '1.5' })
    )) as unknown as THREE.SphereGeometry & { parameters: { radius: number } };
    expect(geom.parameters.radius).toBe(1.5);
  });

  it('#50 SphereMesh.height parser side-effect → heightSegments mapped through SphereMesh.rings', async () => {
    // SphereMesh has separate `height` and `rings`. The parser drives THREE's
    // heightSegments from `rings`.
    const geom = (await renderGeometry(
      sub('SphereMesh', 'S', { radius: '1', rings: '24' })
    )) as unknown as THREE.SphereGeometry & {
      parameters: { heightSegments: number };
    };
    expect(geom.parameters.heightSegments).toBe(24);
  });

  it('#51 SphereMesh.radial_segments → SphereGeometry.parameters.widthSegments', async () => {
    const geom = (await renderGeometry(
      sub('SphereMesh', 'S', { radius: '1', radial_segments: '48' })
    )) as unknown as THREE.SphereGeometry & {
      parameters: { widthSegments: number };
    };
    expect(geom.parameters.widthSegments).toBe(48);
  });

  it('#52 PlaneMesh.size x/y → PlaneGeometry.parameters.width/height', async () => {
    const geom = (await renderGeometry(
      sub('PlaneMesh', 'P', { size: 'Vector2(5, 7)' })
    )) as unknown as THREE.PlaneGeometry & {
      parameters: { width: number; height: number };
    };
    expect(geom.parameters.width).toBe(5);
    expect(geom.parameters.height).toBe(7);
  });

  it('#53 PlaneMesh.center_offset → geometry translated', async () => {
    // center_offset shifts the plane's bounding box centre.
    const geom = await renderGeometry(
      sub('PlaneMesh', 'P', { size: 'Vector2(2, 2)', center_offset: 'Vector3(1, 0, 0)' })
    );
    geom.computeBoundingBox();
    const center = new THREE.Vector3();
    geom.boundingBox!.getCenter(center);
    expect(center.x).toBeCloseTo(1, 3);
  });

  it('#54 PlaneMesh.orientation FACE_X/FACE_Y/FACE_Z → rotation applied', async () => {
    // FACE_Y (orientation=1) lays the plane in XZ with its normal up, so a (2,2) plane
    // has 2-unit extents in X and Z and none in Y.
    const geom = await renderGeometry(
      sub('PlaneMesh', 'P', { size: 'Vector2(2, 2)', orientation: '1' })
    );
    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox!.getSize(size);
    expect(size.y).toBeCloseTo(0, 3);
    expect(size.x).toBeCloseTo(2, 3);
    expect(size.z).toBeCloseTo(2, 3);
  });

  it('#55 CylinderMesh.top_radius/bottom_radius/height → CylinderGeometry.parameters', async () => {
    const geom = (await renderGeometry(
      sub('CylinderMesh', 'C', {
        top_radius: '0.5',
        bottom_radius: '1.0',
        height: '3.0',
      })
    )) as unknown as THREE.CylinderGeometry & {
      parameters: { radiusTop: number; radiusBottom: number; height: number };
    };
    expect(geom.parameters.radiusTop).toBe(0.5);
    expect(geom.parameters.radiusBottom).toBe(1.0);
    expect(geom.parameters.height).toBe(3.0);
  });

  it('#56 CapsuleMesh.radius → CapsuleGeometry.parameters.radius', async () => {
    const geom = (await renderGeometry(
      sub('CapsuleMesh', 'C', { radius: '0.5', height: '2.0' })
    )) as unknown as THREE.CapsuleGeometry & { parameters: { radius: number } };
    expect(geom.parameters.radius).toBe(0.5);
  });

  it('#57 CapsuleMesh.height → CapsuleGeometry.parameters.height (THREE 0.184: NOT .length)', async () => {
    const geom = (await renderGeometry(
      sub('CapsuleMesh', 'C', { radius: '0.5', height: '2.0' })
    )) as unknown as THREE.CapsuleGeometry & { parameters: { height: number } };
    // Godot 2.0 height - 2*0.5 radius = 1.0 cylinder section.
    expect(geom.parameters.height).toBe(1.0);
  });

  it('#58 TorusMesh.inner_radius/outer_radius → TorusGeometry.parameters', async () => {
    const geom = (await renderGeometry(
      sub('TorusMesh', 'T', { inner_radius: '0.5', outer_radius: '1.5' })
    )) as unknown as THREE.TorusGeometry & { parameters: { radius: number; tube: number } };
    // Center radius = (1.5 + 0.5) / 2 = 1; tube = (1.5 - 0.5) / 2 = 0.5.
    expect(geom.parameters.radius).toBe(1);
    expect(geom.parameters.tube).toBe(0.5);
  });

  it('#59 PrismMesh.size → a triangular prism filling that box', async () => {
    const geom = await renderGeometry(sub('PrismMesh', 'Pr', { size: 'Vector3(2, 2, 2)' }));

    // Godot's prism: 8 triangles for two caps, two slanted sides and one base.
    expect(geom.getIndex()!.count).toBe(24);
    geom.computeBoundingBox();
    expect(geom.boundingBox!.max.toArray()).toEqual([1, 1, 1]);
    expect(geom.boundingBox!.min.toArray()).toEqual([-1, -1, -1]);
  });
});
