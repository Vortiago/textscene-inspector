/**
 * A MeshInstance3D's material overrides against a baked ArrayMesh. Per surface,
 * `surface_material_override/N` beats the mesh's own (`servers/rendering/renderer_rd/forward_clustered/render_forward_clustered.cpp:4264`),
 * `material_override` beats both on every surface (`:4206`), and the default
 * material is the fallback (`:4221`), as `scene/3d/mesh_instance_3d.cpp:384` states.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

const MESH_PATH = 'res://stage/meshes/wheel.tres';
const OVERRIDE_MATERIAL_PATH = 'res://stage/materials/paint.tres';

/** A quad's worth of surface bytes: the four vertices every surface here uses. */
const QUAD_BODY = `"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")`;

/** Surface 0's positions truncated to 4 bytes: undecodable, so the decoder drops it. */
const BROKEN_QUAD_BODY = QUAD_BODY.replace(
  /"vertex_data": PackedByteArray\("[^"]*"\)/,
  '"vertex_data": PackedByteArray("AAAA")'
);

/** Two surfaces, red then blue, each naming a `[sub_resource]` of the mesh's own `.tres`. */
function twoSurfaceTres(firstBody = QUAD_BODY): string {
  return `[gd_resource type="ArrayMesh" format=4 uid="uid://overridemats"]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_red"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_blue"]
albedo_color = Color(0, 0, 1, 1)

[resource]
_surfaces = [{
${firstBody},
"material": SubResource("StandardMaterial3D_red"),
"name": "red_surface"
}, {
${QUAD_BODY},
"material": SubResource("StandardMaterial3D_blue"),
"name": "blue_surface"
}]
blend_shape_mode = 0
`;
}

/** The same two surfaces as `_surfaces` bytes only, for a mesh inlined in a `.tscn`. */
const INLINE_TWO_SURFACES = `[{
${QUAD_BODY},
"material": SubResource("Mat_red"),
"name": "red_surface"
}, {
${QUAD_BODY},
"material": SubResource("Mat_blue"),
"name": "blue_surface"
}]`;

const OVERRIDE_MATERIAL_TRES = `[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0, 1, 0, 1)
`;

class MapProvider implements ResourceProvider {
  constructor(private files: Record<string, string>) {}
  async loadResource(path: string): Promise<string | ArrayBuffer | null> {
    return this.files[path] ?? null;
  }
}

function makeLoader(files: Record<string, string>): ResourceLoader {
  const provider = new MapProvider(files);
  const bus = new FileEventBus(provider);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return loader;
}

interface NodeSpec {
  mesh: string;
  materialOverride?: string;
  overrides?: Record<number, string>;
}

function makeNode({ mesh, materialOverride, overrides }: NodeSpec): TscnNode {
  const properties: MeshInstance3DProperties = {
    name: 'Wheel',
    mesh,
    surfaceMaterialOverrides: new Map(
      Object.entries(overrides ?? {}).map(([k, v]) => [Number(k), v])
    ),
  } as MeshInstance3DProperties;
  if (materialOverride) properties.materialOverride = materialOverride;
  return { name: 'Wheel', type: 'MeshInstance3D', children: [], properties };
}

const MESH_EXT: TscnExternalResource[] = [
  { id: '1', path: MESH_PATH, type: 'ArrayMesh' },
  { id: '9', path: OVERRIDE_MATERIAL_PATH, type: 'Material' },
];

/**
 * Render and pump the async pipeline: mesh bytes → decode → material bytes →
 * build, each several microtask hops plus the material builder's dynamic imports.
 */
async function renderSettled(
  loader: ResourceLoader,
  node: TscnNode,
  internalResources: TscnInternalResource[] = []
): Promise<THREE.Material[]> {
  const tree = (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={MESH_EXT}
      >
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree);
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => setTimeout(r, 20));
    await renderer.update(tree);
  }
  const mesh = renderer.scene.findAllByType('Mesh')[0]?.instance as THREE.Mesh;
  const material = mesh.material;
  return Array.isArray(material) ? material : [material];
}

function hex(material: THREE.Material): number {
  return (material as THREE.MeshStandardMaterial).color.getHex();
}

const SCENE_MATERIALS: TscnInternalResource[] = [
  { id: 'Mat_green', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  { id: 'Mat_white', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 1, 1, 1)' } },
  { id: 'Mat_red', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Mat_blue', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
];

describe('<MeshInstance3D> ArrayMesh material overrides', () => {
  it('applies surface_material_override/1 to that surface only', async () => {
    const loader = makeLoader({ [MESH_PATH]: twoSurfaceTres() });
    const materials = await renderSettled(
      loader,
      makeNode({ mesh: 'ExtResource("1")', overrides: { 1: 'SubResource("Mat_green")' } }),
      SCENE_MATERIALS
    );

    expect(materials).toHaveLength(2);
    // Surface 0 keeps the mesh's own red: `materials[j]` is what Godot takes when
    // `inst_materials[j]` is invalid, per surface.
    expect(hex(materials[0]!)).toBe(0xff0000);
    expect(hex(materials[1]!)).toBe(0x00ff00);
  });

  it('lets material_override outrank a per-surface override on every surface', async () => {
    const loader = makeLoader({ [MESH_PATH]: twoSurfaceTres() });
    const materials = await renderSettled(
      loader,
      makeNode({
        mesh: 'ExtResource("1")',
        materialOverride: 'SubResource("Mat_white")',
        overrides: { 1: 'SubResource("Mat_green")' },
      }),
      SCENE_MATERIALS
    );

    expect(materials).toHaveLength(2);
    expect(hex(materials[0]!)).toBe(0xffffff);
    expect(hex(materials[1]!)).toBe(0xffffff);
  });

  it('resolves an ExtResource override through the material pipeline', async () => {
    const loader = makeLoader({
      [MESH_PATH]: twoSurfaceTres(),
      [OVERRIDE_MATERIAL_PATH]: OVERRIDE_MATERIAL_TRES,
    });
    const materials = await renderSettled(
      loader,
      makeNode({ mesh: 'ExtResource("1")', overrides: { 0: 'ExtResource("9")' } }),
      SCENE_MATERIALS
    );

    expect(materials).toHaveLength(2);
    expect(hex(materials[0]!)).toBe(0x00ff00);
    expect(hex(materials[1]!)).toBe(0x0000ff);
  });

  it('indexes overrides by the original surface index when a surface is dropped', async () => {
    // Surface 0 is undecodable, so the one draw group is Godot's surface 1. The
    // override index is Godot's original surface index, not the compacted group.
    const loader = makeLoader({ [MESH_PATH]: twoSurfaceTres(BROKEN_QUAD_BODY) });
    const materials = await renderSettled(
      loader,
      makeNode({ mesh: 'ExtResource("1")', overrides: { 1: 'SubResource("Mat_green")' } }),
      SCENE_MATERIALS
    );

    expect(materials).toHaveLength(1);
    expect(hex(materials[0]!)).toBe(0x00ff00);
  });

  it('ignores an override naming a surface index the mesh does not have', async () => {
    // `MeshInstance3D::_set` (`scene/3d/mesh_instance_3d.cpp:65`) refuses an index
    // past the surface count `_mesh_changed` (`:407`) sizes the array to, so the
    // mesh keeps exactly its own surfaces.
    const loader = makeLoader({ [MESH_PATH]: twoSurfaceTres() });
    const materials = await renderSettled(
      loader,
      makeNode({ mesh: 'ExtResource("1")', overrides: { 5: 'SubResource("Mat_green")' } }),
      SCENE_MATERIALS
    );

    expect(materials).toHaveLength(2);
    expect(hex(materials[0]!)).toBe(0xff0000);
    expect(hex(materials[1]!)).toBe(0x0000ff);
  });

  it('applies an override to an ArrayMesh the scene declares inline', async () => {
    const loader = makeLoader({});
    const materials = await renderSettled(
      loader,
      makeNode({
        mesh: 'SubResource("ArrayMesh_inline")',
        overrides: { 1: 'SubResource("Mat_green")' },
      }),
      [
        ...SCENE_MATERIALS,
        { id: 'ArrayMesh_inline', type: 'ArrayMesh', data: { _surfaces: INLINE_TWO_SURFACES } },
      ]
    );

    expect(materials).toHaveLength(2);
    expect(hex(materials[0]!)).toBe(0xff0000);
    expect(hex(materials[1]!)).toBe(0x00ff00);
  });
});
