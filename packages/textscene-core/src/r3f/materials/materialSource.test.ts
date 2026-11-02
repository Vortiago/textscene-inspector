/**
 * The resolution step alone: where a material reference points, and when it points
 * at nothing. `useMaterial.test.tsx` covers what loads from each source, and the
 * materialBag and meshinstance3d material tests cover what the material looks like.
 */
import { describe, expect, it } from 'vitest';
import {
  fileMaterialSources,
  materialSourceKey,
  resolveMaterialSource,
  resolveNextPass,
} from './materialSource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import '../../resources/formats/binaryresource/index';
import { isLocalToScene } from '../../resources/textures/viewporttexture/localToScene';

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
  { id: '6', path: 'res://materials/paint.material', type: 'StandardMaterial3D' },
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
    expect(resolveMaterialSource('res://paint.png', POOLS)).toBeUndefined();
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

  it('resolves an ExtResource to a binary .material file the loader reads', () => {
    expect(resolveMaterialSource('ExtResource("6")', POOLS)).toEqual({
      kind: 'file',
      path: 'res://materials/paint.material',
    });
  });

  it('returns undefined for an ExtResource that is not a resource file', () => {
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

describe('a material a mesh holds', () => {
  const mesh = { id: 'Mesh_box', type: 'BoxMesh', data: {} };

  it('is held as the mesh holds it, not local to scene', () => {
    expect(resolveMaterialSource('SubResource("Mat_body")', POOLS, isLocalToScene(mesh))).toMatchObject({
      kind: 'inline',
      isHeldLocally: false,
    });
  });

  it('is held as the mesh holds it in a mesh file', () => {
    expect(fileMaterialSources(['res://a.tres'], isLocalToScene(mesh))).toEqual([
      { kind: 'file', path: 'res://a.tres', isHeldLocally: false },
    ]);
  });

  it('states nothing for the node property itself', () => {
    expect(resolveMaterialSource('SubResource("Mat_body")', POOLS)).not.toHaveProperty('isHeldLocally');
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

  it('takes a material inside a binary .res mesh as a file source', () => {
    expect(fileMaterialSources(['res://mesh.res::Mat'])).toEqual([
      { kind: 'file', path: 'res://mesh.res::Mat' },
    ]);
  });

  it('leaves a material that is no resource file undefined, as an ExtResource reference does', () => {
    expect(fileMaterialSources(['res://materials/paint.png'])).toEqual([undefined]);
  });

  it('returns no sources for a mesh with no surfaces', () => {
    expect(fileMaterialSources([])).toEqual([]);
  });
});

/**
 * One link of the `next_pass` chain, as `render_forward_clustered.cpp:4189`'s
 * `while (material->next_pass.is_valid())` walks it: the reference resolves in the
 * tables of the file the material is written in, and a link that names nothing
 * material ends the walk.
 */
describe('resolveNextPass', () => {
  const CHAIN: TscnInternalResource[] = [
    { id: 'M1', type: 'StandardMaterial3D', data: { next_pass: 'SubResource("M2")' } },
    { id: 'M2', type: 'StandardMaterial3D', data: { next_pass: 'SubResource("M3")' } },
    { id: 'M3', type: 'StandardMaterial3D', data: {} },
  ];
  const POOLS = { internalResources: CHAIN, externalResources: [] };

  it('resolves no link for a material with no next_pass', () => {
    expect(resolveNextPass(undefined, { resource: CHAIN[2]!, ...POOLS })).toBeUndefined();
  });

  it('walks a chain of two and a chain of three, in link order', () => {
    // Inline links resolve synchronously, so the walk is pure: each step reads
    // the source it hands back.
    const link1 = resolveNextPass('SubResource("M2")', { resource: CHAIN[0]!, ...POOLS });
    expect(link1).toEqual({
      kind: 'inline',
      material: { resource: CHAIN[1], internalResources: CHAIN, externalResources: [] },
    });
    if (!link1 || link1.kind !== 'inline') throw new Error('the first link did not resolve');
    const link2 = resolveNextPass(link1.material.resource.data.next_pass, link1.material);
    expect(link2).toEqual({
      kind: 'inline',
      material: { resource: CHAIN[2], internalResources: CHAIN, externalResources: [] },
    });
  });

  it('ends the chain on a link naming no declared sub-resource', () => {
    // Godot's loop guard `!material` (`render_forward_clustered.cpp:4192`): a
    // missing link leaves the surface to the draws it already has.
    expect(resolveNextPass('SubResource("M_missing")', { resource: CHAIN[0]!, ...POOLS })).toBeUndefined();
  });

  it('ends the chain on a link naming a non-material sub-resource', () => {
    // `resolveMaterialSource` refuses it, exactly as it refuses a non-material
    // surface material: the slot stays empty.
    expect(
      resolveNextPass('SubResource("Mesh_box")', {
        resource: CHAIN[0]!,
        internalResources: [...CHAIN, { id: 'Mesh_box', type: 'BoxMesh', data: {} }],
        externalResources: [],
      })
    ).toBeUndefined();
  });

  it('ends the chain on a malformed reference', () => {
    expect(resolveNextPass('SubResource("M2"', { resource: CHAIN[0]!, ...POOLS })).toBeUndefined();
  });

  it("carries the material's held-ness to the link", () => {
    // The chain link's textures resolve in the file that owns it, so a material
    // a non-local mesh holds passes the flag down.
    const link = resolveNextPass('SubResource("M2")', {
      resource: CHAIN[0]!,
      ...POOLS,
      isHeldLocally: false,
    });
    expect(link).toMatchObject({ kind: 'inline', isHeldLocally: false });
  });

  it('resolves an ExtResource link by the tables of the file the material is written in', () => {
    // The surface's file holds no such ext resource: only the material's own do,
    // as `_geometry_instance_add_surface_with_material_chain` reads the next pass
    // off the material, not off the geometry instance.
    const written = { ...CHAIN[0]!, data: { next_pass: 'ExtResource("9")' } };
    const link = resolveNextPass('ExtResource("9")', {
      resource: written,
      internalResources: CHAIN,
      externalResources: [{ id: '9', path: 'res://link/heavy.tres', type: 'StandardMaterial3D' }],
    });
    expect(link).toMatchObject({ kind: 'file', path: 'res://link/heavy.tres' });
  });
});

describe('materialSourceKey', () => {
  const INLINED: TscnInternalResource[] = [
    { id: 'A', type: 'StandardMaterial3D', data: {} },
    { id: 'B', type: 'StandardMaterial3D', data: {} },
  ];
  const POOLS = { internalResources: INLINED, externalResources: [] };
  const sourceOf = (id: string) =>
    resolveMaterialSource(`SubResource("${id}")`, POOLS) as NonNullable<
      ReturnType<typeof resolveMaterialSource>
    >;

  it('keys an inline source on its resource id', () => {
    expect(materialSourceKey(sourceOf('A'))).not.toBe(materialSourceKey(sourceOf('B')));
    expect(materialSourceKey(sourceOf('A'))).toBe(materialSourceKey(sourceOf('A')));
  });

  it('keys a file source on its path', () => {
    const a = resolveMaterialSource('ExtResource("4")', {
      internalResources: [],
      externalResources: [
        { id: '4', path: 'res://materials/paint.tres', type: 'Material' },
        { id: '5', path: 'res://materials/coat.tres', type: 'Material' },
      ],
    })!;
    const b = resolveMaterialSource('ExtResource("5")', {
      internalResources: [],
      externalResources: [
        { id: '4', path: 'res://materials/paint.tres', type: 'Material' },
        { id: '5', path: 'res://materials/coat.tres', type: 'Material' },
      ],
    })!;
    expect(materialSourceKey(a)).not.toBe(materialSourceKey(b));
  });

  it('keys the two materials of a hand-written cycle distinctly, so each draws once', () => {
    // A cycle through two inline materials: A's next_pass names B, B's names A.
    // Distinct keys let a visited set hold both, so the walk can draw each once
    // and stop at the repeat.
    const a = sourceOf('A');
    const b = sourceOf('B');
    expect(new Set([materialSourceKey(a), materialSourceKey(b), materialSourceKey(a)]).size).toBe(2);
  });
});
