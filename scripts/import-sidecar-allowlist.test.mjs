/**
 * Asserts the `.import` parameter allowlist against the corpus (ADR-0028). The previewer's asset
 * re-import honours `nodes/root_scale`, `nodes/apply_root_scale`, `meshes/light_baking`,
 * `meshes/lightmap_texel_size`, from `_subresources` the `use_external` material remaps, the
 * `mesh_instance/layers` mask and the per-mesh `generate/lightmap_uv`, a `3d_texture` slice grid,
 * and a `texture` import's compression. A vendored sidecar that needs any other parameter would
 * render wrong with nothing to say so, so this test fails instead.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { READ_IMPORTERS, sidecarImporter } from './vendor-prune.mjs';
import { TEXTURE_IMPORTER } from '../packages/textscene-core/src/godot/import/textureImport.ts';
import { TEXTURE_3D_IMPORTER } from '../packages/textscene-core/src/godot/import/texture3DImport.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SCENES = join(REPO_ROOT, 'scenes');
const SKIP_DIRS = new Set(['node_modules', '.git', 'games']);

/**
 * The parameters the previewer honours. `_subresources` is honoured only in part (its material
 * remaps, its per-node layer mask and its per-mesh lightmap UV2 override), so each non-empty block
 * is still named below. The two lightmap parameters choose the meshes that take their UV2 from
 * the asset's unwrap cache.
 */
const HONOURED = new Set([
  'nodes/root_scale',
  'nodes/apply_root_scale',
  'meshes/light_baking',
  'meshes/lightmap_texel_size',
  '_subresources',
]);

/**
 * The `3d_texture` importer's parameters, reviewed for that importer alone: a `texture` importer's
 * mipmaps change how a 2D texture samples. The slice grid is how the previewer cuts the source
 * image into slices. The storage is inert: the previewer reads the source image, and a fog density
 * texture is sampled in a compute shader, so at mipmap 0 (`fog_material.cpp:161`).
 */
const TEXTURE_3D_PARAMS = new Set([
  'slices/horizontal',
  'slices/vertical',
  'compress/mode',
  'compress/high_quality',
  'compress/lossy_quality',
  'compress/uastc_level',
  'compress/rdo_quality_loss',
  'compress/hdr_compression',
  'compress/channel_pack',
  'mipmaps/generate',
  'mipmaps/limit',
  'roughness/mode',
  'roughness/src_normal',
]);

/**
 * The `texture` importer's parameters, reviewed for that importer alone. The previewer honours the
 * compression mode, the normal map flag, the mipmaps, the texel passes and the SVG scale
 * (`standardmaterial3d/textureBinding.md`). The other storage keys are inert: the previewer reads
 * the source image, not the compressed one, and the 3D detection is the editor's later re-import,
 * which it does not predict. The roughness limiter rewrites only the mipmaps below the base level
 * (`resource_importer_texture.cpp:415-417`), and the editor keys build an editor-only image (`:796-821`).
 */
const TEXTURE_PARAMS = new Set([
  'compress/mode',
  'compress/high_quality',
  'compress/normal_map',
  'compress/lossy_quality',
  'compress/uastc_level',
  'compress/rdo_quality_loss',
  'compress/hdr_compression',
  'mipmaps/generate',
  'process/fix_alpha_border',
  'process/premult_alpha',
  'process/normal_map_invert_y',
  'process/hdr_as_srgb',
  'process/hdr_clamp_exposure',
  'svg/scale',
  'editor/scale_with_editor_scale',
  'editor/convert_colors_with_editor_theme',
  'detect_3d/compress_to',
  'roughness/mode',
  'roughness/src_normal',
]);

/**
 * The `texture` importer's parameters that change the texels, the channels or the mip chain of an
 * image, which the previewer does not read, so their default is asserted. A channel pack can
 * compress to RGTC, which has no sRGB view (`core/io/image.cpp:3800-3806`).
 */
const TEXTURE_MUST_BE_DEFAULT = new Map([
  ['compress/channel_pack', '0'],
  ['mipmaps/limit', '-1'],
  ['process/channel_remap/red', '0'],
  ['process/channel_remap/green', '1'],
  ['process/channel_remap/blue', '2'],
  ['process/channel_remap/alpha', '3'],
  ['process/size_limit', '0'],
]);

/**
 * Inert at any value, so they need no per-file check. Each is a bake or performance concern with
 * no preview equivalent (LODs, shadow meshes, compression), something
 * three's GLTFLoader already does (tangents, named skins, surface dedup), or a change to how Godot
 * names or files things (name suffixes, material extraction, glTF naming, clip bookkeeping).
 */
const INERT = new Set([
  'nodes/import_as_skeleton_bones',
  // Governs Godot's `-col`/`-noimp` name conventions, which the previewer does not implement at
  // all, so reading the parameter would change nothing.
  'nodes/use_name_suffixes',
  'nodes/use_node_type_suffixes',
  'nodes/root_name',
  'mesh_library/use_node_names_as_mesh_names',
  'array_mesh/deduplicate_surfaces',
  'meshes/ensure_tangents',
  'meshes/generate_lods',
  'meshes/create_shadow_meshes',
  'meshes/force_disable_compression',
  'skins/use_named_skins',
  'animation/import',
  'animation/fps',
  'animation/trimming',
  'animation/remove_immutable_tracks',
  'animation/import_rest_as_RESET',
  'materials/extract',
  'materials/extract_format',
  'materials/extract_path',
  'gltf/naming_version',
  'gltf/texture_map_mode',
  // The wavefront_obj importer's parameters.
  'generate_tangents',
  'generate_lods',
  'generate_shadow_mesh',
  // The texel size of an unwrap the default below keeps off.
  'generate_lightmap_uv2_texel_size',
  'force_disable_mesh_compression',
]);

/**
 * Parameters that would change the picture and that the previewer does not read, so their
 * default is asserted corpus-wide. `scale_mesh` and `offset_mesh` are wavefront_obj's root scale,
 * and `generate_lightmap_uv2` its unwrap, out of scope while every OBJ in the corpus keeps them
 * off (ADR-0028). Extract Textures is the embedded image handling under which an embedded image
 * imports as a file with a sidecar of its own.
 */
const MUST_BE_DEFAULT = new Map([
  ['gltf/embedded_image_handling', '1'],
  ['nodes/root_type', ''],
  ['nodes/root_script', 'null'],
  ['import_script/path', ''],
  ['scale_mesh', 'Vector3(1, 1, 1)'],
  ['offset_mesh', 'Vector3(0, 0, 0)'],
  ['generate_lightmap_uv2', 'false'],
]);

/**
 * `_subresources` carries per-node, per-mesh and per-material import overrides and is not
 * uniformly inert, so each non-empty block is listed with what it does. The guard asserts this
 * exact set per block, not per file: a new block in a listed sidecar is a decision too.
 */
const KNOWN_SUBRESOURCE_OVERRIDES = {
  'scenes/demos/3d/material_testers/models/godot_ball.glb.import': {
    blocks: ['meshes'],
    note:
      'generate/lightmap_uv Default, honoured: at light_baking=1 the mesh takes no UV2. ' +
      'lods/shadow off and save_to_file are bake concerns, inert here.',
  },
  'scenes/demos/3d/platformer/player/player.glb.import': {
    blocks: ['animations', 'materials'],
    note:
      'materials use_external → res://player/player_{gray,glow}.tres, honoured. animations: ' +
      "settings/loop_mode LOOP_LINEAR on every clip, which is already three's default, " +
      'and no slice configured — unread, and no divergence to see here (ADR-0028).',
  },
  'scenes/demos/3d/ragdoll_physics/characters/mannequiny.glb.import': {
    blocks: ['materials'],
    note: 'materials use_external → res://materials/{blue,white,black}.tres, honoured.',
  },
  'scenes/demos/3d/truck_town/town/lamp/scene.gltf.import': {
    blocks: ['nodes'],
    note:
      'nodes mesh_instance/layers = 2 puts one lamp mesh on render layer 2, honoured — ' +
      "the vehicles' decals cull_mask 1048573 clears exactly that bit.",
  },
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.import')) out.push(full);
  }
  return out;
}

/**
 * The importer, as the vendor prune reads it, then the `[params]` top-level keys and the non-empty
 * `_subresources` blocks in one string-aware pass. It is independent of the production parser, so
 * a bug there cannot make this pass.
 */
function readSidecar(file) {
  const text = readFileSync(file, 'utf8');
  const params = {};
  const subResources = [];
  let section = null;
  let openKey = null;
  let state = { inString: false, depth: 0 };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (openKey !== null) {
      if (openKey === '_subresources') subResources.push(line);
      state = scanLine(line, state);
      if (!state.inString && state.depth <= 0) openKey = null;
      continue;
    }
    if (SECTION_LINE.test(line)) {
      section = line;
      continue;
    }
    if (!line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (section !== '[params]') continue;
    params[key] = value.replace(/^"(.*)"$/, '$1');
    state = scanLine(value, { inString: false, depth: 0 });
    if (state.inString || state.depth > 0) {
      openKey = key;
      if (key === '_subresources') subResources.push(value);
    }
  }
  return { importer: sidecarImporter(text), params, blocks: topLevelBlocks(subResources.join('\n')) };
}

const SECTION_LINE = /^\[[A-Za-z_][A-Za-z0-9_]*\]$/;

/** Advances a string and bracket scan by one line. A brace inside a quoted value is content. */
function scanLine(line, { inString, depth }) {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return { inString, depth };
}

/**
 * The `_subresources` keys whose value opens a nested block, sorted. It reads the raw text, not
 * the line shape, so a block on one line or with other spacing cannot slip past the guard.
 */
function topLevelBlocks(text) {
  const blocks = [];
  let inString = false;
  let depth = 0;
  let key = null;
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') {
        inString = false;
        if (depth === 1) key = buf;
      } else buf += c;
      continue;
    }
    if (c === '"') {
      inString = true;
      buf = '';
    } else if (c === '{' || c === '[') {
      depth++;
      if (depth === 2 && key !== null) {
        blocks.push(key);
        key = null;
      }
    } else if (c === '}' || c === ']') depth--;
    else if (c === ',') key = null;
  }
  return blocks.sort();
}

/** Each parameter of a read sidecar that leaves its asserted default, as one line. */
function defaultFindings(name, { importer, params }) {
  const findings = [];
  for (const [key, value] of Object.entries(params)) {
    const expected =
      MUST_BE_DEFAULT.get(key) ??
      (importer === TEXTURE_IMPORTER ? TEXTURE_MUST_BE_DEFAULT.get(key) : undefined);
    if (expected !== undefined && expected !== value) {
      findings.push(`${name}: ${key}=${value} would change the render (want ${expected || '""'})`);
    }
  }
  return findings;
}

const rel = (file) => relative(REPO_ROOT, file).split(sep).join('/');

const sidecars = walk(SCENES);
/** One read per sidecar, shared by every assertion below. */
const READ = new Map(sidecars.map((file) => [file, readSidecar(file)]));
const readParams = (file) => READ.get(file).params;

describe('.import sidecar allowlist (ADR-0028)', () => {
  it('finds the vendored sidecars', () => {
    // A guard over an empty set proves nothing.
    expect(sidecars.length).toBeGreaterThan(0);
  });

  it('sits beside the asset it describes', () => {
    const orphans = sidecars.filter((file) => {
      try {
        return !statSync(file.replace(/\.import$/, '')).isFile();
      } catch {
        return true;
      }
    });
    expect(orphans.map(rel)).toEqual([]);
  });

  it('keeps the sidecars of every importer core reads', () => {
    expect(
      [TEXTURE_IMPORTER, TEXTURE_3D_IMPORTER].filter((importer) => !READ_IMPORTERS.has(importer))
    ).toEqual([]);
  });

  it('finds only the sidecars of an importer the vendor prune keeps', () => {
    const unread = sidecars.filter((file) => !READ_IMPORTERS.has(READ.get(file).importer));
    expect(unread.map(rel)).toEqual([]);
  });

  it('uses no parameter this previewer has not reviewed', () => {
    // An unrecognised key comes from a Godot version or importer nobody has reviewed. Classify it
    // into one of the sets above, with the reason, or honour it.
    const unknown = [];
    for (const file of sidecars) {
      const { importer } = READ.get(file);
      for (const key of Object.keys(readParams(file))) {
        if (HONOURED.has(key) || INERT.has(key) || MUST_BE_DEFAULT.has(key)) continue;
        if (importer === TEXTURE_3D_IMPORTER && TEXTURE_3D_PARAMS.has(key)) continue;
        if (importer === TEXTURE_IMPORTER && (TEXTURE_PARAMS.has(key) || TEXTURE_MUST_BE_DEFAULT.has(key)))
          continue;
        unknown.push(`${rel(file)}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('leaves every render-affecting parameter we do not read at its default', () => {
    expect(sidecars.flatMap((file) => defaultFindings(rel(file), READ.get(file)))).toEqual([]);
  });

  it('flags a texture sidecar that changes the channels of its image', () => {
    const remapped = {
      importer: TEXTURE_IMPORTER,
      params: { 'compress/mode': '0', 'process/channel_remap/red': '1' },
    };
    expect(defaultFindings('grey.png.import', remapped)).toEqual([
      'grey.png.import: process/channel_remap/red=1 would change the render (want 0)',
    ]);
  });

  it('carries only the _subresources blocks already accounted for', () => {
    // A new block, in a new sidecar or a listed one, needs review before it joins the list.
    const found = {};
    for (const file of sidecars) {
      const { blocks } = READ.get(file);
      if (blocks.length > 0) found[rel(file)] = blocks;
    }
    const declared = {};
    for (const [file, entry] of Object.entries(KNOWN_SUBRESOURCE_OVERRIDES)) {
      declared[file] = [...entry.blocks].sort();
    }
    expect(found).toEqual(declared);
  });

  it('has exactly one sidecar that corrects a root scale', () => {
    // The correction this mechanism exists for. A second one needs review.
    const scaled = sidecars.filter((file) => {
      const raw = readParams(file)['nodes/root_scale'];
      return raw !== undefined && Number(raw) !== 1;
    });
    expect(scaled.map(rel)).toEqual(['scenes/demos/3d/truck_town/town/tree/scene.gltf.import']);
  });
});
