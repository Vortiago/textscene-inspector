/**
 * Edge cases for resolveStandardMaterial: the SubResource("id") → material
 * resource funnel shared by MeshInstance3D / CSGBox3D / CSGCylinder3D.
 * Property → THREE.Material mapping is covered by the meshinstance3d
 * Component.material-*.test files; this pins the resolution step alone.
 */
import { describe, expect, it } from 'vitest';
import { resolveStandardMaterial } from './resolveStandardMaterial';
import type { TscnInternalResource } from '../../parser/types';

const minimalMaterial: TscnInternalResource = {
  id: 'StandardMaterial3D_min',
  type: 'StandardMaterial3D',
  data: {}, // all Godot defaults — omitted properties stay omitted
};

const fullMaterial: TscnInternalResource = {
  id: 'StandardMaterial3D_full',
  type: 'StandardMaterial3D',
  data: {
    albedo_color: 'Color(0.2, 0.4, 0.6, 1)',
    metallic: '0.75',
    roughness: '0.1',
    emission_enabled: 'true',
    emission: 'Color(1, 0.5, 0, 1)',
    transparency: '1',
    // Unknown/garbage values must survive resolution untouched — the
    // resolver is a lookup, not a validator.
    metallic_specular: 'garbage-not-a-number',
    some_future_property: 'whatever',
  },
};

const resources: TscnInternalResource[] = [
  minimalMaterial,
  fullMaterial,
  { id: 'BoxMesh_b', type: 'BoxMesh', data: {} },
];

describe('resolveStandardMaterial', () => {
  it('returns undefined for a missing (undefined) ref', () => {
    expect(resolveStandardMaterial(undefined, resources)).toBeUndefined();
  });

  it('returns undefined for an empty-string ref', () => {
    expect(resolveStandardMaterial('', resources)).toBeUndefined();
  });

  it('returns undefined for garbage that is not a resource reference', () => {
    expect(resolveStandardMaterial('SubResource(StandardMaterial3D_min', resources)).toBeUndefined();
  });

  it('returns undefined for an ExtResource ref (only SubResources resolve)', () => {
    expect(resolveStandardMaterial('ExtResource("2_mat")', resources)).toBeUndefined();
  });

  it('returns undefined for an unknown SubResource id', () => {
    expect(resolveStandardMaterial('SubResource("StandardMaterial3D_gone")', resources)).toBeUndefined();
  });

  it('returns undefined when the id resolves to a non-material SubResource', () => {
    expect(resolveStandardMaterial('SubResource("BoxMesh_b")', resources)).toBeUndefined();
  });

  it('resolves a minimal material (all defaults) by identity', () => {
    const resolved = resolveStandardMaterial('SubResource("StandardMaterial3D_min")', resources);
    expect(resolved).toBe(minimalMaterial);
    expect(resolved!.data).toEqual({});
  });

  it('resolves a full payload by identity, leaving unknown/garbage values intact', () => {
    const resolved = resolveStandardMaterial('SubResource("StandardMaterial3D_full")', resources);
    expect(resolved).toBe(fullMaterial);
    expect(resolved!.data.metallic).toBe('0.75');
    expect(resolved!.data.metallic_specular).toBe('garbage-not-a-number');
    expect(resolved!.data.some_future_property).toBe('whatever');
  });

  it('returns undefined when the resource list is empty', () => {
    expect(resolveStandardMaterial('SubResource("StandardMaterial3D_min")', [])).toBeUndefined();
  });
});
