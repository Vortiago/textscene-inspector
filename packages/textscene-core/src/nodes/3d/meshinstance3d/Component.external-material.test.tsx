/**
 * A primitive mesh's material may be an `ExtResource` to a `.tres`, not only a
 * `[sub_resource]`. `set_surface_override_material` (`scene/3d/mesh_instance_3d.cpp:366`),
 * `material_override` and `PrimitiveMesh.material` pass only `->get_rid()`, so every
 * rank takes either. A missed one shows the mid-grey default, brighter than most albedos.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { GODOT_DEFAULT_ALBEDO } from '../../../r3f/materials/godotDefaultMaterial';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';
import { surfaceMaterials } from './testing/renderMeshInstance';
import { parseTresFile } from '../../../parser/parsedResource';
import { castsFrom, depthSideOf } from '../../../r3f/testing/threePasses';

const EXTERNAL_PATH = 'res://dielectric.tres';
const SECOND_EXTERNAL_PATH = 'res://second.tres';

const EXTERNALS: readonly TscnExternalResource[] = [
  { id: '1_ext', path: EXTERNAL_PATH, type: 'StandardMaterial3D' },
  { id: '2_ext', path: SECOND_EXTERNAL_PATH, type: 'StandardMaterial3D' },
  // A material ExtResource the pipeline has no builder for: not a `.tres`.
  { id: '3_glb', path: 'res://packed.glb', type: 'Material' },
];

const INTERNALS: readonly TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
  { id: 'Box_ext', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)', material: 'ExtResource("1_ext")' } },
  { id: 'Mat_inline', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  inlineTwoSurfaceMesh('Mesh_2'),
];

function makeNode(properties: Partial<MeshInstance3DProperties>): TscnNode {
  const full: MeshInstance3DProperties = {
    name: 'M',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    materialOverride: undefined,
    ...properties,
  };
  return { name: 'M', type: 'MeshInstance3D', children: [], properties: full };
}

async function materialsOf(
  node: TscnNode,
  seeded: ReadonlyMap<string, string> = new Map()
): Promise<THREE.MeshStandardMaterial[]> {
  const fake = createFakeResourceLoader();
  for (const [path, text] of seeded) fake.resources.seed(path, parseTresFile(text));
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={INTERNALS} externalResources={EXTERNALS}>
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return surfaceMaterials(renderer);
}

/** A `.tres` StandardMaterial3D with one albedo, so each file is identifiable by colour. */
function materialTres(albedo: string): string {
  return `[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nalbedo_color = ${albedo}\n`;
}

const FIRST_HEX = 0x0000ff;
const SECOND_HEX = 0xff00ff;

/** The two `.tres` files, each identifiable by its own albedo. */
function loadedMaterials(): Map<string, string> {
  return new Map([
    [EXTERNAL_PATH, materialTres('Color(0, 0, 1, 1)')],
    [SECOND_EXTERNAL_PATH, materialTres('Color(1, 0, 1, 1)')],
  ]);
}

function isGodotDefaultMaterial(material: THREE.MeshStandardMaterial): boolean {
  return material.color.equals(GODOT_DEFAULT_ALBEDO);
}

describe('<MeshInstance3D> external .tres material on a primitive mesh', () => {
  it('loads surface_material_override/0 from an ExtResource .tres', async () => {
    const seeded = loadedMaterials();
    const materials = await materialsOf(
      makeNode({ surfaceMaterialOverrides: new Map([[0, 'ExtResource("1_ext")']]) }),
      seeded
    );
    expect(materials[0]!.color.getHex()).toBe(FIRST_HEX);
  });

  it('loads material_override from an ExtResource .tres', async () => {
    const seeded = loadedMaterials();
    const materials = await materialsOf(makeNode({ materialOverride: 'ExtResource("1_ext")' }), seeded);
    expect(materials[0]!.color.getHex()).toBe(FIRST_HEX);
  });

  it('loads the primitive mesh’s OWN material from an ExtResource .tres', async () => {
    const seeded = loadedMaterials();
    const materials = await materialsOf(makeNode({ mesh: 'SubResource("Box_ext")' }), seeded);
    expect(materials[0]!.color.getHex()).toBe(FIRST_HEX);
  });

  it('ranks material_override above a surface override that is an ExtResource', async () => {
    const seeded = loadedMaterials();
    const materials = await materialsOf(
      makeNode({
        surfaceMaterialOverrides: new Map([[0, 'ExtResource("2_ext")']]),
        materialOverride: 'ExtResource("1_ext")',
      }),
      seeded
    );
    expect(materials[0]!.color.getHex()).toBe(FIRST_HEX);
  });

  it('mixes arrivals across surfaces — an inline slot and a .tres slot', async () => {
    const seeded = loadedMaterials();
    const materials = await materialsOf(
      makeNode({
        // A real two-surface mesh: Godot drops any override past a
        // PrimitiveMesh's single surface (`testing/twoSurfaceMesh.ts`).
        mesh: 'SubResource("Mesh_2")',
        surfaceMaterialOverrides: new Map([
          [0, 'SubResource("Mat_inline")'],
          [1, 'ExtResource("2_ext")'],
        ]),
      }),
      seeded
    );
    expect(materials).toHaveLength(2);
    expect(materials[0]!.color.getHex()).toBe(0x00ff00);
    expect(materials[1]!.color.getHex()).toBe(SECOND_HEX);
  });

  it('draws Godot’s default material while the .tres is still loading', async () => {
    // Nothing seeded: the load is in flight, and Godot draws its default surface
    // for an invalid material RID, the same fallback an absent material takes.
    const materials = await materialsOf(
      makeNode({ surfaceMaterialOverrides: new Map([[0, 'ExtResource("1_ext")']]) })
    );
    expect(isGodotDefaultMaterial(materials[0]!)).toBe(true);
  });

  it('draws Godot’s default material for a material ExtResource that is not a .tres', async () => {
    const materials = await materialsOf(
      makeNode({ surfaceMaterialOverrides: new Map([[0, 'ExtResource("3_glb")']]) }),
      loadedMaterials()
    );
    expect(isGodotDefaultMaterial(materials[0]!)).toBe(true);
  });
});

/**
 * `cast_shadow` is GeometryInstance3D state, not material state
 * (`servers/rendering/renderer_scene_cull.cpp:732`), so it must hold for a
 * material that arrives from a `.tres`.
 */
describe('<MeshInstance3D> cast_shadow through an external .tres material', () => {
  it('casts double-sided shadows when the material came from a .tres', async () => {
    const fake = createFakeResourceLoader();
    for (const [path, text] of loadedMaterials()) fake.resources.seed(path, parseTresFile(text));
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={INTERNALS} externalResources={EXTERNALS}>
          <MeshInstance3D
            node={makeNode({
              castShadow: 2,
              surfaceMaterialOverrides: new Map([[0, 'ExtResource("1_ext")']]),
            })}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const mesh = findMesh(renderer.scene);
    const material = mesh.material as THREE.Material;
    expect(depthSideOf(mesh)).toBe(THREE.DoubleSide);

    // The shadow side is the node's, carried by the mesh, never written onto the material.
    expect((material as THREE.MeshStandardMaterial).color.getHex()).toBe(FIRST_HEX);
    expect(material.shadowSide).toBeNull();
  });
});

/**
 * The node reads its own decisions off the material's scalars, whichever file the material
 * came from: a blended material casts no shadow, and a missing map diverts to the placeholder.
 */
describe('<MeshInstance3D> node decisions from a .tres material', () => {
  async function meshWith(
    tres: string,
    seedTextures: (fake: ReturnType<typeof createFakeResourceLoader>) => void = () => {}
  ) {
    const fake = createFakeResourceLoader();
    fake.resources.seed(EXTERNAL_PATH, parseTresFile(tres));
    seedTextures(fake);
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={INTERNALS} externalResources={EXTERNALS}>
          <MeshInstance3D node={makeNode({ materialOverride: 'ExtResource("1_ext")' })} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    return findMesh(renderer.scene);
  }

  it('casts no shadow for a blended .tres material, as for an inline one', async () => {
    const mesh = await meshWith(
      '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nblend_mode = 1\n'
    );
    expect(castsFrom(mesh)).toBe(false);
  });

  it("shows the missing-texture placeholder when a .tres material's map cannot load", async () => {
    const tres = `[gd_resource type="StandardMaterial3D" format=3]

[ext_resource type="Texture2D" path="res://absent.png" id="1_tex"]

[resource]
albedo_texture = ExtResource("1_tex")
`;
    const mesh = await meshWith(tres, (fake) => fake.textures.seed('res://absent.png', null));
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(0xff00ff);
  });
});
