/**
 * Asserts the `.import` parameter allowlist against the corpus (ADR-0028). The previewer's asset
 * re-import honours `nodes/root_scale`, `nodes/apply_root_scale` and, from `_subresources`, the
 * `use_external` material remaps and the `mesh_instance/layers` mask. A vendored sidecar that
 * needs any other parameter would render wrong with nothing to say so, so this test fails instead.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SCENES = join(REPO_ROOT, 'scenes');
const SKIP_DIRS = new Set(['node_modules', '.git', 'games']);

/**
 * The parameters the previewer honours. `_subresources` is honoured only in part (its material
 * remaps and its per-node layer mask), so each non-empty block is still named below.
 */
const HONOURED = new Set(['nodes/root_scale', 'nodes/apply_root_scale', '_subresources']);

/**
 * Inert at any value, so they need no per-file check. Each is a bake or performance concern with
 * no preview equivalent (LODs, shadow meshes, lightmap UV2, compression, light baking), something
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
  'meshes/light_baking',
  'meshes/lightmap_texel_size',
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
  'gltf/embedded_image_handling',
  'gltf/texture_map_mode',
  // The wavefront_obj importer's parameters.
  'generate_tangents',
  'generate_lods',
  'generate_shadow_mesh',
  'generate_lightmap_uv2',
  'generate_lightmap_uv2_texel_size',
  'force_disable_mesh_compression',
]);

/**
 * Parameters that would change the picture and that the previewer does not read, so their
 * default is asserted corpus-wide. `scale_mesh` and `offset_mesh` are wavefront_obj's root scale,
 * out of scope while every OBJ in the corpus is identity (ADR-0028).
 */
const MUST_BE_DEFAULT = new Map([
  ['nodes/root_type', ''],
  ['nodes/root_script', 'null'],
  ['import_script/path', ''],
  ['scale_mesh', 'Vector3(1, 1, 1)'],
  ['offset_mesh', 'Vector3(0, 0, 0)'],
]);

/**
 * `_subresources` carries per-node, per-mesh and per-material import overrides and is not
 * uniformly inert, so each non-empty block is listed with what it does. The guard asserts this
 * exact set per block, not per file: a new block in a listed sidecar is a decision too.
 */
const KNOWN_SUBRESOURCE_OVERRIDES = {
  'scenes/demos/3d/material_testers/models/godot_ball.glb.import': {
    blocks: ['meshes'],
    note: 'lods/shadow/lightmap off + save_to_file. Bake concerns only — inert here.',
  },
  'scenes/demos/3d/platformer/player/player.glb.import': {
    blocks: ['animations', 'materials'],
    note:
      'materials use_external → res://player/player_{gray,glow}.tres, honoured. animations: ' +
      'settings/loop_mode LOOP_LINEAR on every clip, which is already three\'s default, ' +
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
 * The `[params]` top-level keys and the non-empty `_subresources` blocks, in one string-aware
 * pass. It is independent of the production parser, so a bug there cannot make this pass.
 */
function readSidecar(file) {
  const params = {};
  const subResources = [];
  let inParams = false;
  let openKey = null;
  let state = { inString: false, depth: 0 };

  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (openKey !== null) {
      if (openKey === '_subresources') subResources.push(line);
      state = scanLine(line, state);
      if (!state.inString && state.depth <= 0) openKey = null;
      continue;
    }
    if (SECTION_LINE.test(line)) {
      inParams = line === '[params]';
      continue;
    }
    if (!inParams || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    params[key] = value.replace(/^"(.*)"$/, '$1');
    state = scanLine(value, { inString: false, depth: 0 });
    if (state.inString || state.depth > 0) {
      openKey = key;
      if (key === '_subresources') subResources.push(value);
    }
  }
  return { params, blocks: topLevelBlocks(subResources.join('\n')) };
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

  it('uses no parameter this previewer has not reviewed', () => {
    // An unrecognised key comes from a Godot version or importer nobody has reviewed. Classify it
    // into one of the sets above, with the reason, or honour it.
    const unknown = [];
    for (const file of sidecars) {
      for (const key of Object.keys(readParams(file))) {
        if (HONOURED.has(key) || INERT.has(key) || MUST_BE_DEFAULT.has(key)) continue;
        unknown.push(`${rel(file)}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('leaves every render-affecting parameter we do not read at its default', () => {
    const findings = [];
    for (const file of sidecars) {
      for (const [key, value] of Object.entries(readParams(file))) {
        const expected = MUST_BE_DEFAULT.get(key);
        if (expected !== undefined && expected !== value) {
          findings.push(`${rel(file)}: ${key}=${value} would change the render (want ${expected || '""'})`);
        }
      }
    }
    expect(findings).toEqual([]);
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
