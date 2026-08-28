/**
 * ArrayMesh: a MeshInstance3D whose `mesh` is an ExtResource pointing
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
import { decodeArrayMesh } from '../../../resources/meshes/arraymesh/decode';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arraymesh/build';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { INLINE_SURFACES, inlineSurfacesWithMaterial } from './arrayMeshSurfaces.testkit';

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

/** truck_cab.tres's `headlights` surface: ARRAY_FLAG_COMPRESS_ATTRIBUTES, 12 B/vertex. */
const COMPRESSED_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(0.416992, 0.114807, 1.339844, 0.102539, 0.06988499, 0.023437023),
"format": 34896613383,
"index_count": 6,
"index_data": PackedByteArray("AAABAAIAAAADAAEA"),
"name": "headlights",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("//8B71UVpsQAAEkKqeqmxC4l//8AAKbEj/0AAP//psTYje2P2I3tj9iN7Y/Yje2P")
}]
blend_shape_mode = 0
`;

function inlineMeshNode(subResourceId: string): TscnNode {
  return {
    name: 'Trailer',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name: 'Trailer',
      mesh: `SubResource("${subResourceId}")`,
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
}

class NoopProvider implements ResourceProvider {
  async loadResource(): Promise<string | ArrayBuffer | null> {
    return null;
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
    const mesh = decodeArrayMesh(WALL_TRES, 'res://stage/meshes/wall.tres');
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

  it('renders a compressed-attribute ArrayMesh with finite bounds, not the placeholder', async () => {
    const loader = makeLoader();
    const mesh = decodeArrayMesh(COMPRESSED_TRES, 'res://stage/meshes/wall.tres');
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
    // A NaN here would leave the node unframeable, not merely misdrawn.
    geo!.computeBoundingSphere();
    expect(Number.isFinite(geo!.boundingSphere!.radius)).toBe(true);
    const wireframes = renderer.scene
      .findAllByType('MeshBasicMaterial')
      .filter((m) => (m.instance as THREE.Object3D & THREE.MeshBasicMaterial).wireframe);
    expect(wireframes).toHaveLength(0);
  });

  it('renders an ArrayMesh the SCENE declares as its own sub_resource', async () => {
    // A scene can inline baked surfaces instead of pointing at a `.tres`. There is
    // no file to fetch, so nothing asks the resource pipeline — and because
    // `resolveMeshSubResource` DOES find the sub-resource, the unresolved-mesh
    // placeholder never fired either, so the node drew nothing with no diagnostic.
    const loader = makeLoader();
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={[
            { id: 'ArrayMesh_inline', type: 'ArrayMesh', data: { _surfaces: INLINE_SURFACES } },
          ]}
          externalResources={[]}
        >
          <MeshInstance3D node={inlineMeshNode('ArrayMesh_inline')} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    await new Promise<void>((r) => setTimeout(r, 10));

    const geo = firstMeshGeometry(renderer);
    expect(geo!.getAttribute('position').count).toBe(4);
    expect(geo!.getIndex()!.count).toBe(6);
    geo!.computeBoundingSphere();
    expect(Number.isFinite(geo!.boundingSphere!.radius)).toBe(true);
    const noWireframe = renderer.scene
      .findAllByType('MeshBasicMaterial')
      .filter((m) => (m.instance as THREE.Object3D & THREE.MeshBasicMaterial).wireframe);
    expect(noWireframe).toHaveLength(0);
  });

  it("applies the scene's own sub_resource material to an inline mesh surface", async () => {
    // The scene's materials are in `internalResources`, which this component
    // already holds — but no resource PATH can address them, so a surface naming
    // one used to fall through to the neutral default and draw flat white. Every
    // corpus scene that inlines a mesh names its materials this way.
    const loader = makeLoader();
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={[
            {
              id: 'ArrayMesh_inline',
              type: 'ArrayMesh',
              data: { _surfaces: inlineSurfacesWithMaterial('Mat_blue') },
            },
            {
              id: 'Mat_blue',
              type: 'StandardMaterial3D',
              data: { albedo_color: 'Color(0.0387471, 0, 0.256548, 1)', roughness: '0.6' },
            },
          ]}
          externalResources={[]}
        >
          <MeshInstance3D node={inlineMeshNode('ArrayMesh_inline')} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    await new Promise<void>((r) => setTimeout(r, 10));

    const materials = renderer.scene.findAllByType('MeshStandardMaterial');
    const colours = materials.map((m) =>
      (m.instance as THREE.Object3D & THREE.MeshStandardMaterial).color.getHex()
    );
    // The material's albedo, not ExternalMaterialSlot's 0xffffff default.
    expect(colours).not.toContain(0xffffff);
    expect(colours.some((c) => c !== 0xffffff)).toBe(true);
  });

  it('shows the placeholder when a scene ArrayMesh sub_resource carries no surfaces', async () => {
    // `buildPrimitiveMeshGeometry` has no ArrayMesh case, so falling through would
    // draw nothing and say nothing — how the missing trailer went unnoticed.
    const loader = makeLoader();
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={[{ id: 'ArrayMesh_empty', type: 'ArrayMesh', data: {} }]}
          externalResources={[]}
        >
          <MeshInstance3D node={inlineMeshNode('ArrayMesh_empty')} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    await new Promise<void>((r) => setTimeout(r, 10));

    const wireframes = renderer.scene
      .findAllByType('MeshBasicMaterial')
      .filter((m) => (m.instance as THREE.Object3D & THREE.MeshBasicMaterial).wireframe);
    expect(wireframes.length).toBeGreaterThan(0);
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
      (m) => (m.instance as THREE.Object3D & THREE.MeshBasicMaterial).wireframe
    );
    expect(placeholder).toBeDefined();
  });
});

/**
 * The mesh's own surface materials — `[sub_resource type="StandardMaterial3D"]`
 * blocks inside the mesh's `.tres`, the form Godot writes for every Truck Town
 * vehicle. Nothing is preloaded here: the whole path runs, from the provider
 * handing over one file's bytes to two distinct materials attached at
 * `material-0` / `material-1`.
 */
const OWN_MATERIALS_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://ownmats"]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_tire"]
resource_name = "tire"
albedo_color = Color(1, 0, 0, 1)
roughness = 0.8

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_chrome"]
resource_name = "chrome"
albedo_color = Color(0, 0, 1, 1)
metallic = 1.0

[resource]
resource_name = "meshes_wheel"
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"material": SubResource("StandardMaterial3D_tire"),
"name": "tire",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}, {
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"material": SubResource("StandardMaterial3D_chrome"),
"name": "chrome",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

class SingleFileProvider implements ResourceProvider {
  constructor(private path: string, private content: string) {}
  async loadResource(path: string): Promise<string | ArrayBuffer | null> {
    return path === this.path ? this.content : null;
  }
}

describe('<MeshInstance3D> ArrayMesh with its own surface materials', () => {
  const MESH_PATH = 'res://stage/meshes/wall.tres';

  it('builds each surface material out of the mesh’s own .tres', async () => {
    const provider = new SingleFileProvider(MESH_PATH, OWN_MATERIALS_TRES);
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    const renderer = await render(loader);
    // Two chained loads (mesh bytes → decode → material bytes → build), each
    // several microtask hops plus the material builder's dynamic imports.
    for (let i = 0; i < 10; i++) {
      await new Promise<void>((r) => setTimeout(r, 20));
      await renderer.update(
        <ResourceLoaderProvider loader={loader}>
          <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
            <MeshInstance3D node={makeNode()} />
          </SceneResourcesProvider>
        </ResourceLoaderProvider>
      );
    }

    const mesh = renderer.scene.findAllByType('Mesh')[0]?.instance as THREE.Mesh;
    const materials = mesh.material as THREE.MeshStandardMaterial[];
    expect(materials).toHaveLength(2);
    // Straight off each sub-resource body: Color(1,0,0,1)/roughness 0.8 and
    // Color(0,0,1,1)/metallic 1.0. Both primaries survive sRGB→linear exactly.
    expect(materials[0]!.color.getHex()).toBe(0xff0000);
    expect(materials[0]!.roughness).toBe(0.8);
    expect(materials[1]!.color.getHex()).toBe(0x0000ff);
    expect(materials[1]!.metalness).toBe(1);
  });
});
