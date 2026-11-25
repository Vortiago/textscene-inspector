import { describe, it, expect } from 'vitest';
import { formatMeshInstance3DProperties } from './propertyFormatter';
import { SCENE_PATH, sectionIn } from '../../testing/inspectedScene';

const RESOURCES = {
  ext: { '1_mat': 'Material', '2_mat': 'Material' },
  sub: { BoxMesh_1: 'BoxMesh', Skin_1: 'Skin' },
};

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionIn(formatMeshInstance3DProperties, 'MeshInstance3D', title, properties, RESOURCES);
}

describe('formatMeshInstance3DProperties', () => {
  it("lists Godot's default cast shadow when the file sets none", async () => {
    expect((await section('Mesh'))!.items).toEqual([{ label: 'Cast Shadow', value: 'ON' }]);
  });

  it('lists the mesh path the file sets', async () => {
    const mesh = await section('Mesh', { mesh: 'SubResource("BoxMesh_1")' });
    expect(mesh!.items).toContainEqual({ label: 'Mesh', value: `${SCENE_PATH}::BoxMesh_1` });
  });

  it('names each cast_shadow, and an unknown one by its number', async () => {
    const labelFor = async (castShadow: string) =>
      (await section('Mesh', { cast_shadow: castShadow }))!.items.find((i) => i.label === 'Cast Shadow')!
        .value;

    expect(await labelFor('0')).toBe('OFF');
    expect(await labelFor('1')).toBe('ON');
    expect(await labelFor('2')).toBe('DOUBLE_SIDED');
    expect(await labelFor('3')).toBe('SHADOWS_ONLY');
    expect(await labelFor('9')).toBe('Unknown (9)');
  });

  it('lists the skeleton path and the skin path the file sets', async () => {
    const mesh = await section('Mesh', {
      skeleton: 'NodePath("../Skeleton3D")',
      skin: 'SubResource("Skin_1")',
    });
    expect(mesh!.items).toContainEqual({ label: 'Skeleton', value: '../Skeleton3D' });
    expect(mesh!.items).toContainEqual({ label: 'Skin', value: `${SCENE_PATH}::Skin_1` });
  });

  it('lists no Material Overrides section when the file sets no surface_material_override/N', async () => {
    expect(await section('Material Overrides')).toBeUndefined();
  });

  it('lists each surface_material_override/N the file sets on a surface the mesh has', async () => {
    const overrides = await section('Material Overrides', {
      mesh: 'SubResource("BoxMesh_1")',
      'surface_material_override/0': 'ExtResource("1_mat")',
      'surface_material_override/2': 'ExtResource("2_mat")',
    });
    expect(overrides!.items).toEqual([{ label: 'Surface 0', value: 'res://1_mat' }]);
  });

  it('lists no override of a node without a mesh, as Godot holds none', async () => {
    expect(
      await section('Material Overrides', { 'surface_material_override/0': 'ExtResource("1_mat")' })
    ).toBeUndefined();
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 4, 5, 6)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Rotation (degrees)', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});
