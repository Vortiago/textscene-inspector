/**
 * Guards the `.import` parameter allowlist against the corpus (ADR-0028).
 *
 * The previewer performs an **asset re-import**: it loads the source `.gltf`/`.glb`/
 * `.obj` and re-derives the scene, honouring `nodes/root_scale` and
 * `nodes/apply_root_scale` and nothing else. Every other parameter is either something
 * three's GLTFLoader already does, or a bake/performance concern with no visual
 * consequence in a preview.
 *
 * That is a fine boundary right up until someone vendors a demo whose sidecar needs a
 * parameter we ignore — at which point the scene renders wrong with nothing to say so.
 * The failure this file exists to prevent already happened once in the other direction:
 * the corpus shipped NO sidecars at all, so Godot re-imported at defaults, the previewer
 * matched it, and a 937-unit tree measured as clean parity. Both renderers agreeing is
 * only evidence when both are fed what the engine actually has.
 *
 * So the allowlist is asserted rather than documented. Today every vendored sidecar
 * outside the tree is identity and this passes trivially; the moment one is not, it
 * fails and forces a decision.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SCENES = join(REPO_ROOT, 'scenes');
const SKIP_DIRS = new Set(['node_modules', '.git', 'games']);

/** The two parameters we honour, at any value. */
const HONOURED = new Set(['nodes/root_scale', 'nodes/apply_root_scale']);

/**
 * Reviewed and inert AT ANY VALUE, so their presence needs no per-file check.
 *
 * Three reasons run through this list. Some are bake/performance concerns a previewer
 * has no equivalent for (LODs, shadow meshes, lightmap UV2 and texel size, mesh
 * compression, light baking mode). Some are already what three's GLTFLoader does
 * (tangents, named skins, surface dedup). The rest change how Godot NAMES or FILES
 * things rather than what is drawn: node/material name suffixes, material extraction to
 * separate files, glTF naming version, and animation clip bookkeeping.
 *
 * `nodes/use_name_suffixes` deserves its own note: it governs Godot's `-col`/`-noimp`
 * name conventions, which this previewer does not implement at all. So `false` matches
 * us exactly and `true` is a pre-existing divergence unrelated to sidecars — reading the
 * parameter would not fix it, and a file setting it either way tells us nothing new.
 */
const INERT = new Set([
  'nodes/import_as_skeleton_bones',
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
  // wavefront_obj
  'generate_tangents',
  'generate_lods',
  'generate_shadow_mesh',
  'generate_lightmap_uv2',
  'generate_lightmap_uv2_texel_size',
  'force_disable_mesh_compression',
]);

/**
 * Parameters that WOULD change what is drawn if set, and which we do not read. Their
 * corpus-wide default is asserted, so a scene that starts relying on one fails here
 * instead of rendering wrong. `scale_mesh`/`offset_mesh` are the wavefront_obj
 * equivalents of the root scale we DO honour for scenes — deliberately out of scope
 * while every OBJ in the corpus is identity (ADR-0028).
 */
const MUST_BE_DEFAULT = new Map([
  ['nodes/root_type', ''],
  ['nodes/root_script', 'null'],
  ['import_script/path', ''],
  ['scale_mesh', 'Vector3(1, 1, 1)'],
  ['offset_mesh', 'Vector3(0, 0, 0)'],
]);

/**
 * `_subresources` carries PER-NODE, PER-MESH, PER-MATERIAL import overrides, and unlike
 * everything above it is not uniformly inert — so each non-empty block is listed with
 * what it does and whether it matters. The guard asserts this exact set: a newly
 * vendored sidecar with overrides fails rather than joining the list silently.
 *
 * Two of these are real, unhandled divergences. They are narrow, pre-existing, and out
 * of scope for ADR-0028 (which is about root scale), but they are now WRITTEN DOWN
 * rather than undiscovered — which is the whole point of the guard.
 */
const KNOWN_SUBRESOURCE_OVERRIDES = {
  'scenes/demos/3d/material_testers/models/godot_ball.glb.import':
    'meshes: lods/shadow/lightmap off + save_to_file. Bake concerns only — inert here.',
  'scenes/demos/3d/platformer/player/player.glb.import':
    'animations: clip slicing and loop modes. Affects playback, not the static render.',
  'scenes/demos/3d/ragdoll_physics/characters/mannequiny.glb.import':
    'UNHANDLED: materials use_external/enabled swaps the glTF embedded materials for ' +
    'res://materials/{blue,white,black}.tres. Godot draws the external ones, we draw ' +
    'the embedded ones.',
  'scenes/demos/3d/truck_town/town/lamp/scene.gltf.import':
    'UNHANDLED: nodes mesh_instance/layers = 2 puts one lamp mesh on render layer 2.',
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
 * Minimal INI read — deliberately independent of the production parser it guards, so a
 * bug in that parser cannot make this pass. Top-level keys only: `_subresources` opens a
 * multi-line brace block whose inner lines are reported as the single key
 * `_subresources` with a `{` value, which is all this guard needs to know.
 */
function readParams(file) {
  const params = {};
  let inParams = false;
  let depth = 0;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (depth > 0) {
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      continue;
    }
    if (line.startsWith('[')) {
      inParams = line === '[params]';
      continue;
    }
    if (!inParams || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const value = line.slice(eq + 1).trim();
    params[line.slice(0, eq).trim()] = value.replace(/^"(.*)"$/, '$1');
    if (value === '{') depth = 1;
  }
  return params;
}

const rel = (file) => relative(REPO_ROOT, file).split(sep).join('/');

const sidecars = walk(SCENES);

describe('.import sidecar allowlist (ADR-0028)', () => {
  it('finds the vendored sidecars', () => {
    // A guard over an empty set proves nothing; fail loudly if they vanish.
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
    // An unrecognised key is the interesting case: a Godot version or importer we have
    // not looked at. It is a decision, not a failure — classify it into one of the sets
    // above (with the reason) or honour it.
    const unknown = [];
    for (const file of sidecars) {
      for (const key of Object.keys(readParams(file))) {
        if (HONOURED.has(key) || INERT.has(key) || MUST_BE_DEFAULT.has(key)) continue;
        if (key === '_subresources') continue;
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

  it('carries only the per-node overrides already accounted for', () => {
    // _subresources is the one parameter that is not uniformly inert, so each non-empty
    // block is named with what it does. Two are unhandled divergences, recorded rather
    // than hidden; a NEW one must be looked at instead of silently joining them.
    const withOverrides = sidecars
      .filter((file) => readParams(file)['_subresources'] === '{')
      .map(rel)
      .sort();
    expect(withOverrides).toEqual(Object.keys(KNOWN_SUBRESOURCE_OVERRIDES).sort());
  });

  it('has exactly one sidecar that corrects a root scale', () => {
    // The correction this whole mechanism exists for. A second one deserves a look
    // rather than silent inclusion.
    const scaled = sidecars.filter((file) => {
      const raw = readParams(file)['nodes/root_scale'];
      return raw !== undefined && Number(raw) !== 1;
    });
    expect(scaled.map(rel)).toEqual(['scenes/demos/3d/truck_town/town/tree/scene.gltf.import']);
  });
});
