import { describe, it, expect } from 'vitest';
import { formatDecalProperties } from './propertyFormatter';
import { sectionIn } from '../../testing/inspectedScene';

const TEXTURES = {
  '1_albedo': 'Texture2D',
  '2_normal': 'Texture2D',
  '3_orm': 'Texture2D',
  '4_emission': 'Texture2D',
};

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionIn(formatDecalProperties, 'Decal', title, properties, { ext: TEXTURES });
}

describe('formatDecalProperties', () => {
  it('names an empty albedo as none and lists no other texture of a node that sets none', async () => {
    expect((await section('Textures'))!.items).toEqual([{ label: 'Albedo', value: '(none)' }]);
  });

  it('lists the path of each texture the file sets', async () => {
    const textures = await section('Textures', {
      texture_albedo: 'ExtResource("1_albedo")',
      texture_normal: 'ExtResource("2_normal")',
      texture_orm: 'ExtResource("3_orm")',
      texture_emission: 'ExtResource("4_emission")',
    });
    expect(textures!.items).toEqual([
      { label: 'Albedo', value: 'res://1_albedo' },
      { label: 'Normal', value: 'res://2_normal' },
      { label: 'ORM', value: 'res://3_orm' },
      { label: 'Emission', value: 'res://4_emission' },
    ]);
  });

  it('lists the Godot defaults in the Projection section', async () => {
    expect((await section('Projection'))!.items).toEqual([
      { label: 'Size', value: '(2, 2, 2)' },
      { label: 'Modulate', value: 'rgba(255, 255, 255, 1.00)' },
      { label: 'Albedo Mix', value: '1.00' },
      { label: 'Normal Fade', value: '0.00' },
      { label: 'Upper Fade', value: '0.30' },
      { label: 'Lower Fade', value: '0.30' },
      { label: 'Cull Mask', value: '0xfffff' },
    ]);
  });

  it('lists the projection values the file sets, the cull mask in hex', async () => {
    const projection = await section('Projection', {
      size: 'Vector3(4, 1, 4)',
      modulate: 'Color(1, 0, 0, 0.5)',
      albedo_mix: '0.5',
      normal_fade: '0.2',
      upper_fade: '0.1',
      lower_fade: '0.9',
      cull_mask: '255',
    });
    expect(projection!.items).toEqual([
      { label: 'Size', value: '(4, 1, 4)' },
      { label: 'Modulate', value: 'rgba(255, 0, 0, 0.50)' },
      { label: 'Albedo Mix', value: '0.50' },
      { label: 'Normal Fade', value: '0.20' },
      { label: 'Upper Fade', value: '0.10' },
      { label: 'Lower Fade', value: '0.90' },
      { label: 'Cull Mask', value: '0xff' },
    ]);
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 3, 0)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});
