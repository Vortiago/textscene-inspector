/**
 * The resolution step alone: where a material reference points, and when it points
 * at nothing. `useMaterial.test.tsx` covers what loads from each source, and the
 * materialBag and meshinstance3d material tests cover what the material looks like.
 */
import { describe, expect, it } from 'vitest';
import { fileMaterialSources, resolveMaterialSource } from './materialSource';
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
const POOLS = { internalResources: INTERNAL, externalResources: EXTERNAL };

describe('resolveMaterialSource', () => {
  it('resolves a SubResource to the material it names, with the tables it resolves in', () => {
    expect(resolveMaterialSource('SubResource("Mat_body")', POOLS)).toEqual({
      kind: 'inline',
      material: { resource: INTERNAL[0], internalResources: INTERNAL, externalResources: EXTERNAL },
    });
  });

  it('takes a res:// path, such as a material inside a mesh .tres, as the file it names', () => {
    expect(resolveMaterialSource('res://rock.tres::Mat_1', POOLS)).toEqual({
      kind: 'file',
      path: 'res://rock.tres::Mat_1',
    });
    expect(resolveMaterialSource('res://paint.material', POOLS)).toBeUndefined();
  });

  it('resolves an ExtResource to the .tres file the loader reads', () => {
    expect(resolveMaterialSource('ExtResource("4")', POOLS)).toEqual({
      kind: 'file',
      path: 'res://materials/paint.tres',
    });
  });

  it('returns undefined for an absent reference', () => {
    expect(resolveMaterialSource(undefined, POOLS)).toBeUndefined();
    expect(resolveMaterialSource('', POOLS)).toBeUndefined();
  });

  it('returns undefined for a reference naming nothing the scene declares', () => {
    // Godot's fall-through when the RID is invalid: the surface keeps whatever it
    // had rather than going blank, so an unresolvable override must resolve to
    // "no source" and not to an empty one.
    expect(resolveMaterialSource('SubResource("Mat_missing")', POOLS)).toBeUndefined();
    expect(resolveMaterialSource('ExtResource("99")', POOLS)).toBeUndefined();
  });

  it('fills the slot for a Material it cannot build, and leaves it empty for a non-material', () => {
    // A ShaderMaterial is a material and the slot holding it was filled, so the
    // surface is Godot's default one rather than whatever the mesh already wore
    // (ADR-0041). `useMaterial` answers with that default. A sub-resource that is
    // no material at all leaves the slot empty instead.
    expect(resolveMaterialSource('SubResource("Shader_fx")', POOLS)).toEqual({
      kind: 'inline',
      material: { resource: INTERNAL[2], internalResources: INTERNAL, externalResources: EXTERNAL },
    });
    expect(resolveMaterialSource('SubResource("Mesh_box")', POOLS)).toBeUndefined();
  });

  it('returns undefined for an ExtResource that is not a .tres document', () => {
    expect(resolveMaterialSource('ExtResource("5")', POOLS)).toBeUndefined();
  });

  it('returns undefined for a value that is not a resource reference at all', () => {
    expect(resolveMaterialSource('Color(1, 0, 0, 1)', POOLS)).toBeUndefined();
  });

  it('returns undefined for a reference whose grammar is malformed', () => {
    // Unterminated: the id inside reads as a plausible one, so a resolver
    // matching loosely would resolve it.
    expect(resolveMaterialSource('SubResource("Mat_body"', POOLS)).toBeUndefined();
  });

  it('returns undefined when the scene declares no resources at all', () => {
    expect(
      resolveMaterialSource('SubResource("Mat_body")', { internalResources: [], externalResources: [] })
    ).toBeUndefined();
    expect(
      resolveMaterialSource('ExtResource("4")', { internalResources: [], externalResources: [] })
    ).toBeUndefined();
  });

  it('hands back the sub-resource by identity, unknown and garbage values intact', () => {
    // A lookup, not a validator: every property survives to the decode, which is
    // the one place that decides what a value means.
    const resolved = resolveMaterialSource('SubResource("Mat_odd")', POOLS);
    expect(resolved?.kind === 'inline' && resolved.material.resource).toBe(INTERNAL[1]);
    expect(INTERNAL[1]?.data).toEqual({
      metallic: '0.75',
      metallic_specular: 'garbage-not-a-number',
      some_future_key: 'x',
    });
  });
});

describe('fileMaterialSources', () => {
  it('turns each material path into a file source, in order', () => {
    expect(fileMaterialSources(['res://a.tres', 'res://mesh.tres::Mat'])).toEqual([
      { kind: 'file', path: 'res://a.tres' },
      { kind: 'file', path: 'res://mesh.tres::Mat' },
    ]);
  });

  it('keeps a surface with no material as undefined, so its slot draws the default', () => {
    expect(fileMaterialSources([null, 'res://a.tres'])).toEqual([
      undefined,
      { kind: 'file', path: 'res://a.tres' },
    ]);
  });

  it('leaves a material that is no .tres document undefined, as an ExtResource reference does', () => {
    expect(fileMaterialSources(['res://materials/paint.material'])).toEqual([undefined]);
  });

  it('returns no sources for a mesh with no surfaces', () => {
    expect(fileMaterialSources([])).toEqual([]);
  });
});
