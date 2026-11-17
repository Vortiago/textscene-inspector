import { createHash } from 'node:crypto';
import { eachAtOnce, oneGodot, printedField, RUNS_AT_ONCE, runGodotScript } from './godotRun.mjs';
import { SHADER_BETWEEN } from './shaderBetween.mjs';
import { godotVerdicts, verdictText } from './shaderVerdicts.mjs';

const MARKER = 'MATERIAL ';
const DONE = 'MATERIALS DONE';

/** The last part of the id of a stencil's next pass, after its material's id. */
export const NEXT_PASS = 'next_pass';

/** The material classes whose text BaseMaterial3D writes: ORMMaterial3D sets the key's `orm` bit. */
export const MATERIAL_CLASSES = ['StandardMaterial3D', 'ORMMaterial3D'];

/** Each class gets this many materials with many properties set at once, which pairs do not reach. */
export const RANDOM_CASES = 3000;

/** A sweep of BaseMaterial3D's properties: each case is recorded alone, with Godot's text. */
const MATERIAL_SCRIPT = `extends Node
${SHADER_BETWEEN}

const RANDOM_CASES := ${RANDOM_CASES}
const RANDOM_SEED := 1456
const MOST_SETTINGS := 12

## A bool takes the value its default is not: texture_repeat defaults to true.
func values_of(p: Dictionary, defaults: Material) -> Array:
	if p.type == TYPE_BOOL:
		return [not defaults.get(p.name)]
	if p.type != TYPE_INT:
		return []
	var names: PackedStringArray = p.hint_string.split(",")
	if p.hint == PROPERTY_HINT_ENUM:
		return hinted(names, func(index): return index)
	if p.hint == PROPERTY_HINT_FLAGS:
		var bits := hinted(names, func(index): return 1 << index)
		var all := 0
		for bit in bits:
			all |= bit
		return bits + [all]
	if p.hint == PROPERTY_HINT_RANGE:
		return [int(names[0]), int(names[0]) + 1, int(names[1])]
	return []

## A hint's value for each name: the one after its colon, or the one its place implies.
func hinted(names: PackedStringArray, implied: Callable) -> Array:
	var values := []
	for index in names.size():
		var parts := names[index].split(":")
		values.append(int(parts[1]) if parts.size() > 1 else implied.call(index))
	return values

func values_by_name() -> Dictionary:
	var defaults := StandardMaterial3D.new()
	var values := {}
	for p in ClassDB.class_get_property_list("BaseMaterial3D", true):
		if not values_of(p, defaults).is_empty():
			values[p.name] = values_of(p, defaults)
	return values

func sweep(values: Dictionary) -> Array:
	var singles := []
	for name in values:
		for value in values[name]:
			singles.append([name, value])
	var cases := [[]]
	for single in singles:
		cases.append([single])
	for first in singles.size():
		for second in range(first + 1, singles.size()):
			if singles[first][0] != singles[second][0]:
				cases.append([singles[first], singles[second]])
	return cases

## Seeded, so every run and every chunk draws the same cases.
func random_cases(values: Dictionary) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = RANDOM_SEED
	var cases := []
	for index in RANDOM_CASES:
		var names: Array = values.keys()
		var settings := []
		for count in rng.randi_range(3, MOST_SETTINGS):
			var name: String = names.pop_at(rng.randi_range(0, names.size() - 1))
			settings.append([name, values[name][rng.randi_range(0, values[name].size() - 1)]])
		cases.append(settings)
	return cases

func id_of(cls: String, settings: Array) -> String:
	var parts := [cls]
	for setting in settings:
		parts.append("%s=%s" % [setting[0], setting[1]])
	return "|".join(parts)

func made(cls: String, settings: Array) -> Material:
	var material: Material = ClassDB.instantiate(cls)
	for setting in settings:
		material.set(setting[0], setting[1])
	return material

func record(id: String, material: Material) -> void:
	printerr("${MARKER}", id, " ", Marshalls.utf8_to_base64(await shader_of(material)))

## Each window holds one shader: a stencil's next pass is measured alone, with its material freed.
func record_case(cls: String, settings: Array) -> void:
	var material := made(cls, settings)
	var next := material.next_pass
	material.next_pass = null
	if next != null:
		material = null
		await record(id_of(cls, settings) + "|${NEXT_PASS}", next)
		next = null
		material = made(cls, settings)
		material.next_pass = null
	await record(id_of(cls, settings), material)
	material = null
	# A material of the same key that is still alive would lend the next case its shader.
	await get_tree().process_frame

func _ready() -> void:
	var run: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://run.json"))
	printerr("GODOT ", Engine.get_version_info().string)
	var values := values_by_name()
	var cases := sweep(values) + random_cases(values)
	var index := 0
	for cls in run.classes:
		for settings in cases:
			if index % int(run.chunks) == int(run.chunk):
				await record_case(cls, settings)
			index += 1
	printerr("${DONE}")
	get_tree().quit()
`;

/** The hex SHA-256 of a text, as a material case holds it. */
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** Each case's text from `output`, by its id. Throws when the run did not end or a text is missing. */
export function parseMaterialOutput(output) {
  if (!output.includes(DONE)) throw new Error(`expected "${DONE}" in Godot's output, found none`);
  const lines = output
    .split(DONE)[0]
    .split('\n')
    .filter((line) => line.startsWith(MARKER));
  return lines.map((line) => {
    const [id, encoded] = line.slice(MARKER.length).trim().split(' ');
    const text = Buffer.from(encoded ?? '', 'base64').toString('utf8');
    if (text === '') throw new Error(`expected Godot's shader text for material ${id}, found none`);
    return { id, text };
  });
}

const BOOLEANS = { true: true, false: false };

/** A setting's value as `id_of` prints it: a bool, or an enum, flag or integer. */
const valueOf = (printed) => BOOLEANS[printed] ?? Number(printed);

/** A case id as `id_of` writes it, `Class|property=value|...`, then `|next_pass` for a next pass. */
export function parseCaseId(id) {
  const [materialClass, ...parts] = id.split('|');
  const isNextPass = parts.at(-1) === NEXT_PASS;
  const settings = (isNextPass ? parts.slice(0, -1) : parts).map((setting) => {
    const [name, value] = setting.split('=');
    return [name, valueOf(value)];
  });
  return { materialClass, settings: Object.fromEntries(settings), isNextPass };
}

/** Each case's hash and each hash's compiler verdict, from Godot, and `texts`, each text by its hash. */
export async function materialRecord() {
  const chunks = Array.from({ length: RUNS_AT_ONCE }, (_, chunk) => chunk);
  const runs = await eachAtOnce(chunks, async (chunk) => {
    const output = await runGodotScript(MATERIAL_SCRIPT, {
      'run.json': JSON.stringify({ classes: MATERIAL_CLASSES, chunk, chunks: RUNS_AT_ONCE }),
    });
    return { godot: printedField(output, 'GODOT '), texts: parseMaterialOutput(output) };
  });
  const { godot } = oneGodot(runs);
  const entries = runs
    .flatMap((run) => run.texts)
    .map(({ id, text }) => ({ id, text, hash: sha256(text) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cases = Object.fromEntries(entries.map(({ id, hash }) => [id, hash]));
  const texts = Object.fromEntries(entries.map(({ text, hash }) => [hash, text]));
  const hashes = Object.keys(texts).sort();
  const compiled = await godotVerdicts(hashes.map((hash) => texts[hash]));
  oneGodot([{ godot }, compiled]);
  const verdicts = Object.fromEntries(
    hashes.map((hash, index) => [hash, verdictText(compiled.verdicts[index])])
  );
  return { record: { godot, cases, verdicts }, texts };
}
