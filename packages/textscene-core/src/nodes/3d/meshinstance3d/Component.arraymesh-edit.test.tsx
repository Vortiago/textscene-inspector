/**
 * A mounted MeshInstance3D whose scene ArrayMesh the user edits in the source pane:
 * every keystroke re-parses the scene, and the preview must follow each edit.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader } from '../../../index';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';

const MESH_ID = 'ArrayMesh_inline';

const NODE: TscnNode = {
  name: 'Wall',
  type: 'MeshInstance3D',
  children: [],
  properties: {
    name: 'Wall',
    mesh: `SubResource("${MESH_ID}")`,
    surfaceMaterialOverrides: new Map(),
  } as MeshInstance3DProperties,
};

function scene(loader: ResourceLoader, internalResources: TscnInternalResource[]) {
  return (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={internalResources} externalResources={[]}>
        <MeshInstance3D node={NODE} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function inlineMesh(surfaces: string): TscnInternalResource {
  return { id: MESH_ID, type: 'ArrayMesh', data: { _surfaces: surfaces } };
}

function albedoMaterial(id: string, albedo: string): TscnInternalResource {
  return { id, type: 'StandardMaterial3D', data: { albedo_color: albedo } };
}

async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 10));
}

describe('<MeshInstance3D> scene ArrayMesh edited while mounted', () => {
  it("follows an edit to a surface material's body that leaves the surface bytes alone", async () => {
    const loader = loaderServing();
    const surfaces = wallQuadSurfaces({ material: 'SubResource("Mat")', name: 'wall' });
    const renderer = await ReactThreeTestRenderer.create(
      scene(loader, [inlineMesh(surfaces), albedoMaterial('Mat', 'Color(1, 0, 0, 1)')])
    );
    await settle();

    await renderer.update(scene(loader, [inlineMesh(surfaces), albedoMaterial('Mat', 'Color(0, 0, 1, 1)')]));
    await settle();

    const material = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(0x0000ff);
  });

  it('binds every surface material when a one-surface mesh gains a second surface', async () => {
    const loader = loaderServing();
    const red = albedoMaterial('Red', 'Color(1, 0, 0, 1)');
    const blue = albedoMaterial('Blue', 'Color(0, 0, 1, 1)');
    const oneSurface = wallQuadSurfaces({ material: 'SubResource("Red")', name: 'a' });
    const twoSurfaces = wallQuadSurfaces(
      { material: 'SubResource("Red")', name: 'a' },
      { material: 'SubResource("Blue")', name: 'b' }
    );
    const renderer = await ReactThreeTestRenderer.create(scene(loader, [inlineMesh(oneSurface), red, blue]));
    await settle();

    await renderer.update(scene(loader, [inlineMesh(twoSurfaces), red, blue]));
    await settle();

    const materials = findMesh(renderer.scene).material as THREE.MeshStandardMaterial[];
    expect(materials.map((m) => m?.color.getHex())).toEqual([0xff0000, 0x0000ff]);
  });
});
