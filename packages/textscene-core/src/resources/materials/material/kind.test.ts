/**
 * The `MATERIAL` kind passes the table test every kind passes (ADR-0071), and declines every
 * Material class the previewer does not build, the same from either arrival (ADR-0041).
 */
import { describe, expect, it } from 'vitest';
import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { loadedValue, sceneTables } from '../../reading/reading.testkit';
import { nodeReference } from '../../reading';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { MATERIAL } from './kind';
import type { Material } from './types';

/**
 * The material as plain data. A reference keeps only what it names: its tables differ by origin,
 * and the value they resolve to is read by the texture kind.
 */
function summary(material: Material): unknown {
  if (material.form === 'declined') return material;
  if (material.form === 'sky') return { type: material.type, panorama: material.panorama?.ref };
  const textures = Object.entries(material.textures).map(([slot, reference]) => [slot, reference.ref]);
  return { albedo: material.data.albedo, textures, nextPass: material.nextPass?.ref };
}

const PAINT =
  'albedo_color = Color(1, 0, 0, 1)\nnormal_enabled = true\nnormal_texture = SubResource("missing")';

describeKindFromEveryOrigin([
  {
    kind: MATERIAL,
    className: 'StandardMaterial3D',
    body: PAINT,
    expected: {
      albedo: [1, 0, 0],
      textures: [['normal_texture', 'SubResource("missing")']],
      nextPass: undefined,
    },
    summarise: summary,
  },
  {
    kind: MATERIAL,
    className: 'ORMMaterial3D',
    body: 'albedo_color = Color(0.1, 0.3, 0.9, 1)',
    expected: { form: 'declined', type: 'ORMMaterial3D' },
  },
  {
    kind: MATERIAL,
    className: 'PanoramaSkyMaterial',
    body: 'panorama = ExtResource("1_sky")',
    expected: { type: 'PanoramaSkyMaterial', panorama: 'ExtResource("1_sky")' },
    summarise: summary,
  },
  {
    kind: MATERIAL,
    className: 'ShaderMaterial',
    body: '',
    expected: { form: 'declined', type: 'ShaderMaterial' },
  },
]);

describe('MATERIAL of a StandardMaterial3D', () => {
  const materialAt = (body: string) => {
    const material = loadedValue(
      MATERIAL,
      'SubResource("m")',
      `[sub_resource type="StandardMaterial3D" id="m"]\n${body}\n`
    );
    if (material.form !== 'standard') throw new Error(`expected a StandardMaterial3D, got ${material.type}`);
    return material;
  };

  it('hands on no slot whose feature gate is off, as Godot samples none', () => {
    expect(materialAt('normal_texture = SubResource("map")').textures).toEqual({});
  });

  it('holds a slot below a material that is not local to scene as shared', () => {
    expect(materialAt('albedo_texture = SubResource("map")').textures.albedo_texture?.isHeldLocally).toBe(
      false
    );
  });

  it('holds a slot below a material that is local to scene as the node holds it', () => {
    const material = materialAt('resource_local_to_scene = true\nalbedo_texture = SubResource("map")');

    expect(material.textures.albedo_texture?.isHeldLocally).toBe(true);
  });
});

describe('MATERIAL of a resource that is no Material', () => {
  it('refuses it as the wrong type', () => {
    const scene = sceneTables('[sub_resource type="BoxMesh" id="m"]\n');

    expect(staticSnapshot({}).read(nodeReference('SubResource("m")', scene), MATERIAL)).toMatchObject({
      status: 'unavailable',
      reason: 'wrong-type',
    });
  });
});
