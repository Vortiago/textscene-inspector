import { describe, expect, it } from 'vitest';
import { hasGeometryBase } from './geometryBase';

describe('hasGeometryBase', () => {
  it('gives a MeshInstance3D with a mesh a base', () => {
    expect(hasGeometryBase('MeshInstance3D', { mesh: 'SubResource("BoxMesh_1")' }, null)).toBe(true);
  });

  it('gives a MeshInstance3D without a mesh none, and one with a null mesh none (error case)', () => {
    expect([
      hasGeometryBase('MeshInstance3D', {}, null),
      hasGeometryBase('MeshInstance3D', { mesh: 'null' }, null),
    ]).toEqual([false, false]);
  });

  it('follows MeshInstance3D for a SoftBody3D (edge case)', () => {
    expect(hasGeometryBase('SoftBody3D', { mesh: 'ExtResource("1")' }, null)).toBe(true);
  });

  it('gives a MultiMeshInstance3D a base only with a multimesh', () => {
    expect([
      hasGeometryBase('MultiMeshInstance3D', { multimesh: 'SubResource("MultiMesh_1")' }, null),
      hasGeometryBase('MultiMeshInstance3D', {}, null),
    ]).toEqual([true, false]);
  });

  it('gives a Sprite3D a base only with a texture', () => {
    expect([
      hasGeometryBase('Sprite3D', { texture: 'ExtResource("1")' }, null),
      hasGeometryBase('Sprite3D', {}, null),
    ]).toEqual([true, false]);
  });

  it('gives Label3D, AnimatedSprite3D and both particle nodes a base whatever they hold', () => {
    const types = ['Label3D', 'AnimatedSprite3D', 'CPUParticles3D', 'GPUParticles3D'];
    expect(types.map((type) => hasGeometryBase(type, {}, null))).toEqual([true, true, true, true]);
  });

  it('gives a CSG root a base, and a CSG shape under another CSG shape none', () => {
    expect([
      hasGeometryBase('CSGBox3D', {}, 'Node3D'),
      hasGeometryBase('CSGBox3D', {}, null),
      hasGeometryBase('CSGSphere3D', {}, 'CSGCombiner3D'),
    ]).toEqual([true, true, false]);
  });

  it('gives a bare GeometryInstance3D none (edge case)', () => {
    expect(hasGeometryBase('GeometryInstance3D', {}, null)).toBe(false);
  });
});
