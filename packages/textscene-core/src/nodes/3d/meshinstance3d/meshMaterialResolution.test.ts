/**
 * The material references a MeshInstance3D holds, as slot sources.
 *
 * Every slot is a `Ref<Material>`: a reference that does not load as one is
 * null in Godot, so it fills nothing here either and the next layer of the
 * precedence is what the surface keeps. The two channels a slot can be filled
 * through — a scene `[sub_resource]` and a `res://` path — are what the return
 * distinguishes.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveMaterialSlotSource,
  resolvePrimitiveMaterialSlot,
} from './meshMaterialResolution';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';

const material: TscnInternalResource = {
  id: 'Mat_1',
  type: 'StandardMaterial3D',
  data: { albedo_color: 'Color(1, 0, 0, 1)' },
};
const shader: TscnInternalResource = { id: 'Shader_1', type: 'ShaderMaterial', data: {} };

const EXTERNAL: TscnExternalResource[] = [
  { id: '1_mat', path: 'res://body.tres', type: 'Material' },
  { id: '2_tex', path: 'res://body.png', type: 'Texture2D' },
  { id: '3_sky', path: 'res://sky.tres', type: 'Sky' },
  { id: '4_shader', path: 'res://body.tres', type: 'ShaderMaterial' },
  { id: '5_untyped', path: 'res://body.tres', type: '' },
];

const resolve = (ref: string | undefined) =>
  resolveMaterialSlotSource(ref, [material, shader], EXTERNAL);

describe('resolveMaterialSlotSource', () => {
  it('hands back a scene sub-resource already resolved', () => {
    expect(resolve('SubResource("Mat_1")')).toEqual({ subResource: material });
  });

  it('hands back the res:// path of a declared ExtResource', () => {
    expect(resolve('ExtResource("1_mat")')).toEqual({ path: 'res://body.tres' });
  });

  it('is no override for a bare res:// path, which the slot cannot hold', () => {
    // Unquoted it is an identifier and the whole file fails to parse
    // (variant_parser.cpp:1619); quoted it is a STRING, which
    // `can_convert_strict` refuses for an OBJECT slot (variant.cpp:731-737).
    expect(resolve('res://body.tres')).toBeNull();
    expect(resolve('"res://body.tres"')).toBeNull();
  });

  it('is no override when the property is absent', () => {
    expect(resolve(undefined)).toBeNull();
    expect(resolve('')).toBeNull();
  });

  it('is no override for an ExtResource id the scene never declares', () => {
    expect(resolve('ExtResource("9_gone")')).toBeNull();
  });

  it('fills the slot for a Material sub-resource this previewer cannot draw', () => {
    // A ShaderMaterial loads in Godot and replaces what is under it, so the
    // slot is TAKEN. Neither channel is set, which paints the default — falling
    // through instead would draw the layer the engine hides.
    expect(resolve('SubResource("Shader_1")')).toEqual({});
  });

  it('is no override for a sub-resource id the scene never declares', () => {
    expect(resolve('SubResource("Missing_1")')).toBeNull();
  });

  it('is no override for a sub-resource that is no Material at all', () => {
    // A `Ref<Material>` that cannot hold what the reference names is null in
    // Godot too, so the layer below it is what the surface keeps.
    expect(
      resolveMaterialSlotSource(
        'SubResource("Box_9")',
        [{ id: 'Box_9', type: 'BoxMesh', data: {} }],
        EXTERNAL
      )
    ).toBeNull();
  });

  it('is no override for a bare null literal', () => {
    expect(resolve('null')).toBeNull();
  });

  it('is no override for a .tres the heading declares as something else', () => {
    // The extension is the container, not the type: a Sky saved as text is a
    // `.tres` that resolves to no material, and the slot would then paint
    // default white over EVERY surface.
    expect(resolve('ExtResource("3_sky")')).toBeNull();
  });

  it('takes an ExtResource whose declared type descends from Material', () => {
    expect(resolve('ExtResource("4_shader")')).toEqual({ path: 'res://body.tres' });
  });

  it('falls back to the path when the heading declares no type at all', () => {
    // Godot always writes `type=`, so a heading without one is hand-written and
    // there is no type-level answer to fall back on.
    expect(resolve('ExtResource("5_untyped")')).toEqual({ path: 'res://body.tres' });
  });

  it('is no override for an ExtResource that is not a material file', () => {
    // A `.png` reaching the material pipeline resolves to nothing, and the slot
    // then paints default white over EVERY surface — the opposite of what an
    // unloadable `Ref<Material>` does in Godot.
    expect(resolve('ExtResource("2_tex")')).toBeNull();
  });

  it('fills the slot for a declared material whose file it cannot build', () => {
    // The heading names a Material, so Godot loads it and the slot is taken;
    // only the drawing is missing, and the chain must not step past it.
    expect(
      resolveMaterialSlotSource('ExtResource("6_binary")', [], [
        { id: '6_binary', path: 'res://body.material', type: 'Material' },
      ])
    ).toEqual({});
  });
});

describe('resolvePrimitiveMaterialSlot', () => {
  const boxMesh: TscnInternalResource = {
    id: 'Box_1',
    type: 'BoxMesh',
    data: { material: 'SubResource("Mat_1")' },
  };
  const resolveSlot = (materialOverride?: string, surfaces?: Array<[number, string]>) =>
    resolvePrimitiveMaterialSlot(
      {
        name: 'Mesh',
        mesh: 'SubResource("Box_1")',
        surfaceMaterialOverrides: new Map<number, string>(surfaces ?? []),
        materialOverride,
      },
      [boxMesh, material, shader],
      EXTERNAL
    );

  it("takes the mesh's own material when nothing overrides it", () => {
    expect(resolveSlot()).toEqual({ subResource: material });
  });

  it('takes the override ahead of the mesh-own material', () => {
    expect(resolveSlot('SubResource("Mat_1")')).toEqual({ subResource: material });
  });

  it('an undrawable override still hides the mesh-own material', () => {
    // `material_override` wins over the mesh's own material in Godot
    // (`render_forward_clustered.cpp:4206`), and an ORMMaterial3D is a
    // BaseMaterial3D that loads there. Falling through to the mesh's red
    // material would draw the one surface Godot is covering up.
    expect(
      resolvePrimitiveMaterialSlot(
        {
          name: 'Mesh',
          mesh: 'SubResource("Box_1")',
          surfaceMaterialOverrides: new Map<number, string>(),
          materialOverride: 'SubResource("Orm_1")',
        },
        [boxMesh, material, { id: 'Orm_1', type: 'ORMMaterial3D', data: {} }],
        EXTERNAL
      )
    ).toEqual({});
  });

  it("a null override is no override, so the mesh's own material survives", () => {
    // The parser stores the property's TEXT, and `"null"` is truthy — a `??`
    // chain that does not read the literal drops the mesh's material for a node
    // that overrides nothing.
    expect(resolveSlot('null')).toEqual({ subResource: material });
  });

  it('a null surface override is no override either, and falls through to it', () => {
    // The same cleared slot one term to the right in the same chain: the map
    // stores the property's TEXT, so `surface_material_override/0 = null` has
    // to fall through to the mesh's own material rather than shadow it.
    expect(resolveSlot(undefined, [[0, 'null']])).toEqual({ subResource: material });
  });

  it('resolves an ExtResource surface override to its path', () => {
    // Every IK demo's floor is this: `surface_material_override/0` naming a
    // `.tres`. Routed through SubResource resolution alone it named nothing and
    // the plane drew Godot's default grey.
    expect(resolveSlot(undefined, [[0, 'ExtResource("1_mat")']])).toEqual({
      path: 'res://body.tres',
    });
  });

  it('resolves an ExtResource material_override to its path', () => {
    expect(resolveSlot('ExtResource("1_mat")')).toEqual({ path: 'res://body.tres' });
  });

  it('falls through an override that names no material to the surface override', () => {
    // A `Ref<Material>` that does not load is null in Godot, so the layer below
    // is what the surface keeps — an override naming a `.png` must not blank the
    // surface's own material.
    expect(resolveSlot('ExtResource("2_tex")', [[0, 'SubResource("Mat_1")']])).toEqual({
      subResource: material,
    });
  });

  it('drops surface_material_override/N for N > 0 — a PrimitiveMesh has one surface', () => {
    // `_mesh_changed` sizes `surface_override_materials` to the mesh's surface
    // count (mesh_instance_3d.cpp:407), which is 1 for every PrimitiveMesh
    // (primitive_meshes.cpp:141-147), and `_set` returns false for
    // `idx >= size()` (mesh_instance_3d.cpp:68).
    expect(resolveSlot(undefined, [[1, 'SubResource("Shader_1")']])).toEqual({
      subResource: material,
    });
  });

  it('handles a surface index far beyond any real surface count', () => {
    // Sized off the mesh rather than off the map's largest key, so a sparse
    // index is a lookup miss and never an allocation.
    expect(resolveSlot(undefined, [[200000, 'SubResource("Mat_1")']])).toEqual({
      subResource: material,
    });
  });
});
