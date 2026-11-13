/**
 * The shading language text that Godot's material generators write, over a sweep of each
 * generator's flags: every built-in material class, at its defaults and with each `bool` and
 * enum property set to each value in turn, one at a time. Godot binds no getter of a material's
 * shader, so the script finds it by its RID (see `GENERATOR_SCRIPT`).
 */

import { runGodotScript } from '../../../../../scripts/godot-probes/godotRun.mjs';

/** Godot's material classes whose shader a generator writes: all five shader types. */
const GENERATOR_CLASSES = [
  'StandardMaterial3D',
  'ORMMaterial3D',
  'CanvasItemMaterial',
  'ParticleProcessMaterial',
  'ProceduralSkyMaterial',
  'PanoramaSkyMaterial',
  'PhysicalSkyMaterial',
  'FogMaterial',
];

const LINE_PREFIX = 'GENERATED ';

/**
 * A RID is a validator from one counter for every RID and an index (`rid_owner.h:167`), so a
 * shader the material makes has a validator between two shaders the script makes around it.
 * The script reads the code of each RID in that range, `RenderingServer.shader_get_code` being
 * bound while `Material.get_shader_rid` is not. A canvas item material updates its shader on
 * the next frame, so the script waits one.
 */
const GENERATOR_SCRIPT = `extends Node

func shader_code(name: String, property: String, value) -> String:
	var before := RenderingServer.shader_create()
	var material: Material = ClassDB.instantiate(name)
	if property != "":
		material.set(property, value)
	material.get_rid()
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

func swept_values(property: Dictionary) -> Array:
	if property.type == TYPE_BOOL:
		return [true, false]
	if property.type != TYPE_INT or property.hint != PROPERTY_HINT_ENUM:
		return []
	var values := []
	var names: PackedStringArray = property.hint_string.split(",")
	for index in names.size():
		var parts := names[index].split(":")
		values.append(int(parts[1]) if parts.size() > 1 else index)
	return values

func report(name: String, property: String, value, code: String) -> void:
	if code != "":
		printerr("${LINE_PREFIX}", JSON.stringify({"class": name, "property": property, "value": value, "code": code}))

func _ready() -> void:
	for name in ${JSON.stringify(GENERATOR_CLASSES)}:
		report(name, "", null, await shader_code(name, "", null))
		var material: Material = ClassDB.instantiate(name)
		for property in material.get_property_list():
			if not (property.usage & PROPERTY_USAGE_EDITOR):
				continue
			for value in swept_values(property):
				report(name, property.name, value, await shader_code(name, property.name, value))
	get_tree().quit()
`;

/**
 * Each distinct text the generators write, with the class and the property value that first
 * wrote it: `{ class, property, value, code }`, `property` empty for a class's defaults.
 */
export function generatorShaders() {
  return parseGeneratorOutput(runGodotScript(GENERATOR_SCRIPT, {}));
}

/** The generator lines of Godot's output, each distinct code once, in the order Godot wrote them. */
function parseGeneratorOutput(output) {
  const byCode = new Map();
  for (const line of output.split('\n').filter((text) => text.startsWith(LINE_PREFIX))) {
    const shader = JSON.parse(line.slice(LINE_PREFIX.length));
    if (!byCode.has(shader.code)) byCode.set(shader.code, shader);
  }
  return [...byCode.values()];
}
