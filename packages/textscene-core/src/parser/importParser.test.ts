/**
 * The witness throughout is `scenes/demos/3d/truck_town/town/tree/scene.gltf.import`,
 * the one sidecar in the corpus whose parameters change what is drawn.
 */
import { describe, expect, it } from 'vitest';
import { parseImportFile, importRootScale, importExternalMaterials } from './importParser';

const TREE_IMPORT = `[remap]

importer="scene"
importer_version=1
type="PackedScene"
uid="uid://cvbmnhoqxwmyl"
path="res://.godot/imported/scene.gltf-9c6f7ba7f8bd8b0f0e9f3f5b1e5a1234.scn"

[deps]

source_file="res://town/tree/scene.gltf"
dest_files=["res://.godot/imported/scene.gltf-9c6f7ba7f8bd8b0f0e9f3f5b1e5a1234.scn"]

[params]

nodes/root_type=""
nodes/root_name=""
nodes/apply_root_scale=true
nodes/root_scale=0.00999999999999999
meshes/ensure_tangents=true
meshes/generate_lods=true
_subresources={}
gltf/naming_version=2
`;

const OBJ_IMPORT = `[remap]

importer="wavefront_obj"
importer_version=1
type="Mesh"

[params]

generate_tangents=true
scale_mesh=Vector3(1, 1, 1)
offset_mesh=Vector3(0, 0, 0)
`;

/**
 * `scenes/demos/3d/ragdoll_physics/characters/mannequiny.glb.import`, the one sidecar
 * in the corpus that repoints a glTF material at an external `.tres`.
 */
const MANNEQUINY_IMPORT = `[remap]

importer="scene"
importer_version=1
type="PackedScene"
uid="uid://c0cfb2j48lp2b"

[params]

nodes/root_type=""
materials/extract=0
_subresources={
"materials": {
"Azul_COLOR_0": {
"use_external/enabled": true,
"use_external/fallback_path": "res://materials/blue.tres",
"use_external/path": "uid://ctlvxueekphcu"
},
"Blanco_COLOR_0": {
"use_external/enabled": true,
"use_external/fallback_path": "res://materials/white.tres",
"use_external/path": "uid://dw85jibvfqqnm"
},
"Negro_COLOR_0": {
"use_external/enabled": false,
"use_external/fallback_path": "res://materials/black.tres",
"use_external/path": "uid://d33e11pbpppvj"
}
}
}
gltf/naming_version=2
`;

describe('parseImportFile', () => {
  it('reads the importer name and the [params] block', () => {
    const parsed = parseImportFile(TREE_IMPORT)!;
    expect(parsed.importer).toBe('scene');
    expect(parsed.params['nodes/root_scale']).toBe('0.00999999999999999');
    expect(parsed.params['nodes/apply_root_scale']).toBe('true');
  });

  it('keeps [remap] and [deps] out of params', () => {
    // Only [params] describes the import; the other sections address the baked
    // artifact under .godot/imported/, which we never read.
    const parsed = parseImportFile(TREE_IMPORT)!;
    expect(parsed.params).not.toHaveProperty('importer');
    expect(parsed.params).not.toHaveProperty('source_file');
    expect(parsed.params).not.toHaveProperty('path');
  });

  it('reads a wavefront_obj sidecar, whose params are a different set entirely', () => {
    const parsed = parseImportFile(OBJ_IMPORT)!;
    expect(parsed.importer).toBe('wavefront_obj');
    expect(parsed.params['scale_mesh']).toBe('Vector3(1, 1, 1)');
  });

  it('returns empty params rather than throwing on a sidecar with no [params]', () => {
    expect(parseImportFile('[remap]\n\nimporter="scene"\n')!.params).toEqual({});
  });

  it('returns null for content that is not a sidecar', () => {
    expect(parseImportFile('')).toBeNull();
    expect(parseImportFile('not an ini file')).toBeNull();
  });
});

describe('importRootScale', () => {
  it('reads the tree witness as a bake of 0.01', () => {
    // apply_root_scale = true means Godot scales the MESHES and leaves the root
    // node at 1, so nodes a .tscn parents to the instanced root are untouched.
    const applied = importRootScale(parseImportFile(TREE_IMPORT));
    // Godot serialises 0.01 as `0.00999999999999999`, a distinct double, so the
    // value is asserted as the number Godot means rather than bit-for-bit.
    expect(applied!.scale).toBeCloseTo(0.01, 15);
    expect(applied!.bake).toBe(true);
  });

  it('reports apply_root_scale = false as a root-node scale instead', () => {
    const parsed = parseImportFile(
      '[params]\n\nnodes/apply_root_scale=false\nnodes/root_scale=4.0\n'
    );
    expect(importRootScale(parsed)).toEqual({ scale: 4, bake: false });
  });

  it('is null when the scale is 1, so an identity sidecar costs nothing', () => {
    // 24 of the 25 vendored sidecars are exactly this.
    expect(
      importRootScale(parseImportFile('[params]\n\nnodes/root_scale=1.0\n'))
    ).toBeNull();
  });

  it('is null for a missing sidecar, an absent key, or a non-scene importer', () => {
    expect(importRootScale(null)).toBeNull();
    expect(importRootScale(parseImportFile('[params]\n\nmeshes/generate_lods=true\n'))).toBeNull();
    // wavefront_obj has no nodes/root_scale; its scale_mesh is out of scope (ADR-0028).
    expect(importRootScale(parseImportFile(OBJ_IMPORT))).toBeNull();
  });

  it('ignores a scale that is not a finite positive number', () => {
    for (const bad of ['0', '-1', 'nan', '']) {
      expect(
        importRootScale(parseImportFile(`[params]\n\nnodes/root_scale=${bad}\n`)),
        `root_scale=${bad}`
      ).toBeNull();
    }
  });

  it('defaults apply_root_scale to true, matching Godot', () => {
    expect(importRootScale(parseImportFile('[params]\n\nnodes/root_scale=0.5\n'))).toEqual({
      scale: 0.5,
      bake: true,
    });
  });
});

describe('importExternalMaterials', () => {
  it('reads the glTF material name -> external .tres table', () => {
    const remaps = importExternalMaterials(parseImportFile(MANNEQUINY_IMPORT));
    // resource_importer_scene.cpp:1625-1633 — the uid is tried first, the res:// fallback second.
    expect(remaps.get('Azul_COLOR_0')).toBe('res://materials/blue.tres');
    expect(remaps.get('Blanco_COLOR_0')).toBe('res://materials/white.tres');
  });

  it('skips a material whose use_external/enabled is false', () => {
    // resource_importer_scene.cpp:1621 gates on the flag, not on the path being present.
    expect(importExternalMaterials(parseImportFile(MANNEQUINY_IMPORT)).has('Negro_COLOR_0')).toBe(
      false
    );
  });

  it('keeps the multi-line _subresources value out of params as a truncated string', () => {
    const parsed = parseImportFile(MANNEQUINY_IMPORT)!;
    expect(parsed.params['_subresources']).toContain('"materials"');
    expect(parsed.params['gltf/naming_version']).toBe('2');
  });

  it('is empty for a sidecar with no material remaps at all', () => {
    expect(importExternalMaterials(parseImportFile(TREE_IMPORT)).size).toBe(0);
    expect(importExternalMaterials(parseImportFile(OBJ_IMPORT)).size).toBe(0);
    expect(importExternalMaterials(null).size).toBe(0);
  });

  it('is empty when _subresources is not parseable, rather than throwing', () => {
    const parsed = parseImportFile('[params]\n\n_subresources={\n"materials": Vector3(1, 1, 1)\n}\n');
    expect(importExternalMaterials(parsed).size).toBe(0);
  });
});
