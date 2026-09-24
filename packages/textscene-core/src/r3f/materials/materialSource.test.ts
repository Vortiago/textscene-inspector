/**
 * The resolution step alone: which of the two arrivals a material reference names,
 * and when it names neither. The materialBag and meshinstance3d material tests cover
 * what the resolved material looks like.
 */
import { describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import { resolveMaterialSource } from './materialSource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';

const INTERNAL: TscnInternalResource[] = [
  { id: 'Mat_body', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  {
    id: 'Mat_odd',
    type: 'StandardMaterial3D',
    data: { metallic: '0.75', metallic_specular: 'garbage-not-a-number', some_future_key: 'x' },
  },
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

  it('answers with the default surface for a Material it cannot build', () => {
    // A ShaderMaterial is a material and the slot holding it was filled, so the
    // surface is Godot's default one rather than whatever the mesh already wore
    // (ADR-0041). A sub-resource that is no material at all leaves the slot
    // empty instead.
    expect(resolveMaterialSource('SubResource("Shader_fx")', INTERNAL, EXTERNAL)).toEqual({
      kind: 'default',
    });
    expect(resolveMaterialSource('SubResource("Mesh_box")', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('says so when it declines a shader, as the .tres arrival does', () => {
    // Both arrivals draw Godot's default surface, so the warning is the only
    // sign a shader was skipped, and both arrivals give it.
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      resolveMaterialSource('SubResource("Shader_fx")', INTERNAL, EXTERNAL);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('ShaderMaterial');

      // A sub-resource that is not a material names a defect in the scene, not
      // a missing capability, so nothing is reported.
      warn.mockClear();
      resolveMaterialSource('SubResource("Mesh_box")', INTERNAL, EXTERNAL);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('returns undefined for an ExtResource that is not a .tres document', () => {
    expect(resolveMaterialSource('ExtResource("5")', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('returns undefined for a value that is not a resource reference at all', () => {
    expect(resolveMaterialSource('Color(1, 0, 0, 1)', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('returns undefined for a reference whose grammar is malformed', () => {
    // Unterminated: the id inside reads as a plausible one, so a resolver
    // matching loosely would resolve it.
    expect(resolveMaterialSource('SubResource("Mat_body"', INTERNAL, EXTERNAL)).toBeUndefined();
  });

  it('returns undefined when the scene declares no resources at all', () => {
    expect(resolveMaterialSource('SubResource("Mat_body")', [], [])).toBeUndefined();
    expect(resolveMaterialSource('ExtResource("4")', [], [])).toBeUndefined();
  });

  it('hands back the sub-resource by identity, unknown and garbage values intact', () => {
    // A lookup, not a validator: every property survives to the decode, which is
    // the one place that decides what a value means.
    const resolved = resolveMaterialSource('SubResource("Mat_odd")', INTERNAL, EXTERNAL);
    expect(resolved).toEqual({ kind: 'scene', resource: INTERNAL[1] });
    expect((resolved as { resource: TscnInternalResource }).resource.data).toEqual({
      metallic: '0.75',
      metallic_specular: 'garbage-not-a-number',
      some_future_key: 'x',
    });
  });
});
