/**
 * A MeshInstance3D's material overrides against a baked ArrayMesh. Per surface,
 * `surface_material_override/N` beats the mesh's own (`servers/rendering/renderer_rd/forward_clustered/render_forward_clustered.cpp:4264`),
 * `material_override` beats both on every surface (`:4206`), and the default
 * material is the fallback (`:4221`), as `scene/3d/mesh_instance_3d.cpp:384` states.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import { wallQuadSurface } from '../../../resources/testing/arrayMeshSurfaces';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import { meshInstanceNode, meshInstanceTree, surfaceMaterials } from './testing/renderMeshInstance';

const MESH_PATH = 'res://stage/meshes/wheel.tres';
const OVERRIDE_MATERIAL_PATH = 'res://stage/materials/paint.tres';
const MISSING_TEXTURE_PATH = 'res://stage/textures/missing.png';

const RED_SURFACE = wallQuadSurface({
  material: 'SubResource("StandardMaterial3D_red")',
  name: 'red_surface',
});
const BLUE_SURFACE = wallQuadSurface({
  material: 'SubResource("StandardMaterial3D_blue")',
  name: 'blue_surface',
});

/** The red surface with its positions truncated to 4 bytes: undecodable, so the decoder drops it. */
const BROKEN_RED_SURFACE = RED_SURFACE.replace(
  /"vertex_data": PackedByteArray\("[^"]*"\)/,
  '"vertex_data": PackedByteArray("AAAA")'
);

/** Two surfaces, red then blue, each naming a `[sub_resource]` of the mesh's own `.tres`. */
function twoSurfaceTres(firstSurface = RED_SURFACE): string {
  return `[gd_resource type="ArrayMesh" format=4 uid="uid://overridemats"]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_red"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_blue"]
albedo_color = Color(0, 0, 1, 1)

[resource]
_surfaces = [${firstSurface}, ${BLUE_SURFACE}]
blend_shape_mode = 0
`;
}

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

const MESH_EXT: TscnExternalResource[] = [
  { id: '1', path: MESH_PATH, type: 'ArrayMesh' },
  { id: '9', path: OVERRIDE_MATERIAL_PATH, type: 'Material' },
  { id: '7', path: MISSING_TEXTURE_PATH, type: 'Texture2D' },
];

/**
 * Render and pump the async pipeline: mesh bytes → decode → material bytes →
 * build, each several microtask hops plus the material builder's dynamic imports.
 */
async function renderSettled(
  loader: ResourceLoader,
  node: TscnNode,
  internalResources: TscnInternalResource[] = []
): Promise<THREE.MeshStandardMaterial[]> {
  const tree = meshInstanceTree({ loader, node, internalResources, externalResources: MESH_EXT });
  const renderer = await ReactThreeTestRenderer.create(tree);
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => setTimeout(r, 20));
    await renderer.update(tree);
  }
  return surfaceMaterials(renderer);
}

const MAGENTA = 0xff00ff;

function hex(material: THREE.MeshStandardMaterial): number {
  return material.color.getHex();
}

const SCENE_MATERIALS: TscnInternalResource[] = [
  { id: 'Mat_green', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  { id: 'Mat_white', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 1, 1, 1)' } },
  { id: 'Mat_red', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Mat_blue', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
  { id: 'Mat_missing_texture', type: 'StandardMaterial3D', data: { albedo_texture: 'ExtResource("7")' } },
];

describe('<MeshInstance3D> ArrayMesh material overrides', () => {
  it('applies surface_material_override/1 to that surface only', async () => {
    const loader = makeLoader({ [MESH_PATH]: twoSurfaceTres() });
    const materials = await renderSettled(
      loader,
      meshInstanceNode({
        mesh: 'ExtResource("1")',
        surfaceOverrides: new Map([[1, 'SubResource("Mat_green")']]),
      }),
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
      meshInstanceNode({
        mesh: 'ExtResource("1")',
        materialOverride: 'SubResource("Mat_white")',
        surfaceOverrides: new Map([[1, 'SubResource("Mat_green")']]),
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
      meshInstanceNode({ mesh: 'ExtResource("1")', surfaceOverrides: new Map([[0, 'ExtResource("9")']]) }),
      SCENE_MATERIALS
    );

    expect(materials).toHaveLength(2);
    expect(hex(materials[0]!)).toBe(0x00ff00);
    expect(hex(materials[1]!)).toBe(0x0000ff);
  });

  it('indexes overrides by the original surface index when a surface is dropped', async () => {
    // Surface 0 is undecodable, so the one draw group is Godot's surface 1. The
    // override index is Godot's original surface index, not the compacted group.
    const loader = makeLoader({ [MESH_PATH]: twoSurfaceTres(BROKEN_RED_SURFACE) });
    const materials = await renderSettled(
      loader,
      meshInstanceNode({
        mesh: 'ExtResource("1")',
        surfaceOverrides: new Map([[1, 'SubResource("Mat_green")']]),
      }),
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
      meshInstanceNode({
        mesh: 'ExtResource("1")',
        surfaceOverrides: new Map([[5, 'SubResource("Mat_green")']]),
      }),
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
      meshInstanceNode({
        mesh: 'SubResource("ArrayMesh_inline")',
        surfaceOverrides: new Map([[1, 'SubResource("Mat_green")']]),
      }),
      [...SCENE_MATERIALS, inlineTwoSurfaceMesh('ArrayMesh_inline', ['Mat_red', 'Mat_blue'])]
    );

    expect(materials).toHaveLength(2);
    expect(hex(materials[0]!)).toBe(0xff0000);
    expect(hex(materials[1]!)).toBe(0x00ff00);
  });

  it('draws the magenta placeholder on every surface when material_override names a missing texture', async () => {
    const materials = await renderSettled(
      makeLoader({}),
      meshInstanceNode({
        mesh: 'SubResource("ArrayMesh_inline")',
        materialOverride: 'SubResource("Mat_missing_texture")',
      }),
      [...SCENE_MATERIALS, inlineTwoSurfaceMesh('ArrayMesh_inline', ['Mat_red', 'Mat_blue'])]
    );

    expect(materials.map(hex)).toEqual([MAGENTA, MAGENTA]);
  });
});
