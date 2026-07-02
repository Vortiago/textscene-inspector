import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseDecal } from './parser';

describe('parseDecal', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseDecal(heading('Decal', { name: 'MyDecal', parent: '.' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)',
    });
    expect(result.name).toBe('MyDecal');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('parses albedo, size, modulate, albedo_mix, and cull_mask', () => {
    const result = parseDecal(heading('Decal', { name: 'D' }), {
      texture_albedo: 'ExtResource("1_tex")',
      size: 'Vector3(3, 2, 4)',
      modulate: 'Color(1, 0.5, 0.25, 0.8)',
      albedo_mix: '0.7',
      cull_mask: '15',
    });
    expect(result.texture_albedo).toBe('ExtResource("1_tex")');
    expect(result.size).toEqual({ x: 3, y: 2, z: 4 });
    expect(result.modulate).toEqual({ r: 1, g: 0.5, b: 0.25, a: 0.8 });
    expect(result.albedo_mix).toBe(0.7);
    expect(result.cull_mask).toBe(15);
  });

  it('parses the optional normal/orm/emission texture references', () => {
    const result = parseDecal(heading('Decal', { name: 'D' }), {
      texture_normal: 'ExtResource("2_n")',
      texture_orm: 'ExtResource("3_orm")',
      texture_emission: 'ExtResource("4_e")',
    });
    expect(result.texture_normal).toBe('ExtResource("2_n")');
    expect(result.texture_orm).toBe('ExtResource("3_orm")');
    expect(result.texture_emission).toBe('ExtResource("4_e")');
  });

  it('applies Godot defaults when properties are omitted (edge case)', () => {
    const result = parseDecal(heading('Decal', { name: 'D' }), {});
    expect(result.texture_albedo).toBeUndefined();
    expect(result.size).toEqual({ x: 2, y: 2, z: 2 });
    expect(result.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(result.albedo_mix).toBe(1);
    expect(result.emission_energy).toBe(1);
    expect(result.normal_fade).toBe(0);
    expect(result.upper_fade).toBe(0.3);
    expect(result.lower_fade).toBe(0.3);
    expect(result.cull_mask).toBe(0xfffff);
  });

  it('falls back to the default size on a malformed size (error path)', () => {
    const result = parseDecal(heading('Decal', { name: 'Bad' }), {
      size: 'Vector3(not, valid)',
    });
    expect(result.size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseDecal(heading('Decal', { name: 'Bad' }), {
      transform: 'Transform3D(not, valid)',
    });
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseDecal({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });
});
