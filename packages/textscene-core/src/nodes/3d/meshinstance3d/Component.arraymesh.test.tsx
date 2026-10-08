/**
 * A MeshInstance3D whose `mesh` is an ExtResource to an ArrayMesh `.tres` renders
 * the decoded BufferGeometry. The geometry is injected into the `arrayMeshes` cache,
 * so these tests assert the component wiring. `resources/meshes/arraymesh/decode.test.ts`
 * covers the decode.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader } from '../../../index';
import { decodeArrayMeshTres } from '../../../resources/testing/decodeArrayMeshTres';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arraymesh/build';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { materialInstanceAs } from '../testing/reactThreeTestInstance';
import { headlightsSurface, wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { preloadResource } from '../../../resources/testing/preloadResource';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import { EMPTY_AABB } from '../../../godot/aabb';

const WALL_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://bett1yahcwe25"]

[resource]
_surfaces = ${wallQuadSurfaces({})}
blend_shape_mode = 0
`;

/** truck_cab.tres's `headlights` surface: ARRAY_FLAG_COMPRESS_ATTRIBUTES, 12 B/vertex. */
const COMPRESSED_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [${headlightsSurface({ name: 'headlights' })}]
blend_shape_mode = 0
`;

/**
 * The `_surfaces` value of an ArrayMesh a `.tscn` declares inline: the wall
 * quad's bytes, without the file wrapper, as `trailer_truck.tscn` writes its body.
 */
const INLINE_SURFACES = wallQuadSurfaces({ name: 'inline' });

function inlineMeshNode(subResourceId: string): TscnNode {
  return {
    rawProperties: {},
    name: 'Trailer',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      ...GEOMETRY_INSTANCE_DEFAULTS,
      name: 'Trailer',
      mesh: `SubResource("${subResourceId}")`,
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
}

function makeNode(): TscnNode {
  return {
    rawProperties: {},
    name: 'Mesh',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      ...GEOMETRY_INSTANCE_DEFAULTS,
      name: 'Mesh',
      mesh: 'ExtResource("1")',
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };
}

const EXT: TscnExternalResource[] = [{ id: '1', path: 'res://stage/meshes/wall.tres', type: 'ArrayMesh' }];

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
    const loader = loaderServing();
    const mesh = decodeArrayMeshTres(WALL_TRES, 'res://stage/meshes/wall.tres');
    const resource: ArrayMeshResource = {
      geometry: buildArrayMeshGeometry(mesh),
      materialPaths: mesh.surfaces.map((s) => s.materialPath ?? null),
      surfaceIndices: mesh.surfaces.map((s) => s.surfaceIndex),
      aabb: EMPTY_AABB,
    };
    preloadResource(loader, 'arraymesh', 'res://stage/meshes/wall.tres', resource);

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
    const loader = loaderServing();
    const mesh = decodeArrayMeshTres(COMPRESSED_TRES, 'res://stage/meshes/wall.tres');
    const resource: ArrayMeshResource = {
      geometry: buildArrayMeshGeometry(mesh),
      materialPaths: mesh.surfaces.map((s) => s.materialPath ?? null),
      surfaceIndices: mesh.surfaces.map((s) => s.surfaceIndex),
      aabb: EMPTY_AABB,
    };
    preloadResource(loader, 'arraymesh', 'res://stage/meshes/wall.tres', resource);

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
      .filter((m) => materialInstanceAs<THREE.MeshBasicMaterial>(m).wireframe);
    expect(wireframes).toHaveLength(0);
  });

  it('renders an ArrayMesh the SCENE declares as its own sub_resource', async () => {
    // A scene can inline baked surfaces instead of pointing at a `.tres`. No file
    // is fetched, and `resolveMeshSubResource` finds the sub-resource, so the
    // unresolved-mesh placeholder does not fire either.
    const loader = loaderServing();
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
      .filter((m) => materialInstanceAs<THREE.MeshBasicMaterial>(m).wireframe);
    expect(noWireframe).toHaveLength(0);
  });

  it("applies the scene's own sub_resource material to an inline mesh surface", async () => {
    // The scene's materials are in `internalResources`, which this component
    // holds, but no resource path can address them. A scene that inlines a mesh
    // names its materials this way.
    const loader = loaderServing();
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={[
            {
              id: 'ArrayMesh_inline',
              type: 'ArrayMesh',
              data: {
                _surfaces: wallQuadSurfaces({ material: 'SubResource("Mat_blue")', name: 'inline' }),
              },
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

    const materials = renderer.scene
      .findAllByType('MeshStandardMaterial')
      .map((m) => materialInstanceAs<THREE.MeshStandardMaterial>(m));
    expect(materials.length).toBeGreaterThan(0);
    // The sub_resource's own albedo, a near-black blue at roughness 0.6, not
    // the mid-grey 0.6/0.8/0.2 Godot binds for a surface with no material.
    for (const material of materials) {
      const rgb = material.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);
      expect(rgb.b).toBeGreaterThan(rgb.r);
      expect(rgb.b).toBeLessThan(0.1);
      expect(material.roughness).toBeCloseTo(0.6, 5);
    }
  });

  it('shows the placeholder when a scene ArrayMesh sub_resource carries no surfaces', async () => {
    // `buildPrimitiveMeshGeometry` has no ArrayMesh case, so falling through would
    // draw nothing and report nothing.
    const loader = loaderServing();
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
      .filter((m) => materialInstanceAs<THREE.MeshBasicMaterial>(m).wireframe);
    expect(wireframes.length).toBeGreaterThan(0);
  });

  it('shows the magenta wireframe placeholder when the ArrayMesh is unavailable', async () => {
    const loader = loaderServing();
    // No preload: the loader serves no file, so the status turns unavailable.

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
    const placeholder = materials.find((m) => materialInstanceAs<THREE.MeshBasicMaterial>(m).wireframe);
    expect(placeholder).toBeDefined();
  });
});

/**
 * The mesh's own surface materials: `[sub_resource type="StandardMaterial3D"]`
 * blocks inside its `.tres`. Nothing is preloaded, so the whole path runs, from
 * one file's bytes to two materials at `material-0` and `material-1`.
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
_surfaces = ${wallQuadSurfaces(
  { material: 'SubResource("StandardMaterial3D_tire")', name: 'tire' },
  { material: 'SubResource("StandardMaterial3D_chrome")', name: 'chrome' }
)}
blend_shape_mode = 0
`;

describe('<MeshInstance3D> ArrayMesh with its own surface materials', () => {
  const MESH_PATH = 'res://stage/meshes/wall.tres';

  it('builds each surface material out of the mesh’s own .tres', async () => {
    const loader = loaderServing({ [MESH_PATH]: OWN_MATERIALS_TRES });

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
