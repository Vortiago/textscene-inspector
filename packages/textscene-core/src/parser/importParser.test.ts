/**
 * The witness throughout is `scenes/demos/3d/truck_town/town/tree/scene.gltf.import`,
 * the one sidecar in the corpus whose parameters change what is drawn.
 */
import { describe, expect, it } from 'vitest';
import {
  importClipOptions,
  importExternalMaterials,
  importGltfNaming,
  importLightmapUnwrap,
  importNodeLayers,
  importRootScale,
  importTexture3DSlices,
  importTextureOptions,
  parseImportFile,
} from './importParser';
import { DEFAULT_TEXTURE_IMPORT, RoughnessChannel } from '../godot/import/textureImport';

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
"use_external/enabled": true,
"use_external/fallback_path": "res://materials/black.tres",
"use_external/path": "uid://d33e11pbpppvj"
}
}
}
gltf/naming_version=2
`;

/** Godot writes a disabled remap the same way, minus the flag. */
const DISABLED_REMAP_IMPORT = `[params]

_subresources={
"materials": {
"Negro_COLOR_0": {
"use_external/enabled": false,
"use_external/fallback_path": "res://materials/black.tres"
}
}
}
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

describe('parseImportFile — a value that never balances', () => {
  // Godot writes balanced values; a truncated or hand-edited sidecar may not. The
  // parameter this whole mechanism exists for must survive one, rather than being
  // swallowed into it and silently reading as absent.
  it('captures a multi-line value whole and resumes at the key after it', () => {
    const parsed = parseImportFile(MANNEQUINY_IMPORT)!;
    expect(parsed.params['_subresources']).toContain('"materials"');
    expect(parsed.params['gltf/naming_version']).toBe('2');
  });

  it('recovers the next key after an unterminated value', () => {
    const parsed = parseImportFile('[params]\n\nfoo={\nnodes/root_scale=0.01\n')!;
    expect(importRootScale(parsed)).toEqual({ scale: 0.01, bake: true });
  });

  it('recovers the next section after an unterminated value', () => {
    const parsed = parseImportFile('[params]\n\nfoo={\n\n[remap]\n\nimporter="scene"\n')!;
    expect(parsed.importer).toBe('scene');
  });

  it('reads a quoted value whose brackets are string content, not nesting', () => {
    const parsed = parseImportFile('[params]\n\nnodes/root_name="a { b"\nnodes/root_scale=0.5\n')!;
    expect(parsed.params['nodes/root_name']).toBe('a { b');
    expect(importRootScale(parsed)).toEqual({ scale: 0.5, bake: true });
  });
});

describe('parseImportFile — string values', () => {
  // The editor writes a String param as `"` + `c_escape_multiline()` + `"`
  // (`variant_parser.cpp:2033`), and `VariantParser` decodes it on the way back in.
  it('decodes the escapes Godot writes into a string param', () => {
    const parsed = parseImportFile('[params]\n\nnodes/root_name="Tree \\"A\\" \\\\ 2"\n')!;
    expect(parsed.params['nodes/root_name']).toBe('Tree "A" \\ 2');
  });

  it('keeps a param whose trailing quote is escaped as written, since it never closes', () => {
    const parsed = parseImportFile('[params]\n\nnodes/root_name="a\\"\nnodes/root_scale=0.5\n')!;
    expect(parsed.params['nodes/root_name']).toBe('"a\\"');
  });

  it('leaves the escapes inside _subresources for its JSON decode', () => {
    const parsed = parseImportFile(
      '[params]\n\n_subresources={"materials": {"Mat \\"x\\"": ' +
        '{"use_external/enabled": true, "use_external/path": "res://m.tres"}}}\n'
    );
    expect(importExternalMaterials(parsed)).toEqual(new Map([['Mat "x"', 'res://m.tres']]));
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
    const parsed = parseImportFile('[params]\n\nnodes/apply_root_scale=false\nnodes/root_scale=4.0\n');
    expect(importRootScale(parsed)).toEqual({ scale: 4, bake: false });
  });

  it('is null when the scale is 1, so an identity sidecar costs nothing', () => {
    // 24 of the 25 vendored sidecars are exactly this.
    expect(importRootScale(parseImportFile('[params]\n\nnodes/root_scale=1.0\n'))).toBeNull();
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

  it('booleanizes apply_root_scale — `bool apply_root = p_options[…]` (resource_importer_scene.cpp:3154-3157)', () => {
    // `Variant::operator bool()` is `!is_zero()` (`variant_op.cpp:1114-1122`),
    // so a numeric spelling reads as the number's truth, not as its text.
    const bake = (value: string) =>
      importRootScale(parseImportFile(`[params]\n\nnodes/apply_root_scale=${value}\nnodes/root_scale=4.0\n`))!
        .bake;
    expect(bake('0')).toBe(false);
    expect(bake('1')).toBe(true);
    expect(bake('2')).toBe(true);
  });
});

describe('importExternalMaterials', () => {
  it('reads the glTF material name -> external .tres table', () => {
    const remaps = importExternalMaterials(parseImportFile(MANNEQUINY_IMPORT));
    // resource_importer_scene.cpp:1625-1633: the uid is tried first, the res:// fallback second.
    expect([...remaps]).toEqual([
      ['Azul_COLOR_0', 'res://materials/blue.tres'],
      ['Blanco_COLOR_0', 'res://materials/white.tres'],
      ['Negro_COLOR_0', 'res://materials/black.tres'],
    ]);
  });

  it('skips a material whose use_external/enabled is false', () => {
    // resource_importer_scene.cpp:1621 gates on the flag, not on the path being present.
    expect(importExternalMaterials(parseImportFile(DISABLED_REMAP_IMPORT)).size).toBe(0);
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

describe('importNodeLayers', () => {
  const sidecar = (body: string) => parseImportFile(`[params]\n\n_subresources={\n${body}\n}\n`);

  it('strips the PATH: prefix Godot writes the key with', () => {
    const parsed = sidecar('"nodes": {\n"PATH:root/Object_4": {\n"mesh_instance/layers": 2\n}\n}');
    expect([...importNodeLayers(parsed)]).toEqual([['root/Object_4', 2]]);
  });

  it('ignores a node entry carrying no layer mask', () => {
    const parsed = sidecar('"nodes": {\n"PATH:a": {\n"mesh_instance/cast_shadow": 1\n}\n}');
    expect(importNodeLayers(parsed).size).toBe(0);
  });

  it('ignores a non-integer mask', () => {
    const parsed = sidecar('"nodes": {\n"PATH:a": {\n"mesh_instance/layers": "2"\n}\n}');
    expect(importNodeLayers(parsed).size).toBe(0);
  });

  it('is empty without a sidecar or a nodes block', () => {
    expect(importNodeLayers(null).size).toBe(0);
    expect(importNodeLayers(parseImportFile('[params]\n\nnodes/root_scale=1.0\n')).size).toBe(0);
  });
});

describe('importClipOptions', () => {
  const sidecar = (params: string) => parseImportFile(`[params]\n\n${params}\n`);
  const animations = (body: string) => sidecar(`_subresources={\n"animations": {\n${body}\n}\n}`);

  it.each([0, 1, 2])('reads settings/loop_mode %i of a clip entry', (mode) => {
    const parsed = animations(`"walk": {\n"settings/loop_mode": ${mode}\n}`);
    expect([...importClipOptions(parsed).sidecarLoopModes]).toEqual([['walk', mode]]);
  });

  it('reads an entry without settings/loop_mode as its default, LOOP_NONE', () => {
    const parsed = animations('"walk": {\n"save_to_file/enabled": false\n}');
    expect([...importClipOptions(parsed).sidecarLoopModes]).toEqual([['walk', 0]]);
  });

  it('reads no entry when _subresources is not JSON', () => {
    const parsed = sidecar('_subresources={\n"animations": { "walk": Vector3(1, 2, 3) }\n}');
    expect(importClipOptions(parsed).sidecarLoopModes.size).toBe(0);
  });

  it('reads name suffixes as on when the sidecar omits nodes/use_name_suffixes or has no sidecar', () => {
    expect(importClipOptions(sidecar('nodes/root_scale=1.0')).useNameSuffixes).toBe(true);
    expect(importClipOptions(null).useNameSuffixes).toBe(true);
  });

  it('reads nodes/use_name_suffixes=false', () => {
    expect(importClipOptions(sidecar('nodes/use_name_suffixes=false')).useNameSuffixes).toBe(false);
  });
});

describe('importGltfNaming', () => {
  it('reads the naming version and import_as_skeleton_bones', () => {
    const parsed = parseImportFile(
      '[params]\n\ngltf/naming_version=1\nnodes/import_as_skeleton_bones=true\n'
    );
    expect(importGltfNaming(parsed)).toEqual({ namingVersion: 1, importAsSkeletonBones: true });
  });

  it("takes Godot's defaults without a sidecar", () => {
    expect(importGltfNaming(null)).toEqual({ namingVersion: 2, importAsSkeletonBones: false });
  });

  it('takes the default version for one that is not an integer', () => {
    const parsed = parseImportFile('[params]\n\ngltf/naming_version="two"\n');
    expect(importGltfNaming(parsed).namingVersion).toBe(2);
  });
});

describe('importLightmapUnwrap', () => {
  const sidecar = (params: string) => parseImportFile(`[params]\n\n${params}\n`);
  const meshSetting = (lightmapUv: number) =>
    `_subresources={\n"meshes": {\n"Scene_Rock": {\n"generate/lightmap_uv": ${lightmapUv}\n}\n}\n}`;

  it("unwraps every mesh at Static Lightmaps, at the sidecar's texel size", () => {
    const unwrap = importLightmapUnwrap(sidecar('meshes/light_baking=2\nmeshes/lightmap_texel_size=0.5'));

    expect(unwrap?.texelSize).toBe(0.5);
    expect(unwrap?.unwraps('Scene_Rock')).toBe(true);
  });

  it('unwraps nothing at the default bake mode, Static', () => {
    expect(importLightmapUnwrap(sidecar('meshes/lightmap_texel_size=0.5'))).toBeNull();
  });

  it('unwraps nothing without a sidecar', () => {
    expect(importLightmapUnwrap(null)).toBeNull();
  });

  it('skips a mesh whose generate/lightmap_uv is Disable', () => {
    const unwrap = importLightmapUnwrap(sidecar(`meshes/light_baking=2\n${meshSetting(2)}`));

    expect(unwrap?.unwraps('Scene_Rock')).toBe(false);
    expect(unwrap?.unwraps('Scene_Tree')).toBe(true);
  });

  it('unwraps only a mesh whose generate/lightmap_uv is Enable, at another bake mode', () => {
    const unwrap = importLightmapUnwrap(sidecar(`meshes/light_baking=1\n${meshSetting(1)}`));

    expect(unwrap?.unwraps('Scene_Rock')).toBe(true);
    expect(unwrap?.unwraps('Scene_Tree')).toBe(false);
  });

  it("takes Godot's default texel size of 0.2, rounded to a float", () => {
    expect(importLightmapUnwrap(sidecar('meshes/light_baking=2'))?.texelSize).toBe(Math.fround(0.2));
  });

  it('raises a texel size below 0.001 to 0.001 (edge case)', () => {
    const unwrap = importLightmapUnwrap(sidecar('meshes/light_baking=2\nmeshes/lightmap_texel_size=0'));

    expect(unwrap?.texelSize).toBe(Math.fround(0.001));
  });
});

const textureSidecar = (...params: string[]): string =>
  ['[remap]', '', 'importer="texture"', '', '[params]', '', ...params].join('\n');

describe('importTextureOptions', () => {
  it('reads every option a texture sidecar names that changes the texture', () => {
    const sidecar = textureSidecar(
      'compress/mode=2',
      'compress/high_quality=true',
      'compress/normal_map=1',
      'mipmaps/generate=true',
      'process/fix_alpha_border=false',
      'process/premult_alpha=true',
      'process/normal_map_invert_y=true',
      'svg/scale=2.5',
      'roughness/mode=6',
      'roughness/src_normal="res://bumps.png"'
    );
    expect(importTextureOptions(parseImportFile(sidecar))).toEqual({
      mode: 'VramCompressed',
      highQuality: true,
      normalMap: true,
      mipmaps: true,
      fixAlphaBorder: false,
      premultAlpha: true,
      invertNormalY: true,
      svgScale: 2.5,
      roughnessLimit: { channel: RoughnessChannel.L, normalPath: 'res://bumps.png' },
    });
  });

  it('reads Detect, Disabled or a roughness mode with no normal map as no limiter (edge case)', () => {
    const limits = [
      ['roughness/mode=0', 'roughness/src_normal="res://bumps.png"'],
      ['roughness/mode=1', 'roughness/src_normal="res://bumps.png"'],
      ['roughness/mode=2', 'roughness/src_normal=""'],
    ].map((lines) => importTextureOptions(parseImportFile(textureSidecar(...lines))).roughnessLimit);
    expect(limits).toEqual([null, null, null]);
  });

  it('reads no sidecar, or one of another importer, as the Detect preset', () => {
    const scene = textureSidecar('mipmaps/generate=true').replace('"texture"', '"scene"');
    expect([importTextureOptions(null), importTextureOptions(parseImportFile(scene))]).toEqual([
      DEFAULT_TEXTURE_IMPORT,
      DEFAULT_TEXTURE_IMPORT,
    ]);
  });

  it('reads an omitted or unreadable parameter at its default (edge case)', () => {
    const sidecar = textureSidecar(
      'compress/mode="two"',
      'compress/normal_map=2',
      'mipmaps/generate=maybe',
      'svg/scale="big"'
    );
    expect(importTextureOptions(parseImportFile(sidecar))).toEqual(DEFAULT_TEXTURE_IMPORT);
  });

  it('reads a compression mode outside the enum at its default (edge case)', () => {
    const modes = ['compress/mode=5', 'compress/mode=-1'].map(
      (line) => importTextureOptions(parseImportFile(textureSidecar(line))).mode
    );
    expect(modes).toEqual([DEFAULT_TEXTURE_IMPORT.mode, DEFAULT_TEXTURE_IMPORT.mode]);
  });
});

describe('importTexture3DSlices', () => {
  const texture3DSidecar = (importer: string, ...params: string[]) =>
    parseImportFile([`[remap]`, '', `importer="${importer}"`, '', '[params]', '', ...params].join('\n'));

  it('reads the slices across and down a 3D texture sidecar', () => {
    const sidecar = texture3DSidecar('3d_texture', 'slices/horizontal=4', 'slices/vertical=2');
    expect(importTexture3DSlices(sidecar)).toEqual({ horizontal: 4, vertical: 2 });
  });

  it("takes the importer's 8 for a count the sidecar omits", () => {
    const sidecar = texture3DSidecar('3d_texture', 'compress/mode=0');
    expect(importTexture3DSlices(sidecar)).toEqual({ horizontal: 8, vertical: 8 });
  });

  it('imports nothing for a count Godot cannot read as a number (error case)', () => {
    const sidecar = texture3DSidecar('3d_texture', 'slices/vertical="eight"');
    expect(importTexture3DSlices(sidecar)).toBeNull();
  });

  it('imports no 3D texture without a sidecar, or under another importer', () => {
    expect(importTexture3DSlices(null)).toBeNull();
    expect(importTexture3DSlices(texture3DSidecar('texture', 'slices/horizontal=4'))).toBeNull();
  });

  it('imports nothing for a count of 0, which Godot divides by (edge case)', () => {
    expect(importTexture3DSlices(texture3DSidecar('3d_texture', 'slices/horizontal=0'))).toBeNull();
  });
});
