/**
 * WI-1 (ArrayMesh): a MeshInstance3D whose `mesh` is an ExtResource pointing
 * at an external ArrayMesh `.tres` renders the decoded BufferGeometry — not
 * the magenta placeholder box that every ExtResource mesh produced before.
 *
 * The decoded geometry is injected into the loader's `arrayMeshes` cache so it
 * resolves synchronously on first render (the decode itself is covered by
 * arrayMeshDecode.test.ts); these tests assert the COMPONENT wiring.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import { decodeArrayMesh } from '../../../resources/meshes/arrayMeshDecode';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arrayMeshGeometry';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

const WALL_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://bett1yahcwe25"]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

class NoopProvider implements ResourceProvider {
  async loadResource(): Promise<string | ArrayBuffer | null> {
    return null;
  }
  hasResource(): boolean {
    return false;
  }
}

function makeLoader(): ResourceLoader {
  const provider = new NoopProvider();
  const bus = new FileEventBus(provider);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return loader;
}

/** Inject a decoded ArrayMesh resource as if the arraymesh processor loaded it. */
function preloadArrayMesh(loader: ResourceLoader, path: string, resource: ArrayMeshResource): void {
  const originalGetCached = loader.arrayMeshes.getCached.bind(loader.arrayMeshes);
  const originalRequest = loader.arrayMeshes.request.bind(loader.arrayMeshes);
  loader.arrayMeshes.getCached = (p: string) => (p === path ? resource : originalGetCached(p));
  loader.arrayMeshes.request = (p: string) => {
    if (p === path) {
      loader.eventBus.emit<ArrayMeshResource>('arraymesh', 'loaded', p, resource);
      return;
    }
    originalRequest(p);
  };
}

function makeNode(): TscnNode {
  return {
    name: 'Mesh',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name: 'Mesh',
      mesh: 'ExtResource("1")',
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
}

const EXT: TscnExternalResource[] = [
  { id: '1', path: 'res://stage/meshes/wall.tres', type: 'ArrayMesh' },
];

function render(loader: ResourceLoader) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
        <MeshInstance3D node={makeNode()} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function firstMeshGeometry(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>
): THREE.BufferGeometry | undefined {
  const mesh = renderer.scene.findAllByType('Mesh')[0]?.instance as THREE.Mesh | undefined;
  return mesh?.geometry as THREE.BufferGeometry | undefined;
}

describe('<MeshInstance3D> external ArrayMesh (WI-1)', () => {
  it('renders the decoded ArrayMesh geometry (4 verts), not the placeholder box', async () => {
    const loader = makeLoader();
    const mesh = decodeArrayMesh(WALL_TRES);
    const resource: ArrayMeshResource = {
      geometry: buildArrayMeshGeometry(mesh),
      materialPaths: mesh.surfaces.map((s) => s.materialPath ?? null),
    };
    preloadArrayMesh(loader, 'res://stage/meshes/wall.tres', resource);

    const renderer = await render(loader);
    await new Promise<void>((r) => setTimeout(r, 10));
    await renderer.update(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
          <MeshInstance3D node={makeNode()} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const geo = firstMeshGeometry(renderer);
    expect(geo).toBe(resource.geometry);
    expect(geo!.getAttribute('position').count).toBe(4);
    expect(geo!.getIndex()!.count).toBe(6);
  });

  it('shows the magenta wireframe placeholder when the ArrayMesh is unavailable', async () => {
    const loader = makeLoader();
    // No preload: NoopProvider → the path fails to load → status unavailable.

    const renderer = await render(loader);
    await new Promise<void>((r) => setTimeout(r, 10));
    await renderer.update(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
          <MeshInstance3D node={makeNode()} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const materials = renderer.scene.findAllByType('MeshBasicMaterial');
    const placeholder = materials.find(
      (m) => (m.instance as THREE.MeshBasicMaterial).wireframe
    );
    expect(placeholder).toBeDefined();
  });
});
