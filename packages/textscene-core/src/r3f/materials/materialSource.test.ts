import { describe, expect, it } from 'vitest';
import { resolveMaterialSource } from './materialSource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';

const INTERNAL: TscnInternalResource[] = [
  { id: 'Mat_body', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Shader_fx', type: 'ShaderMaterial', data: {} },
  { id: 'Mesh_box', type: 'BoxMesh', data: {} },
];

const EXTERNAL: TscnExternalResource[] = [
  { id: '4', path: 'res://materials/paint.tres', type: 'Material' },
  { id: '5', path: 'res://models/truck.glb', type: 'PackedScene' },
];

describe('resolveMaterialSource', () => {
  it('resolves a SubResource to the scene material it names', () => {
    expect(resolveMaterialSource('SubResource("Mat_body")', INTERNAL, EXTERNAL)).toEqual({
      kind: 'scene',
      resource: INTERNAL[0],
    });
  });

  it('resolves an ExtResource to the .tres path the pipeline loads', () => {
    expect(resolveMaterialSource('ExtResource("4")', INTERNAL, EXTERNAL)).toEqual({
      kind: 'path',
      path: 'res://materials/paint.tres',
    });
  });

  it('returns undefined for an absent reference', () => {
    expect(resolveMaterialSource(undefined, INTERNAL, EXTERNAL)).toBeUndefined();
    expect(resolveMaterialSource('', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('returns undefined for a reference naming nothing the scene declares', () => {
    // Godot's fall-through when the RID is invalid: the surface keeps whatever it
    // had rather than going blank, so an unresolvable override must resolve to
    // "no source" and not to an empty one.
    expect(resolveMaterialSource('SubResource("Mat_missing")', INTERNAL, EXTERNAL)).toBeUndefined();
    expect(resolveMaterialSource('ExtResource("99")', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('returns undefined for a sub-resource that is not a StandardMaterial3D', () => {
    expect(resolveMaterialSource('SubResource("Shader_fx")', INTERNAL, EXTERNAL)).toBeUndefined();
    expect(resolveMaterialSource('SubResource("Mesh_box")', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('returns undefined for an ExtResource that is not a .tres document', () => {
    expect(resolveMaterialSource('ExtResource("5")', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('returns undefined for a value that is not a resource reference at all', () => {
    expect(resolveMaterialSource('Color(1, 0, 0, 1)', INTERNAL, EXTERNAL)).toBeUndefined();
  });
});
