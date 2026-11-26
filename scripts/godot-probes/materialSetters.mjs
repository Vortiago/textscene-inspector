#!/usr/bin/env node
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { requireGodotVersion, runGodotScript } from './godotRun.mjs';

export const MATERIAL_SETTERS_FILE = join(
  REPO_ROOT,
  'packages/textscene-core/src/shaders/material/materialSetters.generated.json'
);

/** One BaseMaterial3D property of each kind of setter the node path reads, named for its kind. */
const PROPERTIES = {
  bool: ['grow', 'heightmap_deep_parallax', 'particles_anim_loop'],
  feature: ['rim_enabled'],
  flag: ['uv1_triplanar'],
  int: ['heightmap_min_layers', 'particles_anim_h_frames', 'stencil_reference'],
  flags: ['stencil_flags'],
  enum: ['blend_mode', 'transparency', 'cull_mode', 'stencil_mode'],
  float: ['roughness', 'metallic'],
  clampedFloat: ['uv1_triplanar_sharpness', 'proximity_fade_distance'],
  vector: ['uv1_scale'],
  colour: ['albedo_color', 'emission'],
  textureChannel: ['metallic_texture_channel', 'ao_texture_channel', 'roughness_texture_channel'],
  texture: ['albedo_texture'],
};

/** Each odd value a file can write: non-finite, out of range, and each Variant type a setter may not take. */
export const INPUTS = [
  '0.25',
  'nan',
  'inf',
  'inf_neg',
  '-1',
  '7',
  '1e10',
  'true',
  'null',
  '"0.5"',
  '"x"',
  'Vector2(1, 2)',
  'Vector3(1, 2, 3)',
  'Vector3i(2, 3, 4)',
  'Color(1, 0.5, 0, 1)',
];

const LINE_PREFIX = 'MATERIAL_SETTER ';

/** `Object::set` is the call a scene load makes for each property (`resource_format_text.cpp`). */
const SCRIPT = `extends Node

func _ready() -> void:
	for property in ${JSON.stringify(Object.values(PROPERTIES).flat())}:
		for input in ${JSON.stringify(INPUTS)}:
			var material := StandardMaterial3D.new()
			material.set(property, str_to_var(input))
			var found := var_to_str(material.get(property))
			print("${LINE_PREFIX}", JSON.stringify({"property": property, "input": input, "godot": found}))
	print("${LINE_PREFIX}", JSON.stringify({"version": Engine.get_version_info().string}))
	get_tree().quit()
`;

/** Godot's version and what each property holds after its setter took each input. */
export function parseMaterialSetterOutput(stdout) {
  const lines = stdout
    .split('\n')
    .filter((line) => line.startsWith(LINE_PREFIX))
    .map((line) => JSON.parse(line.slice(LINE_PREFIX.length)));
  const version = lines.find((line) => 'version' in line);
  if (!version) throw new Error(`expected Godot's version line in its output, got:\n${stdout}`);
  const kindOf = Object.fromEntries(
    Object.entries(PROPERTIES).flatMap(([kind, names]) => names.map((name) => [name, kind]))
  );
  const rows = lines
    .filter((line) => 'property' in line)
    .map((line) => ({ kind: kindOf[line.property], ...line }));
  return { godot: version.version, rows };
}

async function main() {
  const record = parseMaterialSetterOutput(await runGodotScript(SCRIPT, {}));
  requireGodotVersion(record.godot);
  const outputs = [[MATERIAL_SETTERS_FILE, `${JSON.stringify(record, null, 1)}\n`]];
  const summary = `${record.rows.length} setter answers`;
  if (process.argv.includes('--check')) {
    checkGenerated(outputs, {
      tool: 'godot:material-setters',
      command: 'pnpm godot:material-setters',
      summary,
    });
  } else {
    writeGenerated(outputs, { tool: 'godot:material-setters', summary });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
