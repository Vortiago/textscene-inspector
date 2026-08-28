/**
 * `material_override` as the ArrayMesh renderer takes it.
 *
 * The property is a `Ref<Material>`: a reference that does not load as one is
 * null in Godot, so it is no override here either and the surfaces keep their
 * own materials. The two channels a slot can be filled through — a scene
 * `[sub_resource]` and a `res://` path — are what the return distinguishes.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveMaterialOverrideSource,
  resolveMaterialSubResources,
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
  resolveMaterialOverrideSource(ref, [material, shader], EXTERNAL);

describe('resolveMaterialOverrideSource', () => {
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

  it('is no override for a sub-resource that is not a StandardMaterial3D', () => {
    // The slot renders StandardMaterial3D scalars; anything else has no scalars
    // to read, and claiming the override would drop the surface's own material.
    expect(resolve('SubResource("Shader_1")')).toBeNull();
    expect(resolve('SubResource("Missing_1")')).toBeNull();
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
});

describe('resolveMaterialSubResources', () => {
  const boxMesh: TscnInternalResource = {
    id: 'Box_1',
    type: 'BoxMesh',
    data: { material: 'SubResource("Mat_1")' },
  };
  const resolveSlots = (materialOverride?: string, surface0?: string) =>
    resolveMaterialSubResources(
      {
        name: 'Mesh',
        mesh: 'SubResource("Box_1")',
        surfaceMaterialOverrides:
          surface0 === undefined
            ? new Map<number, string>()
            : new Map<number, string>([[0, surface0]]),
        materialOverride,
      },
      [boxMesh, material]
    );

  it("takes the mesh's own material when nothing overrides it", () => {
    expect(resolveSlots()).toEqual([material]);
  });

  it('takes the override ahead of the mesh-own material', () => {
    expect(resolveSlots('SubResource("Mat_1")')).toEqual([material]);
  });

  it("a null override is no override, so the mesh's own material survives", () => {
    // The parser stores the property's TEXT, and `"null"` is truthy — a `??`
    // chain that does not read the literal drops the mesh's material for a node
    // that overrides nothing.
    expect(resolveSlots('null')).toEqual([material]);
  });

  it('a null surface override is no override either, and falls through to it', () => {
    // The same cleared slot one term to the right in the same chain: the map
    // stores the property's TEXT, so `surface_material_override/0 = null` has
    // to fall through to the mesh's own material rather than shadow it.
    expect(resolveSlots(undefined, 'null')).toEqual([material]);
  });
});
