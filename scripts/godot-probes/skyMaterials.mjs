#!/usr/bin/env node
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { requireGodotVersion, runGodotScript } from './godotRun.mjs';

export const SKY_MATERIALS_FILE = join(
  REPO_ROOT,
  'apps/textscene-three-godot-shaders/tests/materials/skyMaterials.generated.json'
);

/** A texture property is set to a placeholder, since only whether it is valid changes the text. */
const TEXTURE = 'texture';

/** Each variant of a class's shader cache, by the properties that pick it (`sky_material.cpp:296`). */
const TEXT_CASES = [
  ...[true, false].flatMap((use_debanding) =>
    [null, TEXTURE].flatMap((texture) => [
      { class: 'ProceduralSkyMaterial', properties: { use_debanding, sky_cover: texture } },
      { class: 'PhysicalSkyMaterial', properties: { use_debanding, night_sky: texture } },
    ])
  ),
  { class: 'PanoramaSkyMaterial', properties: { filter: true } },
  { class: 'PanoramaSkyMaterial', properties: { filter: false } },
];

/** Property sets whose uniforms each setter writes: defaults, ordinary values, 0, and past the hints. */
const PARAMETER_CASES = [
  { class: 'ProceduralSkyMaterial', properties: {} },
  {
    class: 'ProceduralSkyMaterial',
    properties: {
      sky_top_color: 'Color(0.1, 0.3, 0.9, 1)',
      sky_horizon_color: 'Color(0.8, 0.5, 0.2, 1)',
      sky_curve: 0.5,
      sky_energy_multiplier: 2.5,
      sky_cover_modulate: 'Color(0.2, 0.4, 0.6, 0.5)',
      ground_bottom_color: 'Color(0.05, 0.3, 0.1, 1)',
      ground_horizon_color: 'Color(0.9, 0.9, 0.7, 1)',
      ground_curve: 0.3,
      ground_energy_multiplier: 0.25,
      sun_angle_max: 90,
      sun_curve: 0.6,
      energy_multiplier: 3,
    },
  },
  {
    class: 'ProceduralSkyMaterial',
    properties: {
      sky_curve: 0,
      sky_energy_multiplier: 0,
      ground_curve: -0.5,
      ground_energy_multiplier: 70,
      sun_angle_max: 0,
      sun_curve: 0,
      energy_multiplier: 0,
    },
  },
  {
    class: 'ProceduralSkyMaterial',
    properties: { sky_curve: 4, ground_curve: 1, sun_angle_max: 360, sun_curve: 2.5, energy_multiplier: 200 },
  },
  { class: 'PanoramaSkyMaterial', properties: {} },
  { class: 'PanoramaSkyMaterial', properties: { energy_multiplier: 0 } },
  { class: 'PanoramaSkyMaterial', properties: { energy_multiplier: 7.5 } },
  { class: 'PhysicalSkyMaterial', properties: {} },
  {
    class: 'PhysicalSkyMaterial',
    properties: {
      rayleigh_coefficient: 6,
      rayleigh_color: 'Color(0.9, 0.2, 0.1, 1)',
      mie_coefficient: 0.05,
      mie_eccentricity: -0.4,
      mie_color: 'Color(0.1, 0.8, 0.3, 1)',
      turbidity: 100,
      sun_disk_scale: 12,
      ground_color: 'Color(0.4, 0.4, 0.8, 1)',
      energy_multiplier: 2,
    },
  },
  {
    class: 'PhysicalSkyMaterial',
    properties: {
      rayleigh_coefficient: 0,
      mie_coefficient: 0,
      mie_eccentricity: 0,
      turbidity: 0,
      sun_disk_scale: 0,
      energy_multiplier: 0,
    },
  },
];

const LINE_PREFIX = 'SKY_MATERIAL ';

/** RID validators share one counter (`rid_owner.h:167`): the material's shader sits between the script's. */
const SCRIPT = `extends Node

func material_of(name: String, properties: Dictionary) -> Material:
	var material: Material = ClassDB.instantiate(name)
	for property in properties:
		var value = properties[property]
		if value is String and value == "${TEXTURE}":
			value = PlaceholderTexture2D.new()
		elif value is String:
			value = str_to_var(value)
		material.set(property, value)
	return material

func shader_code(name: String, properties: Dictionary) -> String:
	var before := RenderingServer.shader_create()
	material_of(name, properties).get_rid()
	await get_tree().process_frame
	var after := RenderingServer.shader_create()
	var found := ""
	for validator in range((before.get_id() >> 32) + 1, after.get_id() >> 32):
		for index in range(0, (after.get_id() & 0xffffffff) + 1):
			var code := RenderingServer.shader_get_code(rid_from_int64((validator << 32) | index))
			if code != "":
				found = code
	RenderingServer.free_rid(before)
	RenderingServer.free_rid(after)
	return found

func parameters_of(material: Material, names: PackedStringArray) -> Dictionary:
	var values := {}
	for name in names:
		var value = RenderingServer.material_get_param(material.get_rid(), name)
		if typeof(value) in [TYPE_FLOAT, TYPE_COLOR]:
			values[name] = var_to_str(value)
	return values

func uniform_names(code: String) -> PackedStringArray:
	var names := PackedStringArray()
	for found in RegEx.create_from_string("uniform +[a-z0-9]+ +([a-z_0-9]+)").search_all(code):
		names.append(found.get_string(1))
	return names

func _ready() -> void:
	var names_of_class := {}
	for each in ${JSON.stringify(TEXT_CASES)}:
		var code: String = await shader_code(each["class"], each.properties)
		names_of_class[each["class"]] = uniform_names(code)
		print("${LINE_PREFIX}", JSON.stringify({"kind": "text", "case": each, "code": code}))
	for each in ${JSON.stringify(PARAMETER_CASES)}:
		var material := material_of(each["class"], each.properties)
		var values := parameters_of(material, names_of_class[each["class"]])
		print("${LINE_PREFIX}", JSON.stringify({"kind": "parameters", "case": each, "values": values}))
	print("${LINE_PREFIX}", JSON.stringify({"kind": "version", "godot": Engine.get_version_info().string}))
	get_tree().quit()
`;
/** The record of Godot's output: its version, each text case with its code, each parameter case. */
export function parseSkyMaterialOutput(stdout) {
  const lines = stdout
    .split('\n')
    .filter((line) => line.startsWith(LINE_PREFIX))
    .map((line) => JSON.parse(line.slice(LINE_PREFIX.length)));
  const ofKind = (kind) => lines.filter((line) => line.kind === kind);
  const [version] = ofKind('version');
  if (!version) throw new Error(`expected Godot's version line in its output, got:\n${stdout}`);
  return {
    godot: version.godot,
    texts: ofKind('text').map((line) => ({ ...line.case, code: line.code })),
    parameters: ofKind('parameters').map((line) => ({ ...line.case, values: line.values })),
  };
}

async function main() {
  const record = parseSkyMaterialOutput(await runGodotScript(SCRIPT, {}));
  requireGodotVersion(record.godot);
  const outputs = [[SKY_MATERIALS_FILE, `${JSON.stringify(record, null, 1)}\n`]];
  const summary = `${record.texts.length} texts, ${record.parameters.length} parameter sets`;
  if (process.argv.includes('--check')) {
    checkGenerated(outputs, { tool: 'godot:sky-materials', command: 'pnpm godot:sky-materials', summary });
  } else {
    writeGenerated(outputs, { tool: 'godot:sky-materials', summary });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
