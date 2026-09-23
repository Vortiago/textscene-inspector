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
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';

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
  seeded: ReadonlyMap<string, THREE.Material> = new Map()
): Promise<THREE.MeshStandardMaterial[]> {
  const fake = createFakeResourceLoader();
  for (const [path, material] of seeded) fake.materials.seed(path, material);
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={INTERNALS} externalResources={EXTERNALS}>
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const material = findMesh(renderer.scene).material;
  return (Array.isArray(material) ? material : [material]) as THREE.MeshStandardMaterial[];
}

/** The loaded `.tres` materials, each identifiable by its own albedo. */
function loadedMaterials(): Map<string, THREE.Material> {
  return new Map<string, THREE.Material>([
    [EXTERNAL_PATH, new THREE.MeshStandardMaterial({ color: 0x5ab7ff })],
    [SECOND_EXTERNAL_PATH, new THREE.MeshStandardMaterial({ color: 0xff6ad5 })],
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
    expect(materials[0]).toBe(seeded.get(EXTERNAL_PATH));
  });

  it('loads material_override from an ExtResource .tres', async () => {
    const seeded = loadedMaterials();
    const materials = await materialsOf(
      makeNode({ materialOverride: 'ExtResource("1_ext")' }),
      seeded
    );
    expect(materials[0]).toBe(seeded.get(EXTERNAL_PATH));
  });

  it('loads the primitive mesh’s OWN material from an ExtResource .tres', async () => {
    const seeded = loadedMaterials();
    const materials = await materialsOf(makeNode({ mesh: 'SubResource("Box_ext")' }), seeded);
    expect(materials[0]).toBe(seeded.get(EXTERNAL_PATH));
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
    expect(materials[0]).toBe(seeded.get(EXTERNAL_PATH));
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
    expect(materials[1]).toBe(seeded.get(SECOND_EXTERNAL_PATH));
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
 * (`servers/rendering/renderer_scene_cull.cpp:732`), so it must survive a
 * material that arrives already built from a `.tres`.
 */
describe('<MeshInstance3D> cast_shadow through an external .tres material', () => {
  /** three's own shadow pass: `result.side` first, then the per-object hook. */
  function shadowSideAfterPass(mesh: THREE.Mesh, material: THREE.Material): THREE.Side {
    // WebGLShadowMap.js:477: `shadowSide` wins, else the acne-mitigating flip.
    const flip: Record<number, THREE.Side> = {
      [THREE.FrontSide]: THREE.BackSide,
      [THREE.BackSide]: THREE.FrontSide,
      [THREE.DoubleSide]: THREE.DoubleSide,
    };
    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.side = material.shadowSide ?? flip[material.side as number]!;
    // WebGLShadowMap.js:535,549: fired per mesh, per light, after the above.
    // three passes the scene, not the object, as the second argument.
    mesh.onBeforeShadow(
      null as never, new THREE.Scene(), null as never, null as never,
      mesh.geometry, depthMaterial, null as never
    );
    return depthMaterial.side;
  }

  it('casts double-sided shadows when the material came from a .tres', async () => {
    const seeded = loadedMaterials();
    const fake = createFakeResourceLoader();
    for (const [path, material] of seeded) fake.materials.seed(path, material);
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
    expect(shadowSideAfterPass(mesh, material)).toBe(THREE.DoubleSide);

    // The cached `.tres` material is shared by every node referencing it, so a
    // node's own cast_shadow must not be written onto it.
    expect(material).toBe(seeded.get(EXTERNAL_PATH));
    expect(material.shadowSide).toBeNull();
  });
});
